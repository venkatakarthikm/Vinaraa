package com.vinaraa.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(VinaraaPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
