package com.calltrack.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme)
        super.onCreate(null)
        startCallTrackService()
    }

    override fun onResume() {
        super.onResume()
        // Fire at multiple delays — JS bridge takes 2-3s on fresh start.
        // Event is idempotent so firing multiple times is safe.
        // JS side ignores duplicates via isHandlingRef guard.
        listOf(800L, 1500L, 2500L, 4000L).forEach { delay ->
            Handler(Looper.getMainLooper()).postDelayed({
                if (PendingCallStore.hasPending(applicationContext)) {
                    CallLogModule.emitPendingCallAvailable()
                }
            }, delay)
        }
    }

    private fun startCallTrackService() {
        try {
            val intent = Intent(this, CallTrackService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (_: Exception) {}
    }

    override fun getMainComponentName(): String = "main"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {}
        )
    }

    override fun invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                super.invokeDefaultOnBackPressed()
            }
            return
        }
        super.invokeDefaultOnBackPressed()
    }
}
