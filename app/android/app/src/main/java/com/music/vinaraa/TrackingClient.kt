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
import java.util.concurrent.TimeUnit

object TrackingClient {
    private const val TAG = "TrackingClient"
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    private val ALLOWED_SOURCES = setOf(
        "search", "playlist", "album", "artist", "recommendation",
        "radio", "library", "offline", "unknown"
    )

    private const val PREFS_NAME = "vinaraa_auth"
    private const val KEY_API_BASE = "api_base"
    private const val KEY_DEVICE_ID = "device_id"

    var apiBase: String? = null
    var deviceId: String? = null
    private var prefs: SharedPreferences? = null
    private var context: Context? = null
    private var lastHeartbeatAt: Long = 0L

    fun sanitizeSource(raw: String?): String {
        val v = raw?.trim()?.lowercase() ?: return "unknown"
        return when {
            v in ALLOWED_SOURCES -> v
            v.contains("home") || v.contains("rail") -> "recommendation"
            v.contains("queue") || v.contains("next") -> "library"
            v.contains("download") -> "offline"
            else -> "unknown"
        }
    }

    fun init(ctx: Context, baseUrl: String, devId: String) {
        context = ctx.applicationContext
        prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        apiBase = baseUrl
        deviceId = devId
        prefs?.edit()?.putString(KEY_API_BASE, baseUrl)?.putString(KEY_DEVICE_ID, devId)?.apply()
    }

    /** Safe to call from a Service with no WebView — restores config from disk. */
    fun ensureInitialized(ctx: Context) {
        if (context == null) context = ctx.applicationContext
        if (prefs == null) prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (apiBase.isNullOrEmpty()) apiBase = prefs?.getString(KEY_API_BASE, null)
        if (deviceId.isNullOrEmpty()) deviceId = prefs?.getString(KEY_DEVICE_ID, null)
    }

    private fun getToken(): String? {
        if (prefs == null && context != null) {
            prefs = context?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
        return prefs?.getString("access_token", null)
    }

    fun startSession(
        songId: String,
        source: String?,
        contextId: String?,
        onSuccess: (String) -> Unit
    ) {
        val base = apiBase ?: run { Log.w(TAG, "startSession skipped: apiBase not set"); return }
        val token = getToken() ?: run { Log.w(TAG, "startSession skipped: no access token"); return }
        val devId = deviceId ?: "unknown"

        val json = JSONObject().apply {
            put("songId", songId)
            put("deviceId", devId)
            put("source", sanitizeSource(source))
            if (contextId != null) put("contextId", contextId)
        }

        val request = Request.Builder()
            .url("$base/tracking/sessions")
            .post(json.toString().toRequestBody(JSON))
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "startSession network failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { res ->
                    val body = res.body?.string()
                    if (res.isSuccessful && body != null) {
                        try {
                            val resObj = JSONObject(body)
                            if (resObj.optBoolean("success")) {
                                val data = resObj.optJSONObject("data")
                                val sid = data?.optString("sessionId", "")?.takeIf { it.isNotEmpty() }
                                    ?: data?.optString("id", "")?.takeIf { it.isNotEmpty() }
                                    ?: data?.optString("_id", "")?.takeIf { it.isNotEmpty() }
                                if (sid != null) {
                                    Log.i(TAG, "tracking session opened: $sid")
                                    onSuccess(sid)
                                } else {
                                    Log.e(TAG, "startSession: no session id in response: ${body.take(300)}")
                                }
                            } else {
                                Log.e(TAG, "startSession response success=false: ${body.take(300)}")
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "parse startSession failed for body: ${body.take(300)}", e)
                        }
                    } else {
                        Log.e(TAG, "startSession FAILED HTTP ${res.code} for song=$songId — tracking is DEAD for this play. body=${body?.take(400)}")
                    }
                }
            }
        })
    }

    fun heartbeat(sessionId: String, positionMs: Long, state: String, bufferedMs: Long) {
        val base = apiBase ?: run { Log.w(TAG, "heartbeat skipped: apiBase not set"); return }
        val token = getToken() ?: run { Log.w(TAG, "heartbeat skipped: no access token"); return }

        lastHeartbeatAt = System.currentTimeMillis()

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
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "heartbeat network failure", e)
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    fun endSession(sessionId: String, positionMs: Long) {
        val base = apiBase ?: run { Log.w(TAG, "endSession skipped: apiBase not set"); return }
        val token = getToken() ?: run { Log.w(TAG, "endSession skipped: no access token"); return }

        val json = JSONObject().apply {
            put("positionMs", positionMs)
        }

        val request = Request.Builder()
            .url("$base/tracking/sessions/$sessionId/end")
            .post(json.toString().toRequestBody(JSON))
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "endSession network failure", e)
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    private val queueFile: File?
        get() = context?.let { File(it.filesDir, "tracking_queue.jsonl") }

    fun debugState(activeSessionId: String?): JSONObject {
        val lastAgo = if (lastHeartbeatAt > 0) System.currentTimeMillis() - lastHeartbeatAt else -1
        val qLines = runCatching { queueFile?.readLines()?.size ?: 0 }.getOrDefault(0)
        return JSONObject().apply {
            put("sessionId", activeSessionId ?: null)
            put("lastHeartbeatAgoMs", lastAgo)
            put("tickerRunning", activeSessionId != null)
            put("queuedOffline", qLines)
            put("hasToken", getToken() != null)
            put("apiBase", apiBase)
        }
    }
}
