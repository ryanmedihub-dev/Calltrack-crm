package com.calltrack.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

// Single source of truth for the "call just ended, waiting for the user to log it" queue.
// Both CallTrackService (ContentObserver, ~500ms delay) and PhoneStateReceiver (manifest
// broadcast, 2s delay) independently detect the same call ending and both call enqueue() here —
// previously each wrote into its own flat pending_* SharedPreferences keys, so the second write
// silently clobbered the first before JS ever read it. This stores a real JSON array under one
// key so a second (or third) call ending before the first is cleared is queued, not lost.
object PendingCallStore {

    private const val PREFS_NAME = "CallTrackPrefs"
    private const val QUEUE_KEY  = "pending_calls_queue"
    private const val MAX_QUEUE_SIZE = 50
    // Mirrors AUTO_SKIP_MS on the JS side (PostCallScreen's popup lifetime) — an entry older
    // than this will never be shown as a timely popup anyway, and the call itself already
    // reached Call Logs via the normal sync path, so nothing is lost by dropping it silently.
    private const val EXPIRY_MS = 2 * 60 * 1000L

    data class PendingCall(
        val clientCallId: String,
        val number: String,
        val name: String,
        val type: String,
        val duration: Int,
        val timestamp: Long,
        val recordingPath: String?,
    )

    // Deterministic (not random) so every code path that reads the same call-log row —
    // ContentObserver, PhoneStateReceiver, and the bulk getCallLogsSince sync read — computes
    // the identical id with no shared mutable state, letting it double as a stable dedup key.
    fun clientCallId(number: String, timestamp: Long): String =
        UUID.nameUUIDFromBytes("$number|$timestamp".toByteArray()).toString()

    @Synchronized
    fun enqueue(context: Context, call: PendingCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = readQueue(prefs)

            var merged = false
            for (i in 0 until arr.length()) {
                val existing = arr.getJSONObject(i)
                if (existing.optString("clientCallId") == call.clientCallId) {
                    // Same physical call detected by both paths — merge instead of duplicating.
                    val existingDuration = existing.optInt("duration", 0)
                    val existingPath = existing.optString("recordingPath", "")
                    existing.put("duration", maxOf(existingDuration, call.duration))
                    val bestPath = if (!call.recordingPath.isNullOrEmpty()) call.recordingPath else existingPath
                    existing.put("recordingPath", bestPath)
                    merged = true
                    break
                }
            }

            if (!merged) {
                arr.put(toJson(call))
            }

            // Drop oldest entries beyond the cap rather than growing unbounded.
            val capped = if (arr.length() > MAX_QUEUE_SIZE) {
                val trimmed = JSONArray()
                val dropCount = arr.length() - MAX_QUEUE_SIZE
                for (i in dropCount until arr.length()) trimmed.put(arr.getJSONObject(i))
                trimmed
            } else arr

            writeQueue(prefs, capped)
        } catch (_: Exception) {}
    }

    @Synchronized
    fun hasPending(context: Context): Boolean = peekOldest(context) != null

    @Synchronized
    fun peekOldest(context: Context): PendingCall? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var arr = readQueue(prefs)
            // Drop any entries older than the popup's own auto-skip window — they'll never be
            // shown as a timely popup anyway, and the call itself is already in the call log via
            // the normal sync path, so nothing is lost by not surfacing a stale reminder for it.
            val now = System.currentTimeMillis()
            var changed = false
            while (arr.length() > 0 && now - arr.getJSONObject(0).optLong("timestamp", 0L) > EXPIRY_MS) {
                val trimmed = JSONArray()
                for (i in 1 until arr.length()) trimmed.put(arr.getJSONObject(i))
                arr = trimmed
                changed = true
            }
            if (changed) writeQueue(prefs, arr)
            if (arr.length() == 0) null else fromJson(arr.getJSONObject(0))
        } catch (_: Exception) { null }
    }

    @Synchronized
    fun removeOldest(context: Context) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = readQueue(prefs)
            if (arr.length() == 0) return
            val remaining = JSONArray()
            for (i in 1 until arr.length()) remaining.put(arr.getJSONObject(i))
            writeQueue(prefs, remaining)
        } catch (_: Exception) {}
    }

    private fun readQueue(prefs: android.content.SharedPreferences): JSONArray {
        val raw = prefs.getString(QUEUE_KEY, null) ?: return JSONArray()
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    private fun writeQueue(prefs: android.content.SharedPreferences, arr: JSONArray) {
        prefs.edit().putString(QUEUE_KEY, arr.toString()).apply()
    }

    private fun toJson(call: PendingCall): JSONObject = JSONObject().apply {
        put("clientCallId", call.clientCallId)
        put("number", call.number)
        put("name", call.name)
        put("type", call.type)
        put("duration", call.duration)
        put("timestamp", call.timestamp)
        put("recordingPath", call.recordingPath ?: "")
    }

    private fun fromJson(o: JSONObject): PendingCall = PendingCall(
        clientCallId  = o.optString("clientCallId", ""),
        number        = o.optString("number", ""),
        name          = o.optString("name", ""),
        type          = o.optString("type", ""),
        duration      = o.optInt("duration", 0),
        timestamp     = o.optLong("timestamp", 0L),
        recordingPath = o.optString("recordingPath", ""),
    )
}
