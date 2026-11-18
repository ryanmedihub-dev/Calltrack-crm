package com.calltrack.app

import android.content.Intent
import android.content.SharedPreferences
import android.media.AudioManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class CallLogModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        @Volatile private var instance: ReactApplicationContext? = null
        @Volatile private var moduleInstance: CallLogModule? = null

        fun emitCallEnded(
            clientCallId: String,
            contactNumber: String, contactName: String,
            callType: String, duration: Int, timestamp: Long,
            recordingPath: String? = null,
        ) {
            val ctx = instance ?: return
            try {
                val params = Arguments.createMap().apply {
                    putString("clientCallId",  clientCallId)
                    putString("contactNumber", contactNumber)
                    putString("contactName",   contactName)
                    putString("callType",      callType)
                    putInt("duration",         duration)
                    putDouble("timestamp",     timestamp.toDouble())
                    putString("recordingPath", recordingPath)
                }
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onCallEnded", params)
            } catch (_: Exception) {}
        }

        fun emitPendingCallAvailable() {
            val ctx = instance ?: return
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onPendingCallAvailable", null)
            } catch (_: Exception) {}
        }

        // Called from PhoneStateReceiver / CallTrackService (plain Kotlin, no JS promise
        // available) when the call becomes OFFHOOK. Idempotent — a call already in
        // progress is left alone so the receiver and the foreground service can both
        // observe the same transition without starting two recorders.
        fun startRecordingFromNative() {
            try {
                moduleInstance?.startRecordingInternal()
            } catch (_: Exception) {}
        }

        // Called from PhoneStateReceiver / CallTrackService when the call goes IDLE.
        // Returns the recorded file path so the caller can fold it into the
        // onCallEnded event payload as `recordingPath`.
        fun stopRecordingFromNative(): String? {
            return try {
                moduleInstance?.stopRecordingInternal()
            } catch (_: Exception) { null }
        }
    }

    init {
        instance = reactContext
        moduleInstance = this
    }

    private var recorder: MediaRecorder? = null
    private var currentRecordingPath: String? = null
    private var usedSpeakerFallback: Boolean = false

    override fun getName() = "CallLogModule"

    private fun prefs(): SharedPreferences =
        reactApplicationContext.getSharedPreferences("CallTrackPrefs", android.content.Context.MODE_PRIVATE)

    @ReactMethod
    fun getCallLogsSince(sinceTimestamp: Double, subscriptionId: Double, slotIndex: Double, promise: Promise) {
        try {
            val since  = sinceTimestamp.toLong()
            val subId  = subscriptionId.toInt()
            val slotId = slotIndex.toInt()

            val allowed = SimFilter.accountIdsFor(reactApplicationContext, subId, slotId)

            val cursor = reactApplicationContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.PHONE_ACCOUNT_ID,
                ),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(since.toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            val results = Arguments.createArray()
            cursor?.use {
                val numCol      = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameCol     = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeCol     = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateCol     = it.getColumnIndex(CallLog.Calls.DATE)
                val durationCol = it.getColumnIndex(CallLog.Calls.DURATION)
                val accountCol  = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)

                while (it.moveToNext()) {
                    if (accountCol != -1 && !SimFilter.matches(allowed, it.getString(accountCol))) continue
                    val callTypeStr = when (it.getInt(typeCol)) {
                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE   -> "missed"
                        CallLog.Calls.REJECTED_TYPE -> "rejected"
                        else                        -> "unknown"
                    }
                    val rowNumber    = it.getString(numCol) ?: ""
                    val rowTimestamp = it.getLong(dateCol)
                    val entry = Arguments.createMap().apply {
                        putString("clientCallId",  PendingCallStore.clientCallId(rowNumber, rowTimestamp))
                        putString("contactNumber", rowNumber)
                        putString("contactName",   it.getString(nameCol) ?: "")
                        putString("callType",      callTypeStr)
                        putDouble("timestamp",     rowTimestamp.toDouble())
                        putInt("duration",         it.getInt(durationCol))
                    }
                    results.pushMap(entry)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("GET_CALL_LOGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setTrackedSim(subscriptionId: Int) {
        prefs().edit().putInt("tracked_sub_id", subscriptionId).apply()
    }

    @ReactMethod
    fun setTrackedSimSlot(slotIndex: Int) {
        prefs().edit().putInt("tracked_sim_slot", slotIndex).apply()
    }

    @ReactMethod
    fun getPendingCall(promise: Promise) {
        try {
            val call = PendingCallStore.peekOldest(reactApplicationContext)
            if (call == null) {
                promise.resolve(null)
                return
            }
            val result = Arguments.createMap().apply {
                putString("clientCallId",  call.clientCallId)
                putString("contactNumber", call.number)
                putString("contactName",   call.name)
                putString("callType",      call.type)
                putInt("duration",         call.duration)
                putDouble("timestamp",     call.timestamp.toDouble())
                putString("recordingPath", call.recordingPath ?: "")
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_PENDING_CALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearPendingCall(promise: Promise) {
        try {
            // Removes only the oldest queued entry (the one the caller just handled) —
            // any calls queued behind it stay pending for the next getPendingCall().
            PendingCallStore.removeOldest(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CLEAR_PENDING_CALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val pm = ctx.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(ctx.packageName))
        } catch (e: Exception) {
            // Reporting "already exempt" on an unexpected failure would hide the setup row and
            // leave the user with no way to fix a service the OEM is freezing.
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        val ctx = reactApplicationContext
        runCatching {
            val intent = Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${ctx.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            ctx.startActivity(intent)
        }.onFailure {
            // Some OEM builds block the direct request dialog — fall back to the system list
            // so the user can still find the app and exempt it manually.
            runCatching {
                ctx.startActivity(
                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                )
            }
        }
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        // Only gateable from API 34 — below that a full-screen intent is always honoured.
        if (Build.VERSION.SDK_INT < 34) { promise.resolve(true); return }
        try {
            val nm = reactApplicationContext.getSystemService(android.app.NotificationManager::class.java)
            promise.resolve(nm.canUseFullScreenIntent())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT < 34) return
        val ctx = reactApplicationContext
        runCatching {
            val intent = Intent(
                Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:${ctx.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            ctx.startActivity(intent)
        }
    }

    @ReactMethod
    fun openOverlaySettings() {
        val ctx = reactApplicationContext
        val miuiLaunched = runCatching {
            val intent = Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setClassName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.permissions.PermissionsEditorActivity"
                )
                putExtra("extra_pkgname", ctx.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
        }.isSuccess

        if (!miuiLaunched) {
            runCatching {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${ctx.packageName}")
                ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                ctx.startActivity(intent)
            }
        }
    }

    @ReactMethod
    fun startCallTrackService() {
        val ctx = reactApplicationContext
        val intent = Intent(ctx, CallTrackService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }

    @ReactMethod
    fun stopCallTrackService() {
        val ctx = reactApplicationContext
        ctx.stopService(Intent(ctx, CallTrackService::class.java))
    }

    @ReactMethod
    fun bringAppToForeground() {
        val ctx = reactApplicationContext
        runCatching {
            val intent = ctx.packageManager
                .getLaunchIntentForPackage(ctx.packageName)
                ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP }
                ?: return

            if (Settings.canDrawOverlays(ctx)) {
                ctx.startActivity(intent)
            } else {
                // No overlay permission — startActivity() from here would be silently
                // blocked by the background-activity-launch restriction (Android 10+).
                CallTrackService.showPopupFallbackNotification(ctx, intent)
            }
        }
    }

    @ReactMethod
    fun startCallRecording(promise: Promise) {
        try {
            promise.resolve(startRecordingInternal())
        } catch (e: Exception) {
            promise.reject("RECORDING_START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopCallRecording(promise: Promise) {
        try {
            promise.resolve(stopRecordingInternal())
        } catch (e: Exception) {
            promise.reject("RECORDING_STOP_FAILED", e.message, e)
        }
    }

    private fun newRecorder(): MediaRecorder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(reactApplicationContext)
        } else {
            @Suppress("DEPRECATION") MediaRecorder()
        }

    private fun configuredRecorder(source: Int, outputPath: String): MediaRecorder {
        val r = newRecorder()
        r.setAudioSource(source)
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioEncodingBitRate(96000)
        r.setAudioSamplingRate(44100)
        r.setOutputFile(outputPath)
        return r
    }

    private fun releaseRecorderQuietly() {
        try { recorder?.reset() } catch (_: Exception) {}
        try { recorder?.release() } catch (_: Exception) {}
        recorder = null
    }

    // Some OEMs let a third-party app open VOICE_COMMUNICATION/VOICE_CALL without throwing,
    // but silently mute the actual samples as a privacy protection — the recorder "succeeds"
    // yet the file is pure silence. amplitudeCheckHandler polls MediaRecorder.getMaxAmplitude()
    // shortly after such a source starts; if it never sees a non-zero level, that attempt is
    // discarded and recording transparently swaps to the next tier.
    private val amplitudeCheckHandler = Handler(Looper.getMainLooper())

    // Tries VOICE_COMMUNICATION, then VOICE_CALL (both restricted/OEM-dependent audio
    // sources for capturing both sides of the call), then falls back to MIC with the
    // speakerphone forced on so the mic itself picks up the other party's audio.
    @Synchronized
    private fun startRecordingInternal(): String {
        recorder?.let { return currentRecordingPath ?: "" } // already recording — idempotent

        val dir = File(reactApplicationContext.filesDir, "call_recordings")
        if (!dir.exists()) dir.mkdirs()

        usedSpeakerFallback = false

        if (tryRestrictedSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION, dir)) return currentRecordingPath!!
        if (tryRestrictedSource(MediaRecorder.AudioSource.VOICE_CALL, dir)) return currentRecordingPath!!
        return startMicSpeakerFallback(dir)
    }

    private fun tryRestrictedSource(source: Int, dir: File): Boolean {
        val outputPath = File(dir, "call_${System.currentTimeMillis()}.m4a").absolutePath
        return try {
            val r = configuredRecorder(source, outputPath)
            r.prepare()
            r.start()
            recorder = r
            currentRecordingPath = outputPath
            Log.d("CallLogModule", "Recording started via source=$source -> $outputPath")
            scheduleSilenceCheck(r, dir)
            true
        } catch (e: Exception) {
            Log.d("CallLogModule", "source=$source failed: ${e.message}")
            releaseRecorderQuietly()
            false
        }
    }

    // Samples getMaxAmplitude() a few times over ~1.5s. If every sample is silent, the
    // source is being muted at the OS level despite starting cleanly — swap to MIC+speaker.
    private fun scheduleSilenceCheck(startedRecorder: MediaRecorder, dir: File) {
        var everHeard = false
        val checkDelaysMs = listOf(400L, 900L, 1500L)
        checkDelaysMs.forEachIndexed { i, delay ->
            amplitudeCheckHandler.postDelayed({
                synchronized(this) {
                    if (recorder !== startedRecorder) return@postDelayed // already stopped/swapped
                    val amp = try { startedRecorder.maxAmplitude } catch (_: Exception) { 0 }
                    // >20 (out of 32767) clears encoder dither/quantization noise on true
                    // silence, which can otherwise read as a spurious amplitude of 1-2.
                    if (amp > 20) everHeard = true
                    if (i == checkDelaysMs.lastIndex && !everHeard) {
                        Log.d("CallLogModule", "Silent capture detected — swapping to MIC+speaker fallback")
                        val silentPath = currentRecordingPath
                        try { startedRecorder.stop() } catch (_: Exception) {}
                        try { startedRecorder.release() } catch (_: Exception) {}
                        silentPath?.let { File(it).delete() }
                        recorder = null
                        currentRecordingPath = null
                        try { startMicSpeakerFallback(dir) } catch (_: Exception) {}
                    }
                }
            }, delay)
        }
    }

    private fun startMicSpeakerFallback(dir: File): String {
        val outputPath = File(dir, "call_${System.currentTimeMillis()}.m4a").absolutePath
        try {
            val audioManager = reactApplicationContext.getSystemService(
                android.content.Context.AUDIO_SERVICE
            ) as AudioManager
            audioManager.mode = AudioManager.MODE_IN_CALL
            audioManager.isSpeakerphoneOn = true

            val r = configuredRecorder(MediaRecorder.AudioSource.MIC, outputPath)
            r.prepare()
            r.start()
            recorder = r
            currentRecordingPath = outputPath
            usedSpeakerFallback = true
            Log.d("CallLogModule", "Recording started via MIC+speaker fallback -> $outputPath (speakerOn=${audioManager.isSpeakerphoneOn})")
            return outputPath
        } catch (e: Exception) {
            Log.d("CallLogModule", "MIC+speaker fallback failed: ${e.message}")
            releaseRecorderQuietly()
            throw e
        }
    }

    @Synchronized
    private fun stopRecordingInternal(): String? {
        val path = currentRecordingPath
        try { recorder?.stop() } catch (_: Exception) {}
        try { recorder?.release() } catch (_: Exception) {}
        recorder = null

        if (usedSpeakerFallback) {
            try {
                val audioManager = reactApplicationContext.getSystemService(
                    android.content.Context.AUDIO_SERVICE
                ) as AudioManager
                audioManager.isSpeakerphoneOn = false
                audioManager.mode = AudioManager.MODE_NORMAL
            } catch (_: Exception) {}
        }
        usedSpeakerFallback = false
        return path
    }
}
