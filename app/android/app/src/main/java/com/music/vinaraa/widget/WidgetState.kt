package com.music.vinaraa.widget

import android.content.Context
import android.graphics.Bitmap
import org.json.JSONObject
import java.io.File

object WidgetState {
    private const val DIR = "widget"

    private fun dir(ctx: Context) = File(ctx.filesDir, DIR).apply { mkdirs() }
    fun file(ctx: Context) = File(dir(ctx), "state.json")
    fun artFile(ctx: Context, songId: String) = File(dir(ctx), "art/$songId.jpg").apply { parentFile?.mkdirs() }

    @Synchronized
    fun read(ctx: Context): JSONObject =
        runCatching { JSONObject(file(ctx).readText()) }.getOrElse { JSONObject() }

    @Synchronized
    fun update(ctx: Context, mutate: (JSONObject) -> Unit) {
        val root = read(ctx)
        mutate(root)
        root.put("schema", 1)
        root.put("updatedAt", System.currentTimeMillis())
        val tmp = File(dir(ctx), "state.json.tmp")
        tmp.writeText(root.toString())
        tmp.renameTo(file(ctx))
    }

    fun saveArt(ctx: Context, songId: String, bmp: Bitmap): String {
        val f = artFile(ctx, songId)
        f.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) }
        return f.absolutePath
    }
}
