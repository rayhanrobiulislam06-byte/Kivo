package com.kivo.app.ai

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback

/**
 * Thin wrapper around the LiteRT-LM engine. Only the API calls that already compiled in the
 * first Kivo prototype are used directly; cancel/close go through reflection so a library
 * update can never break the build.
 */
class KivoChatEngine(modelPath: String) {

    interface StreamCallback {
        fun onChunk(text: String)
        fun onDone()
        fun onError(message: String)
    }

    private val engine = Engine(
        EngineConfig(
            modelPath = modelPath,
            backend = Backend.CPU(),
            visionBackend = Backend.CPU(),
            audioBackend = Backend.CPU(),
            maxNumTokens = 2048,
            maxNumImages = 1,
            cacheDir = null
        )
    )

    private var conversation: Conversation? = null

    @Volatile
    var isGenerating = false
        private set

    @Volatile
    private var cancelled = false

    @Volatile
    private var needsReset = false

    fun initialize() {
        engine.initialize()
        conversation = engine.createConversation(ConversationConfig())
    }

    fun isInitialized(): Boolean = engine.isInitialized()

    fun sendMessageStream(message: String, callback: StreamCallback) {
        if (needsReset && !isGenerating) resetConversation()
        val conv = conversation
        if (conv == null) {
            callback.onError("MODEL_NOT_READY")
            return
        }
        synchronized(this) {
            if (isGenerating) {
                callback.onError("Kivo is still finishing the previous reply")
                return
            }
            isGenerating = true
        }
        cancelled = false
        try {
            startStream(conv, message, callback)
        } catch (t: Throwable) {
            isGenerating = false
            callback.onError(t.message ?: "Unknown model error")
        }
    }

    private fun startStream(conv: Conversation, message: String, callback: StreamCallback) {
        conv.sendMessageAsync(
            message,
            object : MessageCallback {
                override fun onMessage(response: Message) {
                    if (cancelled) return
                    val text = response.contents.contents
                        .filterIsInstance<Content.Text>()
                        .joinToString("") { it.text }
                    if (text.isNotEmpty()) callback.onChunk(text)
                }

                override fun onDone() {
                    isGenerating = false
                    callback.onDone()
                }

                override fun onError(error: Throwable) {
                    isGenerating = false
                    if (cancelled) callback.onDone()
                    else callback.onError(error.message ?: "Unknown model error")
                }
            }
        )
    }

    /** Stops the running reply. Falls back to a conversation reset if the library has no cancel call. */
    fun cancelGeneration() {
        cancelled = true
        val conv = conversation ?: return
        try {
            conv.javaClass.getMethod("cancelProcess").invoke(conv)
        } catch (t: Throwable) {
            needsReset = true
        }
    }

    /** Starts a fresh conversation (clears the model's context). */
    fun resetConversation() {
        var waited = 0
        while (isGenerating && waited < 4000) {
            Thread.sleep(100)
            waited += 100
        }
        if (isGenerating) {
            // never close a conversation that is still producing text: try again before the next message
            needsReset = true
            return
        }
        val old = conversation
        conversation = null
        try {
            old?.javaClass?.getMethod("close")?.invoke(old)
        } catch (t: Throwable) {
            // not closable in this library version: just drop it
        }
        conversation = engine.createConversation(ConversationConfig())
        needsReset = false
    }

    fun close() {
        try {
            conversation?.javaClass?.getMethod("close")?.invoke(conversation)
        } catch (t: Throwable) {
            // ignore
        }
        conversation = null
        engine.close()
    }
}
