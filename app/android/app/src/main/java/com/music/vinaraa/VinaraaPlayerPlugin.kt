package com.music.vinaraa

import android.content.Context
import android.content.SharedPreferences
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import android.content.ComponentName
import androidx.core.content.ContextCompat
import com.google.common.util.concurrent.ListenableFuture
import androidx.media3.common.MediaMetadata

@CapacitorPlugin(name = "VinaraaPlayer")
class VinaraaPlayerPlugin : Plugin() {

    private var player: Player? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var prefs: SharedPreferences? = null
    private val PREFS_NAME = "vinaraa_auth"

    override fun load() {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        initPlayer()
    }

    private fun initPlayer() {
        val sessionToken = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture?.addListener(
            Runnable {
                val controller = controllerFuture?.get()
                player = controller
                controller?.addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        activity?.runOnUiThread {
                            val event = JSObject().apply { put("isPlaying", isPlaying) }
                            notifyListeners("playbackStateChanged", event)
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED) {
                            activity?.runOnUiThread {
                                val event = JSObject().apply { put("type", "ended") }
                                notifyListeners("playbackStateChanged", event)
                            }
                        }
                    }
                })
            },
            ContextCompat.getMainExecutor(context)
        )
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

        val title = call.getString("title")
        val artist = call.getString("artist")
        val artwork = call.getString("artwork")

        activity.runOnUiThread {
            val metadata = MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setArtworkUri(if (artwork != null) android.net.Uri.parse(artwork) else null)
                .build()

            val mediaItem = MediaItem.Builder()
                .setUri(streamUrl)
                .setMediaMetadata(metadata)
                .build()
                
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

    @PluginMethod
    fun download(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("url is required")
        val title = call.getString("title") ?: "Download"
        val fileName = call.getString("fileName") ?: "download.mp3"

        try {
            val request = android.app.DownloadManager.Request(android.net.Uri.parse(url))
                .setTitle(title)
                .setDescription("Downloading...")
                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_MUSIC, fileName)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
            val downloadId = downloadManager.enqueue(request)

            val ret = JSObject()
            ret.put("downloadId", downloadId)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Download failed", e)
        }
    }

    override fun handleOnDestroy() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        player = null
        super.handleOnDestroy()
    }
}
