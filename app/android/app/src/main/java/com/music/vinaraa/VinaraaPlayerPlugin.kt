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
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.common.util.concurrent.ListenableFuture
import okio.buffer
import okio.sink

@CapacitorPlugin(
    name = "VinaraaPlayer",
    permissions = [
        Permission(
            alias = "notifications",
            strings = ["android.permission.POST_NOTIFICATIONS"]
        ),
        Permission(
            alias = "mediaAudio",
            strings = ["android.permission.READ_MEDIA_AUDIO", "android.permission.READ_EXTERNAL_STORAGE"]
        )
    ]
)
class VinaraaPlayerPlugin : Plugin() {

    companion object {
        var onAppReady: (() -> Unit)? = null
    }

    private var player: Player? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var prefs: SharedPreferences? = null
    private val PREFS_NAME = "vinaraa_auth"
    
    private val progressHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var progressRunnable: Runnable? = null

    private var isSeeking = false
    private var currentSource: String? = null
    private var currentContextId: String? = null

    private fun prefs(): SharedPreferences =
        prefs ?: context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).also { prefs = it }

    private val mediaReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: android.content.Intent?) {
            when (intent?.action) {
                PlaybackService.ACTION_NEXT -> {
                    progressHandler.post { notifyListeners("nextTrack", JSObject()) }
                }
                PlaybackService.ACTION_PREVIOUS -> {
                    progressHandler.post { notifyListeners("previousTrack", JSObject()) }
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

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val wantNotifications = call.getBoolean("notifications", true) ?: true
        val wantMedia = call.getBoolean("media", false) ?: false

        if (wantNotifications && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permCallback"); return
        }
        if (wantMedia && getPermissionState("mediaAudio") != PermissionState.GRANTED) {
            requestPermissionForAlias("mediaAudio", call, "permCallback"); return
        }
        call.resolve(JSObject().apply {
            put("notifications", getPermissionState("notifications").toString())
            put("mediaAudio", getPermissionState("mediaAudio").toString())
        })
    }

    @PermissionCallback
    private fun permCallback(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("notifications", getPermissionState("notifications").toString())
            put("mediaAudio", getPermissionState("mediaAudio").toString())
        })
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
                            progressHandler.post {
                                val event = JSObject().apply { put("isPlaying", isPlaying) }
                                notifyListeners("playbackStateChanged", event)
                            }
                        }

                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == Player.STATE_ENDED) {
                                progressHandler.post {
                                    val event = JSObject().apply { put("type", "ended") }
                                    notifyListeners("playbackStateChanged", event)
                                }
                            }
                        }

                        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                            progressHandler.post {
                                val idx = player?.currentMediaItemIndex ?: 0
                                val ret = JSObject().apply {
                                    put("songId", mediaItem?.mediaId)
                                    put("index", idx)
                                    put("isPlaying", player?.isPlaying ?: false)
                                    put("reason", reason)
                                }
                                notifyListeners("songChanged", ret)
                            }
                        }

                        override fun onPositionDiscontinuity(
                            oldPosition: Player.PositionInfo,
                            newPosition: Player.PositionInfo,
                            reason: Int
                        ) {
                            progressHandler.post {
                                val event = JSObject().apply {
                                    put("type", "seeked")
                                    put("positionMs", newPosition.positionMs)
                                    put("reason", reason)
                                }
                                notifyListeners("playbackStateChanged", event)
                            }
                        }

                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            progressHandler.post {
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
        startProgressTicker()
    }
    
    private fun startProgressTicker() {
        progressRunnable = object : Runnable {
            override fun run() {
                player?.let { p ->
                    if (p.isPlaying) {
                        val event = JSObject().apply {
                            put("songId", p.currentMediaItem?.mediaId)
                            put("index", p.currentMediaItemIndex)
                            put("positionMs", p.currentPosition)
                            put("durationMs", if (p.duration == androidx.media3.common.C.TIME_UNSET) -1L else p.duration)
                            put("bufferedMs", p.bufferedPosition)
                            put("state", p.playbackState)
                        }
                        notifyListeners("progress", event)
                    }
                }
                progressHandler.postDelayed(this, 500)
            }
        }
        progressHandler.post(progressRunnable!!)
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
    fun setConfig(call: PluginCall) {
        val apiBase = call.getString("apiBase") ?: return call.reject("apiBase required")
        val deviceId = call.getString("deviceId") ?: return call.reject("deviceId required")
        TrackingClient.init(context, apiBase, deviceId)
        call.resolve()
    }

    @PluginMethod
    fun setPlaybackContext(call: PluginCall) {
        currentSource = call.getString("source")
        currentContextId = call.getString("contextId")
        call.resolve()
    }

    @PluginMethod
    fun setAuth(call: PluginCall) {
        val accessToken = call.getString("accessToken", "")
        prefs().edit()
            .putString("access_token", accessToken)
            .apply()
        call.resolve()
    }

    @PluginMethod
    fun getAccessToken(call: PluginCall) {
        val token = prefs().getString("access_token", null)
        val ret = JSObject().apply {
            put("token", token)
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
                            .setExtras(android.os.Bundle().apply {
                                putString("source", currentSource)
                                putString("contextId", currentContextId)
                            })
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
    fun insertNext(call: PluginCall) {
        val o = call.getObject("item") ?: return call.reject("item required")
        val url = o.optString("streamUrl", "")
        if (url.isEmpty()) return call.reject("streamUrl empty")
        withPlayer { p ->
            val mediaItem = MediaItem.Builder()
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
            val at = if (p.currentMediaItemIndex == androidx.media3.common.C.INDEX_UNSET) 0 else p.currentMediaItemIndex + 1
            p.addMediaItem(at, mediaItem)
        }
        call.resolve()
    }

    @PluginMethod
    fun appendItems(call: PluginCall) {
        val itemsArr = call.getArray("items") ?: return call.reject("items required")
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
        withPlayer { p ->
            p.addMediaItems(built)
        }
        call.resolve()
    }

    @PluginMethod
    fun removeAt(call: PluginCall) {
        val index = call.getInt("index") ?: return call.reject("index required")
        withPlayer { p ->
            p.removeMediaItem(index)
        }
        call.resolve()
    }

    @PluginMethod
    fun moveItem(call: PluginCall) {
        val from = call.getInt("from") ?: return call.reject("from required")
        val to = call.getInt("to") ?: return call.reject("to required")
        withPlayer { p ->
            p.moveMediaItem(from, to)
        }
        call.resolve()
    }

    @PluginMethod
    fun skipToIndex(call: PluginCall) {
        val index = call.getInt("index") ?: return call.reject("index required")
        withPlayer { p ->
            p.seekToDefaultPosition(index)
        }
        call.resolve()
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) {
        val shuffle = call.getBoolean("shuffle", false) ?: false
        withPlayer { p ->
            p.shuffleModeEnabled = shuffle
        }
        call.resolve()
    }

    @PluginMethod
    fun getQueue(call: PluginCall) {
        withPlayer { p ->
            val arr = com.getcapacitor.JSArray()
            for (i in 0 until p.mediaItemCount) {
                arr.put(p.getMediaItemAt(i).mediaId)
            }
            val ret = JSObject().apply {
                put("currentIndex", p.currentMediaItemIndex)
                put("items", arr)
            }
            activity?.runOnUiThread { call.resolve(ret) }
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        withPlayer { p ->
            p.clearMediaItems()
        }
        call.resolve()
    }

    @PluginMethod
    fun appReady(call: PluginCall) {
        onAppReady?.invoke()
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
                .setExtras(android.os.Bundle().apply {
                    putString("source", currentSource)
                    putString("contextId", currentContextId)
                })
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
            Thread {
                try {
                    val client = okhttp3.OkHttpClient()
                    val req = okhttp3.Request.Builder().url(url).build()
                    val response = client.newCall(req).execute()
                    
                    if (!response.isSuccessful) {
                        throw Exception("HTTP ${response.code}")
                    }

                    val musicDir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_MUSIC)
                    if (musicDir != null && !musicDir.exists()) musicDir.mkdirs()
                    
                    val file = java.io.File(musicDir, fileName)
                    val sink = file.sink().buffer()
                    sink.writeAll(response.body!!.source())
                    sink.close()
                    response.close()

                    val ret = JSObject().apply {
                        put("downloadId", 1)
                        put("status", "completed")
                        put("path", file.absolutePath)
                    }
                    activity?.runOnUiThread { call.resolve(ret) }
                } catch (e: Exception) {
                    activity?.runOnUiThread { call.reject("Download failed: " + e.message, e) }
                }
            }.start()
        }
    }

    override fun handleOnDestroy() {
        try {
            context.unregisterReceiver(mediaReceiver)
        } catch (_: Exception) { }
        progressRunnable?.let { progressHandler.removeCallbacks(it) }
        controllerFuture?.let { MediaController.releaseFuture(it) }
        player = null
        super.handleOnDestroy()
    }
}
