package com.music.vinaraa

import android.content.Context
import android.content.SharedPreferences
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
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

    // Track the last seek position received from notification to avoid loop
    private var lastNotificationSeekMs: Long = -1

    private val mediaReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: android.content.Intent?) {
            when (intent?.action) {
                PlaybackService.ACTION_NEXT -> {
                    activity?.runOnUiThread { notifyListeners("nextTrack", JSObject()) }
                }
                PlaybackService.ACTION_PREVIOUS -> {
                    activity?.runOnUiThread { notifyListeners("previousTrack", JSObject()) }
                }
            }
        }
    }

    override fun load() {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        initPlayer()

        val filter = android.content.IntentFilter().apply {
            addAction(PlaybackService.ACTION_NEXT)
            addAction(PlaybackService.ACTION_PREVIOUS)
        }
        ContextCompat.registerReceiver(context, mediaReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    private fun initPlayer() {
        val sessionToken = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture?.addListener(
            Runnable {
                try {
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

                        override fun onPositionDiscontinuity(
                            oldPosition: Player.PositionInfo,
                            newPosition: Player.PositionInfo,
                            reason: Int
                        ) {
                            // Fired when user seeks from the notification/lock screen
                            if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                                val seekMs = newPosition.positionMs
                                // Only forward to JS if it came from notification (not from our own seekTo call)
                                if (kotlin.math.abs(seekMs - lastNotificationSeekMs) > 200) {
                                    activity?.runOnUiThread {
                                        val event = JSObject().apply {
                                            put("type", "seeked")
                                            put("positionMs", seekMs)
                                        }
                                        notifyListeners("playbackStateChanged", event)
                                    }
                                }
                            }
                        }

                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            activity?.runOnUiThread {
                                val event = JSObject().apply { put("error", error.message) }
                                notifyListeners("error", event)
                            }
                        }
                    })
                } catch (e: Exception) {
                    // Controller not ready yet, will retry on next call via withPlayer
                }
            },
            ContextCompat.getMainExecutor(context)
        )
    }

    private fun withPlayer(action: (Player) -> Unit) {
        val p = player
        if (p != null && p.isCommandAvailable(Player.COMMAND_PLAY_PAUSE)) {
            activity?.runOnUiThread { action(p) }
        } else {
            // Player not ready or controller lost — re-init and retry once
            if (controllerFuture == null || controllerFuture?.isDone == true) {
                initPlayer()
            }
            controllerFuture?.addListener(
                Runnable {
                    try {
                        val controller = controllerFuture?.get()
                        if (controller != null) {
                            player = controller
                            activity?.runOnUiThread { action(controller) }
                        }
                    } catch (e: Exception) { }
                },
                ContextCompat.getMainExecutor(context)
            )
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

        val title = call.getString("title")
        val artist = call.getString("artist")
        val artwork = call.getString("artwork")

        withPlayer { p ->
            val metadata = MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setArtworkUri(if (artwork != null) android.net.Uri.parse(artwork) else null)
                .build()

            val mediaItem = MediaItem.Builder()
                .setUri(streamUrl)
                .setMediaMetadata(metadata)
                .build()

            p.setMediaItem(mediaItem)
            p.prepare()
            p.play()
        }
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        withPlayer { p -> p.pause() }
        call.resolve()
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        withPlayer { p ->
            // If player ended or is idle, it needs prepare before play
            if (p.playbackState == Player.STATE_IDLE || p.playbackState == Player.STATE_ENDED) {
                p.prepare()
            }
            p.play()
        }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        withPlayer { p -> p.stop() }
        call.resolve()
    }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionMs = call.getLong("positionMs", 0L) ?: 0L
        lastNotificationSeekMs = positionMs
        withPlayer { p ->
            // If player ended/idle, prepare it first so seek works
            if (p.playbackState == Player.STATE_IDLE || p.playbackState == Player.STATE_ENDED) {
                p.prepare()
            }
            p.seekTo(positionMs)
        }
        call.resolve()
    }

    @PluginMethod
    fun setRepeatMode(call: PluginCall) {
        val mode = call.getString("mode", "off")
        withPlayer { p ->
            p.repeatMode = when (mode) {
                "one" -> Player.REPEAT_MODE_ONE
                "all" -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        val p = player
        if (p != null) {
            activity?.runOnUiThread {
                val ret = JSObject()
                ret.put("isPlaying", p.isPlaying)
                ret.put("positionMs", p.currentPosition)
                ret.put("durationMs", p.duration.coerceAtLeast(0L))
                ret.put("bufferedMs", p.bufferedPosition)
                ret.put("songId", null as String?)
                call.resolve(ret)
            }
        } else {
            // Return zeros if player not ready yet
            val ret = JSObject()
            ret.put("isPlaying", false)
            ret.put("positionMs", 0L)
            ret.put("durationMs", 0L)
            ret.put("bufferedMs", 0L)
            ret.put("songId", null as String?)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun next(call: PluginCall) {
        withPlayer { p -> p.seekToNextMediaItem() }
        call.resolve()
    }

    @PluginMethod
    fun previous(call: PluginCall) {
        withPlayer { p -> p.seekToPreviousMediaItem() }
        call.resolve()
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val volume = call.getFloat("volume", 1.0f) ?: 1.0f
        withPlayer { p -> p.volume = volume }
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
        try {
            context.unregisterReceiver(mediaReceiver)
        } catch (_: Exception) { }
        controllerFuture?.let { MediaController.releaseFuture(it) }
        player = null
        super.handleOnDestroy()
    }
}
