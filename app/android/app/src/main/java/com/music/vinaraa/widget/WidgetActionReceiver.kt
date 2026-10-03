package com.music.vinaraa.widget

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.music.vinaraa.PlaybackService

class WidgetActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_TOGGLE = "com.music.vinaraa.widget.TOGGLE"
        const val ACTION_NEXT = "com.music.vinaraa.widget.NEXT"
        const val ACTION_PREV = "com.music.vinaraa.widget.PREV"
        const val ACTION_REFRESH = "com.music.vinaraa.widget.REFRESH"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_REFRESH -> {
                WorkManager.getInstance(context)
                    .enqueue(OneTimeWorkRequestBuilder<WidgetStatsWorker>().build())
                return
            }
        }

        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            runCatching {
                val c = future.get()
                when (intent.action) {
                    ACTION_TOGGLE -> if (c.isPlaying) c.pause() else c.play()
                    ACTION_NEXT -> c.seekToNextMediaItem()
                    ACTION_PREV -> c.seekToPreviousMediaItem()
                }
                MediaController.releaseFuture(future)
            }
            VinaraaWidgets.updateAll(context)
        }, ContextCompat.getMainExecutor(context))
    }
}
