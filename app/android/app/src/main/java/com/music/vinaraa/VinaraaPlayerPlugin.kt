package com.music.vinaraa

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.common.util.concurrent.ListenableFuture

@CapacitorPlugin(name = "VinaraaPlayer")
class VinaraaPlayerPlugin : Plugin() {

    private var player: Player? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var prefs: SharedPreferences? = null
    private val PREFS_NAME = "vinaraa_auth"

    private var isSeeking = false

    private fun prefs(): SharedPreferences =
        prefs ?: context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).also { prefs = it }

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

                        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                            activity?.runOnUiThread {
                                val idx = player?.currentMediaItemIndex ?: 0
                                val ret = JSObject().apply {
                                    put("songId", mediaItem?.mediaId)
                                    put("index", idx)
                                    put("isPlaying", player?.isPlaying ?: false)
                                }
                                notifyListeners("songChanged", ret)
                            }
                        }

                        override fun onPositionDiscontinuity(
                            oldPosition: Player.PositionInfo,
                            newPosition: Player.PositionInfo,
                            reason: Int
                        ) {
                            if (reason == Player.DISCONTINUITY_REASON_SEEK && !isSeeking) {
                                val seekMs = newPosition.positionMs
                                activity?.runOnUiThread {
                                    val event = JSObject().apply {
                                        put("type", "seeked")
                                        put("positionMs", seekMs)
                                    }
                                    notifyListeners("playbackStateChanged", event)
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
                    // Controller not ready yet
                }
            },
            ContextCompat.getMainExecutor(context)
        )
    }

    private fun withPlayer(action: (Player) -> Unit) {
        val p = player
        if (p != null) {
            activity?.runOnUiThread {
                try {
                    action(p)
                } catch (e: Exception) {
                    initPlayer()
                }
            }
        } else {
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

    private fun isInternetAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    @PluginMethod
    fun isOnline(call: PluginCall) {
        val ret = JSObject().apply {
            put("isOnline", isInternetAvailable())
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun checkIntent(call: PluginCall) {
        val intent = activity?.intent
        val openPlayer = intent?.getBooleanExtra("OPEN_PLAYER", false) ?: false
        if (openPlayer) {
            intent?.removeExtra("OPEN_PLAYER")
        }
        val ret = JSObject().apply {
            put("openPlayer", openPlayer)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun setAuth(call: PluginCall) {
        val accessToken = call.getString("accessToken", "")
        val refreshToken = call.getString("refreshToken", "")
        prefs().edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken)
            .apply()
        call.resolve()
    }

    @PluginMethod
    fun getAccessToken(call: PluginCall) {
        val token = prefs().getString("access_token", null)
        val refreshToken = prefs().getString("refresh_token", null)
        val ret = JSObject().apply {
            put("token", token)
            put("refreshToken", refreshToken)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun setQueue(call: PluginCall) {
        val itemsArr = call.getArray("items") ?: return call.reject("items required")
        val startIndex = call.getInt("startIndex", 0) ?: 0
        val repeatMode = call.getString("repeatMode", "off") ?: "off"
        val positionMs = call.getLong("positionMs") ?: call.getInt("positionMs")?.toLong() ?: 0L
        val autoPlay = call.getBoolean("play", true) ?: true
        val built = ArrayList<MediaItem>()
        for (i in 0 until itemsArr.length()) {
            val o = itemsArr.getJSONObject(i)
            val url = o.optString("streamUrl", "")
            if (url.isEmpty()) continue
            built.add(
                MediaItem.Builder()
                    .setUri(url)
                    .setMediaId(o.optString("songId", ""))
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle(o.optString("title", ""))
                            .setArtist(o.optString("artist", ""))
                            .setArtworkUri(o.optString("artwork", "").takeIf { it.isNotEmpty() }?.let(Uri::parse))
                            .build()
                    )
                    .build()
            )
        }
        if (built.isEmpty()) return call.reject("no playable items")
        withPlayer { p ->
            p.repeatMode = when (repeatMode) {
                "one" -> Player.REPEAT_MODE_ONE
                "all" -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
            p.setMediaItems(built, startIndex.coerceIn(0, built.size - 1), positionMs)
            p.prepare()
            if (autoPlay) {
                p.play()
            } else {
                p.pause()
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val streamUrl = call.getString("streamUrl")?.takeIf { it.isNotBlank() }
            ?: return call.reject("streamUrl is required")

        val title = call.getString("title")
        val artist = call.getString("artist")
        val artwork = call.getString("artwork")

        withPlayer { p ->
            val metadata = MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setArtworkUri(if (artwork != null) Uri.parse(artwork) else null)
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
        val positionMs = call.getLong("positionMs")
            ?: call.getDouble("positionMs")?.toLong()
            ?: call.getInt("positionMs")?.toLong()
            ?: 0L
        withPlayer { p ->
            isSeeking = true
            if (p.playbackState == Player.STATE_IDLE || p.playbackState == Player.STATE_ENDED) {
                p.prepare()
            }
            p.seekTo(positionMs)
            activity?.window?.decorView?.postDelayed({ isSeeking = false }, 500)
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
                val d = p.duration
                ret.put("durationMs", if (d == androidx.media3.common.C.TIME_UNSET || d <= 0L) -1L else d)
                ret.put("bufferedMs", p.bufferedPosition)
                ret.put("songId", p.currentMediaItem?.mediaId)
                call.resolve(ret)
            }
        } else {
            val ret = JSObject()
            ret.put("isPlaying", false)
            ret.put("positionMs", 0L)
            ret.put("durationMs", -1L)
            ret.put("bufferedMs", 0L)
            ret.put("songId", null as String?)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun next(call: PluginCall) {
        withPlayer { p ->
            p.seekToNextMediaItem()
            p.play()
        }
        call.resolve()
    }

    @PluginMethod
    fun previous(call: PluginCall) {
        withPlayer { p ->
            p.seekToPreviousMediaItem()
            p.play()
        }
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

        activity?.runOnUiThread {
            try {
                val request = android.app.DownloadManager.Request(Uri.parse(url))
                    .setTitle(title)
                    .setDescription("Downloading $title...")
                    .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_MUSIC, fileName)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)

                val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
                val downloadId = downloadManager.enqueue(request)

                val ret = JSObject().apply {
                    put("downloadId", downloadId)
                    put("status", "enqueued")
                }
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Download failed: " + e.message, e)
            }
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
