package com.music.vinaraa

import android.graphics.Color
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(VinaraaPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.setDecorFitsSystemWindows(window, false)

        checkOpenPlayerIntent(intent)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        checkOpenPlayerIntent(intent)
    }

    private fun checkOpenPlayerIntent(intent: android.content.Intent?) {
        val openPlayer = intent?.getBooleanExtra("OPEN_PLAYER", false) ?: false
        if (openPlayer) {
            intent?.removeExtra("OPEN_PLAYER")
            bridge?.triggerJSEvent("openPlayerIntent", "window")
        }
    }
}
