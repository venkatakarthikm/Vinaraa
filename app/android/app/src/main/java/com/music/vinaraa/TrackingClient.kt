package com.music.vinaraa

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object TrackingClient {
    private const val TAG = "TrackingClient"
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    var apiBase: String? = null
    var deviceId: String? = null
    private var prefs: SharedPreferences? = null
    private var context: Context? = null

    fun init(ctx: Context, baseUrl: String, devId: String) {
        context = ctx.applicationContext
        apiBase = baseUrl
        deviceId = devId
        prefs = ctx.getSharedPreferences("vinaraa_auth", Context.MODE_PRIVATE)
    }

    private fun getToken(): String? {
        return prefs?.getString("access_token", null)
    }

    fun startSession(
        songId: String,
        source: String?,
        contextId: String?,
        onSuccess: (String) -> Unit
    ) {
        val base = apiBase ?: return
        val token = getToken() ?: return
        val devId = deviceId ?: "unknown"

        val json = JSONObject().apply {
            put("songId", songId)
            put("deviceId", devId)
            put("source", source ?: "native_player")
            if (contextId != null) put("contextId", contextId)
        }

        val request = Request.Builder()
            .url("$base/tracking/sessions")
            .post(json.toString().toRequestBody(JSON))
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "startSession failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (it.isSuccessful) {
                        val body = it.body?.string()
                        if (body != null) {
                            try {
                                val resObj = JSONObject(body)
                                if (resObj.optBoolean("success")) {
                                    val sid = resObj.getJSONObject("data").getString("id")
                                    onSuccess(sid)
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "parse startSession", e)
                            }
                        }
                    }
                }
            }
        })
    }

    fun heartbeat(sessionId: String, positionMs: Long, state: String, bufferedMs: Long) {
        val base = apiBase ?: return
        val token = getToken() ?: return

        val json = JSONObject().apply {
            put("positionMs", positionMs)
            put("state", state)
            put("bufferedMs", bufferedMs)
            put("clientTimestamp", System.currentTimeMillis())
        }

        val request = Request.Builder()
            .url("$base/tracking/sessions/$sessionId/heartbeat")
            .post(json.toString().toRequestBody(JSON))
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) { response.close() }
        })
    }

    fun endSession(sessionId: String, positionMs: Long) {
        val base = apiBase ?: return
        val token = getToken() ?: return

        val json = JSONObject().apply {
            put("positionMs", positionMs)
        }

        val request = Request.Builder()
            .url("$base/tracking/sessions/$sessionId/end")
            .post(json.toString().toRequestBody(JSON))
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) { response.close() }
        })
    }
}
