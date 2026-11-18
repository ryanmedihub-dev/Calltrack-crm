package com.calltrack.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.CallLog
import android.telephony.TelephonyManager
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class PhoneStateReceiver : BroadcastReceiver() {

    companion object {
        private var lastState  = TelephonyManager.CALL_STATE_IDLE
        private var callStart  = 0L
        private var wasOffhook = false

        // Reused for the lifetime of the app instead of allocating (and leaking) a new
        // executor + thread on every single call.
        private val scheduler = Executors.newSingleThreadScheduledExecutor()
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val newState = when (stateStr) {
            TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
            TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
            else                                 -> TelephonyManager.CALL_STATE_IDLE
        }

        when {
            newState == TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (!wasOffhook) {
                    callStart = System.currentTimeMillis()
                    CallLogModule.startRecordingFromNative()
                }
                wasOffhook = true
            }
            newState == TelephonyManager.CALL_STATE_IDLE &&
            (lastState == TelephonyManager.CALL_STATE_OFFHOOK ||
             lastState == TelephonyManager.CALL_STATE_RINGING) -> {
                val start = if (wasOffhook) callStart else System.currentTimeMillis()
                wasOffhook = false
                // Stop recording immediately on IDLE — before the (delayed) call-log
                // lookup below — so the path is ready to fold into the onCallEnded event.
                val recordingPath = CallLogModule.stopRecordingFromNative()
                // Use applicationContext so the reference stays valid past onReceive()
                val appCtx = context.applicationContext
                // One lookup 2s after IDLE misses on OEM builds that write the call-log row
                // several seconds late — the query finds nothing and the call is then never
                // prompted for. Retry on a backoff until the row actually appears.
                scheduleLookups(appCtx, start, recordingPath)
            }
            newState == TelephonyManager.CALL_STATE_IDLE -> {
                wasOffhook = false
            }
        }

        lastState = newState
    }

    // Fires notifyCallEnded on a backoff, stopping as soon as one attempt reports it handled
    // the call. Each attempt is independent, so a killed process between ticks just means the
    // remaining ticks never run — no state to recover.
    private fun scheduleLookups(appCtx: Context, start: Long, recordingPath: String?) {
        val delaysSec = longArrayOf(1, 2, 4, 7, 12, 20)
        val done = java.util.concurrent.atomic.AtomicBoolean(false)
        delaysSec.forEach { sec ->
            scheduler.schedule({
                if (done.get()) return@schedule
                if (notifyCallEnded(appCtx, start, recordingPath)) done.set(true)
            }, sec, TimeUnit.SECONDS)
        }
    }

    // Returns true when the call was handled (or is definitively not ours), so the caller can
    // stop retrying. Returns false only when there's nothing to act on *yet* — i.e. the
    // call-log row hasn't been written, which is exactly the case worth retrying.
    private fun notifyCallEnded(context: Context, callStartMs: Long, recordingPath: String?): Boolean {
        try {
            val allowed = SimFilter.trackedAccountIds(context)

            val cursor = context.contentResolver.query(
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
                arrayOf((callStartMs - 10_000).toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                // No row yet — the OS hasn't written the call log. This is the one case worth
                // retrying, so report "not handled".
                if (!it.moveToFirst()) return false

                val typeIdx      = it.getColumnIndex(CallLog.Calls.TYPE)
                val numIdx       = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx      = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val durIdx       = it.getColumnIndex(CallLog.Calls.DURATION)
                val dateIdx      = it.getColumnIndex(CallLog.Calls.DATE)
                val accountIdx   = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                // Missing columns are a device-wide fact, not a timing issue — retrying can
                // never change the answer.
                if (typeIdx == -1 || numIdx == -1 || durIdx == -1 || dateIdx == -1) return true

                // ── SIM filter ──────────────────────────────────────────────
                // A row on an untracked SIM is a definitive stop, not a retry — retrying
                // would just re-read this same row until the schedule runs out.
                if (accountIdx != -1 && !SimFilter.matches(allowed, it.getString(accountIdx))) return true
                // ────────────────────────────────────────────────────────────

                val callType = when (it.getInt(typeIdx)) {
                    CallLog.Calls.INCOMING_TYPE -> "incoming"
                    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                    CallLog.Calls.MISSED_TYPE   -> "missed"
                    CallLog.Calls.REJECTED_TYPE -> "rejected"
                    else                        -> "unknown"
                }
                val contactNumber = it.getString(numIdx) ?: ""
                val contactName   = if (nameIdx != -1) it.getString(nameIdx) ?: "" else ""
                val duration      = it.getInt(durIdx)
                val timestamp     = it.getLong(dateIdx)

                val clientCallId = PendingCallStore.clientCallId(contactNumber, timestamp)
                PendingCallStore.enqueue(
                    context,
                    PendingCallStore.PendingCall(
                        clientCallId, contactNumber, contactName, callType, duration, timestamp, recordingPath
                    )
                )

                CallLogModule.emitCallEnded(clientCallId, contactNumber, contactName, callType, duration, timestamp, recordingPath)

                // Surface the prompt from here too. When an OEM task-killer has killed the app
                // process, this manifest-registered receiver is the only thing still running —
                // CallTrackService isn't alive to post it.
                runCatching {
                    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    if (launch != null) CallTrackService.showPopupFallbackNotification(context, launch)
                }
                return true
            }
            // query() returned null (provider unavailable) — treat as retryable.
            return false
        } catch (_: Exception) {
            return true
        }
    }
}
