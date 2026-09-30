package com.vinaraa.app

import android.content.Context
import android.content.SharedPreferences
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "VinaraaPlayer")
class VinaraaPlayerPlugin : Plugin() {

    private var player: ExoPlayer? = null
    private var prefs: SharedPreferences? = null
    private val PREFS_NAME = "vinaraa_auth"

    override fun load() {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        initPlayer()
    }

    private fun initPlayer() {
        player = ExoPlayer.Builder(context).build().also { exo ->
            exo.addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    val event = JSObject().apply {
                        put("isPlaying", isPlaying)
                    }
                    notifyListeners("playbackStateChanged", event)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        val event = JSObject().apply { put("type", "ended") }
                        notifyListeners("playbackStateChanged", event)
                    }
                }
            })
        }
    }

    @PluginMethod
    fun setAuth(call: PluginCall) {
        val accessToken = call.getString("accessToken", "")
        val refreshToken = call.getString("refreshToken", "")
        prefs?.edit()
            ?.putString("access_token", accessToken)
            ?.putString("refresh_token", refreshToken)
            ?.apply()
        call.resolve()
    }

    @PluginMethod
    fun getAccessToken(call: PluginCall) {
        val token = prefs?.getString("access_token", null)
        val ret = JSObject()
        ret.put("token", token)
        call.resolve(ret)
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val streamUrl = call.getString("streamUrl") ?: run {
            call.reject("streamUrl is required")
            return
        }
        val songId = call.getString("songId", "")
        val title = call.getString("title", "")
        val artist = call.getString("artist", "")

        activity.runOnUiThread {
            val token = prefs?.getString("access_token", null)
            val headers = if (token != null) {
                mapOf("Authorization" to "Bearer $token")
            } else emptyMap()

            val mediaItem = MediaItem.fromUri(streamUrl)
            player?.run {
                setMediaItem(mediaItem)
                prepare()
                play()
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        activity.runOnUiThread { player?.pause() }
        call.resolve()
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        activity.runOnUiThread { player?.play() }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread { player?.stop() }
        call.resolve()
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionMs = call.getLong("positionMs", 0L) ?: 0L
        activity.runOnUiThread { player?.seekTo(positionMs) }
        call.resolve()
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        val ret = JSObject()
        val p = player
        if (p != null) {
            ret.put("isPlaying", p.isPlaying)
            ret.put("positionMs", p.currentPosition)
            ret.put("durationMs", p.duration.coerceAtLeast(0L))
            ret.put("bufferedMs", p.bufferedPosition)
        } else {
            ret.put("isPlaying", false)
            ret.put("positionMs", 0)
            ret.put("durationMs", 0)
            ret.put("bufferedMs", 0)
        }
        ret.put("songId", null as String?)
        call.resolve(ret)
    }

    @PluginMethod
    fun next(call: PluginCall) {
        activity.runOnUiThread { player?.seekToNextMediaItem() }
        call.resolve()
    }

    @PluginMethod
    fun previous(call: PluginCall) {
        activity.runOnUiThread { player?.seekToPreviousMediaItem() }
        call.resolve()
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val volume = call.getFloat("volume", 1.0f) ?: 1.0f
        activity.runOnUiThread { player?.volume = volume }
        call.resolve()
    }

    override fun handleOnDestroy() {
        player?.release()
        player = null
        super.handleOnDestroy()
    }
}
