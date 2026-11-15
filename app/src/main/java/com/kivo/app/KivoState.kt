package com.kivo.app

import com.kivo.app.ai.KivoChatEngine
import org.json.JSONObject

/**
 * Process-wide state, so a running reply survives the page being reloaded or the Activity being
 * recreated. The web UI picks an unfinished reply up again through KivoNative.getPending().
 */
object KivoState {
    @Volatile var engine: KivoChatEngine? = null
    @Volatile var engineReady = false
    @Volatile var engineLoading = false
    @Volatile var copyingModel = false
    @Volatile var activeRequest: String? = null

    private val lock = Any()
    private var pendingId: String? = null
    private val pendingText = StringBuilder()
    private var pendingDone = false
    private var pendingError: String? = null

    fun beginPending(id: String) = synchronized(lock) {
        pendingId = id
        pendingText.setLength(0)
        pendingDone = false
        pendingError = null
    }

    fun appendPending(text: String) = synchronized(lock) {
        pendingText.append(text)
    }

    fun pendingTextSnapshot(): String = synchronized(lock) { pendingText.toString() }

    fun finishPending(error: String?) = synchronized(lock) {
        pendingDone = true
        pendingError = error
    }

    fun clearPending() = synchronized(lock) {
        pendingId = null
        pendingText.setLength(0)
        pendingDone = false
        pendingError = null
    }

    /** JSON for the web UI: {"id","text","done","error"} or "" when nothing is pending. */
    fun pendingJson(): String = synchronized(lock) {
        val id = pendingId ?: return@synchronized ""
        val o = JSONObject()
        o.put("id", id)
        o.put("text", pendingText.toString())
        o.put("done", pendingDone)
        o.put("error", pendingError ?: "")
        o.toString()
    }
}
