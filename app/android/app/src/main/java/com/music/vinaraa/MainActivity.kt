package com.music.vinaraa

import android.graphics.Color
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = androidx.core.splashscreen.SplashScreen.installSplashScreen(this)
        registerPlugin(VinaraaPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
        
        var keep = true
        splash.setKeepOnScreenCondition { keep }
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ keep = false }, 2500)
        VinaraaPlayerPlugin.onAppReady = { keep = false }

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.setDecorFitsSystemWindows(window, false)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
