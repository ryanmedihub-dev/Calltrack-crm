package com.calltrack.app

import android.content.Context
import android.os.Build
import android.telecom.TelecomManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager

// Single place that decides whether a call-log row belongs to the tracked SIM.
//
// CallLog.PHONE_ACCOUNT_ID is NOT reliably the subscription ID: depending on OEM/Android version
// it's the subId, the ICCID, or (MIUI) the slot index. The old check compared it against
// subId OR slotIndex as plain strings, and with the very common layout SIM1 = sub 1 / slot 0,
// SIM2 = sub 2 / slot 1, tracking SIM2 also accepted "1" — i.e. every SIM1 call.
object SimFilter {

    // null = track all SIMs.
    fun accountIdsFor(ctx: Context, subId: Int, slot: Int): Set<String>? {
        if (subId == -1) return null

        // Authoritative on API 30+: ask Telecom which phone-account handles map to this subId.
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                val telecom = ctx.getSystemService(TelecomManager::class.java)
                val tel     = ctx.getSystemService(TelephonyManager::class.java)
                val ids = telecom.callCapablePhoneAccounts
                    .filter { tel.getSubscriptionId(it) == subId }
                    .map { it.id }
                    .toSet()
                if (ids.isNotEmpty()) return ids
            } catch (_: Exception) {}
        }

        // Heuristic fallback for older devices.
        val active = try {
            ctx.getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList
        } catch (_: Exception) { null }.orEmpty()

        val ids = mutableSetOf(subId.toString())
        @Suppress("DEPRECATION")
        active.find { it.subscriptionId == subId }?.iccId?.takeIf { it.isNotEmpty() }?.let { ids += it }
        // MIUI slot-index format — only when it can't be mistaken for another SIM's subId.
        val otherSubIds = active.filter { it.subscriptionId != subId }.map { it.subscriptionId.toString() }
        if (slot != -1 && slot.toString() !in otherSubIds) ids += slot.toString()
        return ids
    }

    fun trackedAccountIds(ctx: Context): Set<String>? {
        val prefs = ctx.getSharedPreferences("CallTrackPrefs", Context.MODE_PRIVATE)
        return accountIdsFor(ctx, prefs.getInt("tracked_sub_id", -1), prefs.getInt("tracked_sim_slot", -1))
    }

    // accountId null = row has no account (VoIP etc.) → not on the tracked SIM.
    fun matches(allowed: Set<String>?, accountId: String?): Boolean =
        allowed == null || (accountId != null && accountId in allowed)
}
