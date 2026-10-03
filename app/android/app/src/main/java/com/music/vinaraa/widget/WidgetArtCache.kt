package com.music.vinaraa.widget

import android.content.Context
import android.graphics.BitmapFactory
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

object WidgetArtCache {
    private val memoryMap = ConcurrentHashMap<String, String>()
    private val executor = Executors.newSingleThreadExecutor()
    private val client = OkHttpClient()

    fun ensure(ctx: Context, songId: String, imageUrl: String?): String? {
        if (songId.isEmpty() || imageUrl.isNullOrEmpty()) return null

        val existingPath = memoryMap[songId]
        if (existingPath != null && File(existingPath).exists()) {
            return existingPath
        }

        val diskFile = WidgetState.artFile(ctx, songId)
        if (diskFile.exists() && diskFile.length() > 0) {
            memoryMap[songId] = diskFile.absolutePath
            return diskFile.absolutePath
        }

        executor.execute {
            runCatching {
                val req = Request.Builder().url(imageUrl).build()
                client.newCall(req).execute().use { res ->
                    if (res.isSuccessful && res.body != null) {
                        val bytes = res.body!!.bytes()
                        val opts = BitmapFactory.Options().apply {
                            inJustDecodeBounds = true
                        }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)

                        opts.inSampleSize = calculateInSampleSize(opts, 320, 320)
                        opts.inJustDecodeBounds = false
                        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
                        if (bmp != null) {
                            val path = WidgetState.saveArt(ctx, songId, bmp)
                            memoryMap[songId] = path
                            VinaraaWidgets.updateAll(ctx)
                        }
                    }
                }
            }
        }

        return null
    }

    private fun calculateInSampleSize(opts: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val (height: Int, width: Int) = opts.run { outHeight to outWidth }
        var inSampleSize = 1
        if (height > reqHeight || width > reqWidth) {
            val halfHeight: Int = height / 2
            val halfWidth: Int = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}
