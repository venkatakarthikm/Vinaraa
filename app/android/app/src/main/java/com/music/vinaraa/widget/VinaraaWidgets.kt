package com.music.vinaraa.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import android.widget.RemoteViews
import com.music.vinaraa.MainActivity
import com.music.vinaraa.R
import org.json.JSONObject
import java.io.File

object VinaraaWidgets {

    fun updateAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val providers = listOf(
            VinaraaNowWidget::class.java,
            VinaraaDeckWidget::class.java,
            VinaraaPulseWidget::class.java,
            VinaraaTopWidget::class.java,
            VinaraaMixWidget::class.java,
            VinaraaVinylWidget::class.java,
            VinaraaRecapWidget::class.java
        )

        val state = WidgetState.read(ctx)

        for (cls in providers) {
            val c = ComponentName(ctx, cls)
            val ids = mgr.getAppWidgetIds(c)
            for (id in ids) {
                val views = buildWidgetViews(ctx, cls, id, mgr, state)
                mgr.updateAppWidget(id, views)
            }
        }
    }

    private fun buildWidgetViews(
        ctx: Context,
        cls: Class<*>,
        widgetId: Int,
        mgr: AppWidgetManager,
        state: JSONObject
    ): RemoteViews {
        val opts = mgr.getAppWidgetOptions(widgetId)
        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)

        val nowPlaying = state.optJSONObject("nowPlaying") ?: JSONObject()
        val isPlaying = nowPlaying.optBoolean("isPlaying", false)
        val title = nowPlaying.optString("title", "Nothing Playing")
        val artist = nowPlaying.optString("artist", "Pick a track on Vinaraa")
        val artPath = nowPlaying.optString("artPath", "")
        val posMs = nowPlaying.optLong("positionMs", 0L)
        val durMs = nowPlaying.optLong("durationMs", 1L)

        when (cls) {
            VinaraaNowWidget::class.java -> {
                val isCompact = minH <= 60
                val layout = if (isCompact) R.layout.widget_now_compact else R.layout.widget_now
                val views = RemoteViews(ctx.packageName, layout)

                views.setTextViewText(R.id.w_now_title, if (title.isEmpty()) "Nothing Playing" else title)
                views.setTextViewText(R.id.w_now_artist, if (artist.isEmpty()) "Vinaraa" else artist)

                val playIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                views.setImageViewResource(R.id.w_now_play_btn, playIcon)

                if (!isCompact) {
                  val pct = if (durMs > 0) ((posMs.toFloat() / durMs.toFloat()) * 100).toInt() else 0
                  views.setProgressBar(R.id.w_now_progress, 100, pct, false)
                  val posStr = formatTime(posMs)
                  val durStr = formatTime(durMs)
                  views.setTextViewText(R.id.w_now_timer, "$posStr / $durStr")

                  if (artPath.isNotEmpty() && File(artPath).exists()) {
                    val bmp = BitmapFactory.decodeFile(artPath)
                    if (bmp != null) views.setImageViewBitmap(R.id.w_now_art, bmp)
                  } else {
                    views.setImageViewResource(R.id.w_now_art, R.drawable.ic_music_placeholder)
                  }
                }

                setClickIntent(ctx, views, R.id.w_now_art, getPlayerIntent(ctx))
                setClickIntent(ctx, views, R.id.w_now_title, getPlayerIntent(ctx))
                setBroadcastIntent(ctx, views, R.id.w_now_play_btn, WidgetActionReceiver.ACTION_TOGGLE, widgetId * 100 + 1)
                setBroadcastIntent(ctx, views, R.id.w_now_next_btn, WidgetActionReceiver.ACTION_NEXT, widgetId * 100 + 2)
                setBroadcastIntent(ctx, views, R.id.w_now_prev_btn, WidgetActionReceiver.ACTION_PREV, widgetId * 100 + 3)

                return views
            }

            VinaraaDeckWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_deck)
                views.setTextViewText(R.id.w_deck_title, if (title.isEmpty()) "Vinaraa" else title)
                views.setTextViewText(R.id.w_deck_artist, artist)

                val playIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                views.setImageViewResource(R.id.w_deck_play_btn, playIcon)

                if (artPath.isNotEmpty() && File(artPath).exists()) {
                    val bmp = BitmapFactory.decodeFile(artPath)
                    if (bmp != null) views.setImageViewBitmap(R.id.w_deck_art, bmp)
                } else {
                    views.setImageViewResource(R.id.w_deck_art, R.drawable.ic_music_placeholder)
                }

                setClickIntent(ctx, views, R.id.w_deck_root, getPlayerIntent(ctx))
                setBroadcastIntent(ctx, views, R.id.w_deck_play_btn, WidgetActionReceiver.ACTION_TOGGLE, widgetId * 100 + 1)
                return views
            }

            VinaraaPulseWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_pulse)
                val today = state.optJSONObject("today")
                val text = today?.optString("listenedText", "0m") ?: "0m"
                val plays = today?.optInt("plays", 0) ?: 0
                val streak = today?.optInt("streak", 0) ?: 0

                views.setTextViewText(R.id.w_pulse_hero, text)
                views.setTextViewText(R.id.w_pulse_chips, "$plays plays · $streak day streak")

                setClickIntent(ctx, views, R.id.w_pulse_root, getDeepLinkIntent(ctx, "vinaraa://stats"))
                setBroadcastIntent(ctx, views, R.id.w_pulse_refresh, WidgetActionReceiver.ACTION_REFRESH, widgetId * 100 + 4)
                return views
            }

            VinaraaTopWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_top)
                val topSongs = state.optJSONArray("topSongs") ?: org.json.JSONArray()

                if (topSongs.length() > 0) {
                    val s0 = topSongs.optJSONObject(0)
                    views.setTextViewText(R.id.w_top_title_1, s0?.optString("title", "Song 1"))
                    views.setTextViewText(R.id.w_top_artist_1, s0?.optString("artist", ""))
                    setClickIntent(ctx, views, R.id.w_top_row_1, getDeepLinkIntent(ctx, "vinaraa://play/${s0?.optString("songId")}"))
                }
                if (topSongs.length() > 1) {
                    val s1 = topSongs.optJSONObject(1)
                    views.setTextViewText(R.id.w_top_title_2, s1?.optString("title", "Song 2"))
                    views.setTextViewText(R.id.w_top_artist_2, s1?.optString("artist", ""))
                    setClickIntent(ctx, views, R.id.w_top_row_2, getDeepLinkIntent(ctx, "vinaraa://play/${s1?.optString("songId")}"))
                }

                setClickIntent(ctx, views, R.id.w_top_root, getDeepLinkIntent(ctx, "vinaraa://stats"))
                return views
            }

            VinaraaMixWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_mix)
                setClickIntent(ctx, views, R.id.w_mix_liked, getDeepLinkIntent(ctx, "vinaraa://playlist/liked_songs"))
                setClickIntent(ctx, views, R.id.w_mix_repeat, getDeepLinkIntent(ctx, "vinaraa://playlist/on_repeat"))
                setClickIntent(ctx, views, R.id.w_mix_mix, getDeepLinkIntent(ctx, "vinaraa://playlist/taste_mix"))
                setClickIntent(ctx, views, R.id.w_mix_downloads, getDeepLinkIntent(ctx, "vinaraa://downloads"))
                return views
            }

            VinaraaVinylWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_vinyl)
                views.setTextViewText(R.id.w_vinyl_title, if (title.isEmpty()) "Vinaraa" else title)
                views.setTextViewText(R.id.w_vinyl_artist, artist)

                val playIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                views.setImageViewResource(R.id.w_vinyl_play_btn, playIcon)

                if (artPath.isNotEmpty() && File(artPath).exists()) {
                    val rawBmp = BitmapFactory.decodeFile(artPath)
                    if (rawBmp != null) {
                        val angle = if (isPlaying) ((posMs / 4000L) % 360).toFloat() else 0f
                        val vinylBmp = createVinylBitmap(rawBmp, 240, angle)
                        views.setImageViewBitmap(R.id.w_vinyl_record, vinylBmp)
                    }
                }

                setClickIntent(ctx, views, R.id.w_vinyl_record, getPlayerIntent(ctx))
                setBroadcastIntent(ctx, views, R.id.w_vinyl_play_btn, WidgetActionReceiver.ACTION_TOGGLE, widgetId * 100 + 1)
                return views
            }

            VinaraaRecapWidget::class.java -> {
                val views = RemoteViews(ctx.packageName, R.layout.widget_recap)
                val week = state.optJSONObject("week")
                val text = week?.optString("listenedText", "0h 0m") ?: "0h 0m"
                val streak = week?.optInt("streak", 0) ?: 0

                views.setTextViewText(R.id.w_recap_hero, text)
                views.setTextViewText(R.id.w_recap_streak, "$streak day streak")

                setClickIntent(ctx, views, R.id.w_recap_root, getDeepLinkIntent(ctx, "vinaraa://stats"))
                return views
            }

            else -> {
                return RemoteViews(ctx.packageName, R.layout.widget_now)
            }
        }
    }

    private fun formatTime(ms: Long): String {
        if (ms <= 0L) return "0:00"
        val sec = ms / 1000
        val m = sec / 60
        val s = sec % 60
        return String.format("%d:%02d", m, s)
    }

    private fun createVinylBitmap(src: Bitmap, size: Int, angle: Float): Bitmap {
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val r = size / 2f
        val p = Paint(Paint.ANTI_ALIAS_FLAG)

        p.color = 0xFF0A0A12.toInt()
        c.drawCircle(r, r, r, p)

        p.color = 0x22FFFFFF
        c.drawCircle(r, r, r * 0.96f, p)

        val matrix = Matrix()
        matrix.postRotate(angle, src.width / 2f, src.height / 2f)
        val rotSrc = Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)

        val scaledSize = (size * 0.62f).toInt()
        val art = Bitmap.createScaledBitmap(rotSrc, scaledSize, scaledSize, true)

        p.reset()
        p.shader = BitmapShader(art, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        c.drawCircle(r, r, art.width / 2f, p)

        p.reset()
        p.color = 0xFF0B0A1A.toInt()
        c.drawCircle(r, r, size * 0.045f, p)

        return out
    }

    private fun getPlayerIntent(ctx: Context): Intent {
        return Intent(ctx, MainActivity::class.java).apply {
            putExtra("OPEN_PLAYER", true)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
    }

    private fun getDeepLinkIntent(ctx: Context, uriStr: String): Intent {
        return Intent(Intent.ACTION_VIEW, Uri.parse(uriStr), ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
    }

    private fun setClickIntent(ctx: Context, views: RemoteViews, viewId: Int, intent: Intent) {
        val pi = PendingIntent.getActivity(
            ctx,
            viewId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(viewId, pi)
    }

    private fun setBroadcastIntent(ctx: Context, views: RemoteViews, viewId: Int, actionStr: String, reqCode: Int) {
        val intent = Intent(ctx, WidgetActionReceiver::class.java).apply {
            action = actionStr
        }
        val pi = PendingIntent.getBroadcast(
            ctx,
            reqCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(viewId, pi)
    }
}
