package com.music.vinaraa.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker.Result
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

class WidgetStatsWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    private val client = OkHttpClient()

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val prefs = ctx.getSharedPreferences("vinaraa_auth", Context.MODE_PRIVATE)
        val base = prefs.getString("api_base", null) ?: return Result.success()
        val token = prefs.getString("access_token", null) ?: return Result.success()

        val fetchJson = { path: String ->
            runCatching {
                val req = Request.Builder()
                    .url("$base$path")
                    .header("Authorization", "Bearer $token")
                    .build()
                client.newCall(req).execute().use { res ->
                    if (res.isSuccessful && res.body != null) {
                        JSONObject(res.body!!.string())
                    } else null
                }
            }.getOrNull()
        }

        val dash24 = fetchJson("/stats/dashboard?range=24h")
        val dash7d = fetchJson("/stats/dashboard?range=7d")
        val topSongs = fetchJson("/stats/top?type=songs&range=7d&limit=3")
        val topSingers = fetchJson("/stats/top?type=singers&range=7d&limit=1")

        WidgetState.update(ctx) { root ->
            val data24 = dash24?.optJSONObject("data") ?: dash24
            val data7d = dash7d?.optJSONObject("data") ?: dash7d

            val todayObj = data24?.optJSONObject("overview")
            if (todayObj != null) {
                root.put("today", JSONObject().apply {
                    val lt = todayObj.optJSONObject("listeningTime")
                    put("listenedMs", lt?.optLong("ms", 0L) ?: 0L)
                    put("listenedText", lt?.optString("text", "0m") ?: "0m")
                    put("plays", todayObj.optInt("plays", 0))
                    val streak = todayObj.optJSONObject("streak")
                    put("streak", streak?.optInt("current", 0) ?: 0)
                })
            }

            val weekObj = data7d?.optJSONObject("overview")
            if (weekObj != null) {
                root.put("week", JSONObject().apply {
                    val lt = weekObj.optJSONObject("listeningTime")
                    put("listenedMs", lt?.optLong("ms", 0L) ?: 0L)
                    put("listenedText", lt?.optString("text", "0m") ?: "0m")
                    put("plays", weekObj.optInt("plays", 0))
                    val streak = weekObj.optJSONObject("streak")
                    put("streak", streak?.optInt("current", 0) ?: 0)
                    put("longestStreak", streak?.optInt("longest", 0) ?: 0)

                    val singersData = topSingers?.optJSONObject("data") ?: topSingers
                    val singerItems = singersData?.optJSONArray("items") ?: singersData?.optJSONObject("singers")?.optJSONArray("items")
                    if (singerItems != null && singerItems.length() > 0) {
                        val topS = singerItems.getJSONObject(0)
                        put("topSinger", JSONObject().apply {
                            put("name", topS.optString("name", ""))
                            val sImg = topS.optString("image", "")
                            put("artPath", WidgetArtCache.ensure(ctx, topS.optString("id", "singer"), sImg) ?: "")
                        })
                    }
                })
            }

            val topSongsData = topSongs?.optJSONObject("data") ?: topSongs
            val songItems = topSongsData?.optJSONArray("items") ?: topSongsData?.optJSONObject("songs")?.optJSONArray("items")
            if (songItems != null) {
                val arr = JSONArray()
                for (i in 0 until minOf(songItems.length(), 3)) {
                    val item = songItems.getJSONObject(i)
                    val sId = item.optString("id", "")
                    val sImg = item.optString("image", "")
                    val artP = WidgetArtCache.ensure(ctx, sId, sImg)
                    arr.put(JSONObject().apply {
                        put("rank", item.optInt("rank", i + 1))
                        put("songId", sId)
                        put("title", item.optString("name", ""))
                        put("artist", item.optString("subtitle", item.optString("artist", "")))
                        put("listenedText", item.optString("listenedText", ""))
                        put("artPath", artP ?: "")
                    })
                }
                root.put("topSongs", arr)
            }
        }

        VinaraaWidgets.updateAll(ctx)
        return Result.success()
    }
}
