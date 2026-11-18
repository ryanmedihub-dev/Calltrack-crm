package com.calltrack.app

import android.content.pm.PackageManager
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class SimInfoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SimInfoModule"

    @ReactMethod
    fun getAvailableSims(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            if (ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.READ_PHONE_STATE)
                != PackageManager.PERMISSION_GRANTED) {
                promise.resolve(Arguments.createArray())
                return
            }

            val sm = ctx.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                    as? SubscriptionManager
            val subs = sm?.activeSubscriptionInfoList

            val result = Arguments.createArray()
            subs?.forEach { sub ->
                val map = Arguments.createMap().apply {
                    putInt("subscriptionId", sub.subscriptionId)
                    putString("displayName",  sub.displayName?.toString() ?: "SIM ${sub.simSlotIndex + 1}")
                    putString("carrierName",  sub.carrierName?.toString() ?: "")
                    putInt("slotIndex",       sub.simSlotIndex)
                    putString("number",       sub.number ?: "")
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_SIM_ERROR", e.message, e)
        }
    }
}
