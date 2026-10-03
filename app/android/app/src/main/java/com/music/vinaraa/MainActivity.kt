package com.music.vinaraa

import android.graphics.Color
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.getcapacitor.BridgeActivity
import com.music.vinaraa.widget.WidgetStatsWorker
import java.util.concurrent.TimeUnit

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        registerPlugin(VinaraaPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
        
        var keep = true
        splash.setKeepOnScreenCondition { keep }
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ keep = false }, 2500)
        VinaraaPlayerPlugin.onAppReady = { keep = false }

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val req = PeriodicWorkRequestBuilder<WidgetStatsWorker>(30, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "vinaraa_widget_stats", ExistingPeriodicWorkPolicy.KEEP, req)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
