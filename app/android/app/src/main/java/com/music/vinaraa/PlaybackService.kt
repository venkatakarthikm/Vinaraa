package com.music.vinaraa

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
    private var exoPlayer: ExoPlayer? = null

    private var currentSessionId: String? = null
    private var lastKnownPositionMs: Long = 0L
    private var previousDurationMs: Long = 0L
    private val heartbeatHandler = Handler(Looper.getMainLooper())
    private var heartbeatRunnable: Runnable? = null

    companion object {
        const val ACTION_NEXT = "com.music.vinaraa.ACTION_NEXT"
        const val ACTION_PREVIOUS = "com.music.vinaraa.ACTION_PREVIOUS"
        @JvmStatic
        var activeSessionId: String? = null
    }

    override fun onCreate() {
        super.onCreate()
        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        val rawPlayer = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(audioAttributes, true)
            setWakeMode(C.WAKE_MODE_NETWORK)
        }
        exoPlayer = rawPlayer

        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("OPEN_PLAYER", true)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, rawPlayer)
            .setSessionActivity(pendingIntent)
            .build()

        TrackingClient.ensureInitialized(this)
        setupTrackingListener(rawPlayer)
    }

    private fun setupTrackingListener(player: ExoPlayer) {
        // ONE always-running 10 s ticker. It self-checks every condition so it can never be
        // "not started" because of a race between playback start and async HTTP session creation.
        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (player.isPlaying) lastKnownPositionMs = player.currentPosition
                val sid = currentSessionId
                if (sid != null && player.isPlaying) {
                    TrackingClient.heartbeat(
                        sessionId = sid,
                        positionMs = player.currentPosition,
                        state = "playing",
                        bufferedMs = player.bufferedPosition
                    )
                }
                heartbeatHandler.postDelayed(this, 10_000)
            }
        }
        heartbeatHandler.post(heartbeatRunnable!!)

        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                // 1) Close the OUTGOING session with its TRUE final position.
                val oldSid = currentSessionId
                if (oldSid != null) {
                    val exitPos = when (reason) {
                        Player.MEDIA_ITEM_TRANSITION_REASON_AUTO,
                        Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT ->
                            maxOf(lastKnownPositionMs, previousDurationMs)
                        else -> maxOf(lastKnownPositionMs, player.currentPosition)
                    }
                    TrackingClient.heartbeat(oldSid, exitPos, "ended", player.bufferedPosition)
                    TrackingClient.endSession(oldSid, exitPos)
                    currentSessionId = null
                    activeSessionId = null
                }
                lastKnownPositionMs = 0L

                // 2) Open the NEW session.
                val songId = mediaItem?.mediaId
                if (!songId.isNullOrEmpty()) {
                    val src = mediaItem.mediaMetadata.extras?.getString("source") ?: "unknown"
                    val ctx = mediaItem.mediaMetadata.extras?.getString("contextId")
                    previousDurationMs = mediaItem.mediaMetadata.durationMs ?: 0L
                    TrackingClient.startSession(songId, src, ctx) { sid ->
                        currentSessionId = sid
                        activeSessionId = sid
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val sid = currentSessionId ?: return
                TrackingClient.heartbeat(
                    sessionId = sid,
                    positionMs = player.currentPosition,
                    state = if (isPlaying) "playing" else "paused",
                    bufferedMs = player.bufferedPosition
                )
            }

            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                lastKnownPositionMs = newPosition.positionMs
                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    currentSessionId?.let { sid ->
                        TrackingClient.heartbeat(
                            sessionId = sid,
                            positionMs = player.currentPosition,
                            state = if (player.isPlaying) "playing" else "paused",
                            bufferedMs = player.bufferedPosition
                        )
                    }
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    currentSessionId?.let { sid ->
                        val endPos = maxOf(player.currentPosition, previousDurationMs)
                        TrackingClient.heartbeat(sid, endPos, "ended", player.bufferedPosition)
                        TrackingClient.endSession(sid, endPos)
                        currentSessionId = null
                        activeSessionId = null
                    }
                }
            }
        })
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = exoPlayer
        if (p == null || !p.isPlaying) {
            currentSessionId?.let { TrackingClient.endSession(it, p?.currentPosition ?: 0L) }
            currentSessionId = null
            activeSessionId = null
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        heartbeatRunnable?.let { heartbeatHandler.removeCallbacks(it) }
        currentSessionId?.let { sid ->
            exoPlayer?.let { p ->
                TrackingClient.endSession(sid, p.currentPosition)
            }
            activeSessionId = null
        }
        mediaSession?.run {
            exoPlayer?.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
