package com.calltrack.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.CallLog
import android.provider.Settings
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class CallTrackService : Service() {

    companion object {
        private const val POPUP_CHANNEL_ID = "calltrack_popup"
        private const val POPUP_NOTIF_ID   = 9002

        // Fallback for when SYSTEM_ALERT_WINDOW hasn't been granted, so startActivity()
        // from the background would be silently blocked (BAL restriction, Android 10+).
        // A full-screen-intent notification is exempt from that restriction. Shared by
        // CallTrackService and CallLogModule.bringAppToForeground().
        internal fun showPopupFallbackNotification(context: Context, launchIntent: Intent) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    val hasPostNotif = ContextCompat.checkSelfPermission(
                        context, android.Manifest.permission.POST_NOTIFICATIONS
                    ) == PackageManager.PERMISSION_GRANTED
                    if (!hasPostNotif) return
                }

                val nm = context.getSystemService(NotificationManager::class.java)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        POPUP_CHANNEL_ID, "CallTrack Popup", NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        // OEM skins (MIUI/HyperOS, ColorOS, FuntouchOS) demote ordinary
                        // high-importance notifications from a background service; a call-category
                        // channel that may bypass DND is treated as time-critical instead.
                        setBypassDnd(true)
                        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    }
                    nm.createNotificationChannel(channel)
                }

                val pendingIntent = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val builder = NotificationCompat.Builder(context, POPUP_CHANNEL_ID)
                    .setContentTitle("Call ended")
                    .setContentText("Call ended — tap to log it")
                    .setSmallIcon(android.R.drawable.ic_menu_call)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)

                // On Android 14+ a full-screen intent the app isn't permitted to use makes the
                // system silently demote the whole notification into the tray. Attaching it only
                // when it will actually be honoured keeps the heads-up banner in the other case.
                val canUseFsi = if (Build.VERSION.SDK_INT >= 34) {
                    runCatching { nm.canUseFullScreenIntent() }.getOrDefault(false)
                } else true
                if (canUseFsi) builder.setFullScreenIntent(pendingIntent, true)

                nm.notify(POPUP_NOTIF_ID, builder.build())
            } catch (_: Exception) {}
        }
    }

    private val CHANNEL_ID = "calltrack_bg"
    private val NOTIF_ID   = 9001

    private var telephonyManager: TelephonyManager? = null
    private var lastState  = TelephonyManager.CALL_STATE_IDLE
    private var wasOffhook = false
    private var observerRegistered = false
    // Captured on the IDLE transition, consumed once the delayed processLatestCallLog()
    // actually emits the onCallEnded event for this call.
    private var lastRecordingPath: String? = null
    // Guards against re-emitting the same call. The freshness window below is deliberately
    // wide (90s) and several retries fire per call, so without this every attempt that found
    // the same row would emit another onCallEnded. PendingCallStore already merges duplicate
    // enqueues, but the JS-side event has no such dedup.
    private var lastEmittedClientCallId: String? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    private val callLogObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            super.onChange(selfChange, uri)
            scheduleCallLogReads()
        }
    }

    // A single read 500ms after the call-log write notification misses on MIUI/HyperOS and
    // several Samsung builds, where the row lands seconds later — the read finds nothing,
    // returns, and the call then falls outside the freshness window forever, so the agent
    // gets no prompt at all. Re-read on a backoff instead, until a fresh row shows up.
    private val readDelaysMs = longArrayOf(600, 1200, 2500, 4000, 7000, 12000, 20000)

    private fun scheduleCallLogReads() {
        readDelaysMs.forEach { delay ->
            mainHandler.postDelayed({ processLatestCallLog() }, delay)
        }
    }

    @Suppress("DEPRECATION")
    private val phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            when {
                state == TelephonyManager.CALL_STATE_OFFHOOK -> {
                    if (!wasOffhook) CallLogModule.startRecordingFromNative()
                    wasOffhook = true
                }
                state == TelephonyManager.CALL_STATE_IDLE -> {
                    if (wasOffhook) lastRecordingPath = CallLogModule.stopRecordingFromNative()
                    if (lastState == TelephonyManager.CALL_STATE_OFFHOOK ||
                        lastState == TelephonyManager.CALL_STATE_RINGING) {
                        // Drive the prompt off the call actually ending, not only off the
                        // ContentObserver — that callback can be coalesced or delayed by the OS,
                        // and on some skins never arrives at all for the app's own process.
                        scheduleCallLogReads()
                    }
                    wasOffhook = false
                }
            }
            lastState = state
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification())
        registerListeners()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // The service gets started twice on a normal launch — once natively from
        // MainActivity.onCreate(), then again moments later from JS (App.js calling
        // CallLogModule.startCallTrackService()) once the bridge is up. The second
        // startForegroundService() call reuses this already-running instance (onCreate()
        // doesn't fire again), landing here instead — and on Android 12+, every single
        // startForegroundService() call requires its own startForeground() within a few
        // seconds, even if the service is already in the foreground state. Skipping this
        // call is what caused an intermittent ForegroundServiceDidNotStartInTimeException
        // crash on launch; calling it again here is a safe, cheap no-op when already
        // foregrounded (just refreshes the same notification).
        startForeground(NOTIF_ID, buildNotification())
        // Re-try registering listeners every time service starts
        // handles case where permissions were just granted
        registerListeners()
        return START_STICKY
    }

    private fun registerListeners() {
        // ContentObserver — needs READ_CALL_LOG
        if (!observerRegistered) {
            val hasCallLog = ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED

            if (hasCallLog) {
                try {
                    contentResolver.registerContentObserver(
                        CallLog.Calls.CONTENT_URI, true, callLogObserver
                    )
                    observerRegistered = true
                } catch (_: Exception) {}
            }
        }

        // PhoneStateListener — needs READ_PHONE_STATE
        val hasPhoneState = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        if (hasPhoneState) {
            try {
                telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                @Suppress("DEPRECATION")
                telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
            } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        try { contentResolver.unregisterContentObserver(callLogObserver) } catch (_: Exception) {}
        try {
            @Suppress("DEPRECATION")
            telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
        } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun processLatestCallLog() {
        try {
            val hasCallLog = ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasCallLog) return

            val allowed = SimFilter.trackedAccountIds(this)

            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.PHONE_ACCOUNT_ID,
                ),
                null, null,
                "${CallLog.Calls.DATE} DESC"
            ) ?: return

            cursor.use {
                if (!it.moveToFirst()) return

                val numIdx    = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx   = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx   = it.getColumnIndex(CallLog.Calls.TYPE)
                val durIdx    = it.getColumnIndex(CallLog.Calls.DURATION)
                val dateIdx   = it.getColumnIndex(CallLog.Calls.DATE)
                val accountIdx= it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)

                if (typeIdx == -1 || numIdx == -1 || durIdx == -1 || dateIdx == -1) return

                val timestamp = it.getLong(dateIdx)
                // Matches the outer bound of the retry schedule above — a row that lands 20s
                // late must still be considered fresh, or the last retry would reject the very
                // row it was waiting for.
                if (System.currentTimeMillis() - timestamp > 90_000) return

                // ── SIM filter ──────────────────────────────────────────────
                if (accountIdx != -1 && !SimFilter.matches(allowed, it.getString(accountIdx))) return
                // ────────────────────────────────────────────────────────────

                val callType = when (it.getInt(typeIdx)) {
                    CallLog.Calls.INCOMING_TYPE -> "incoming"
                    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                    CallLog.Calls.MISSED_TYPE   -> "missed"
                    CallLog.Calls.REJECTED_TYPE -> "rejected"
                    else                        -> "unknown"
                }

                val number   = it.getString(numIdx) ?: ""
                val name     = if (nameIdx != -1) it.getString(nameIdx) ?: "" else ""
                val duration = it.getInt(durIdx)

                val clientCallId = PendingCallStore.clientCallId(number, timestamp)
                // Every retry that lands on the same row would otherwise re-emit and re-prompt.
                if (clientCallId == lastEmittedClientCallId) return
                lastEmittedClientCallId = clientCallId

                // Consume the recording path only once we know we're actually emitting. Reading
                // it above the dedup check would let an early retry that landed on the previous
                // call's row null it out before this call's row ever appears.
                val recordingPath = lastRecordingPath
                lastRecordingPath = null

                PendingCallStore.enqueue(
                    this,
                    PendingCallStore.PendingCall(
                        clientCallId, number, name, callType, duration, timestamp, recordingPath
                    )
                )

                CallLogModule.emitCallEnded(clientCallId, number, name, callType, duration, timestamp, recordingPath)
                bringAppToForeground()
            }
        } catch (_: Exception) {}
    }

    private fun bringAppToForeground() {
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            } ?: return

            if (Settings.canDrawOverlays(this)) {
                startActivity(intent)
                // Post the notification anyway. On several OEM skins startActivity() from a
                // service returns without throwing yet never actually brings the activity
                // forward, which left the agent with no prompt at all. A redundant heads-up
                // is harmless when the launch does work — the notification auto-cancels.
                showPopupFallbackNotification(this, intent)
            } else {
                // No overlay permission — startActivity() from this Service would be
                // silently blocked by the background-activity-launch restriction.
                showPopupFallbackNotification(this, intent)
            }
        } catch (_: Exception) {}
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "CallTrack", NotificationManager.IMPORTANCE_LOW
            ).apply { setShowBadge(false) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CallTrack")
            .setContentText("Monitoring calls...")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
}
