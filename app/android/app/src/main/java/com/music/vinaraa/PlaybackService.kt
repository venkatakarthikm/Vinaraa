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
    private val heartbeatHandler = Handler(Looper.getMainLooper())
    private var heartbeatRunnable: Runnable? = null

    companion object {
        const val ACTION_NEXT = "com.music.vinaraa.ACTION_NEXT"
        const val ACTION_PREVIOUS = "com.music.vinaraa.ACTION_PREVIOUS"
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

        setupTrackingListener(rawPlayer)
    }

    private fun setupTrackingListener(player: ExoPlayer) {
        heartbeatRunnable = object : Runnable {
            override fun run() {
                val sid = currentSessionId
                if (sid != null && player.isPlaying) {
                    TrackingClient.heartbeat(
                        sessionId = sid,
                        positionMs = player.currentPosition,
                        state = "playing",
                        bufferedMs = player.bufferedPosition
                    )
                }
                heartbeatHandler.postDelayed(this, 12000)
            }
        }

        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                // End old session
                val oldSid = currentSessionId
                if (oldSid != null) {
                    TrackingClient.endSession(oldSid, lastKnownPositionMs)
                    currentSessionId = null
                }
                
                // Start new session
                val songId = mediaItem?.mediaId
                if (songId != null && songId.isNotEmpty()) {
                    TrackingClient.startSession(
                        songId = songId,
                        source = mediaItem.mediaMetadata.extras?.getString("source"),
                        contextId = mediaItem.mediaMetadata.extras?.getString("contextId")
                    ) { sid ->
                        currentSessionId = sid
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
                
                if (isPlaying) {
                    heartbeatHandler.postDelayed(heartbeatRunnable!!, 12000)
                } else {
                    heartbeatHandler.removeCallbacks(heartbeatRunnable!!)
                }
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
                        TrackingClient.heartbeat(
                            sessionId = sid,
                            positionMs = player.currentPosition,
                            state = "ended",
                            bufferedMs = player.bufferedPosition
                        )
                        TrackingClient.endSession(sid, player.currentPosition)
                        currentSessionId = null
                    }
                }
            }
        })
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onDestroy() {
        heartbeatRunnable?.let { heartbeatHandler.removeCallbacks(it) }
        currentSessionId?.let { sid ->
            exoPlayer?.let { p ->
                TrackingClient.endSession(sid, p.currentPosition)
            }
        }
        mediaSession?.run {
            exoPlayer?.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
