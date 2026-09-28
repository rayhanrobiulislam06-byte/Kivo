package com.kivo.app.ai

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import java.util.concurrent.Executors

class KivoChatEngine(
    private val modelPath: String
) {

    private val engine = Engine(
        EngineConfig(
            modelPath = modelPath,
            backend = Backend.CPU(),
            visionBackend = Backend.CPU(),
            audioBackend = Backend.CPU(),
            maxNumTokens = 1024,
            maxNumImages = 1,
            cacheDir = null
        )
    )

    private val executor = Executors.newSingleThreadExecutor()

    private var conversation: Conversation? = null

    interface Callback {
        fun onResponse(text: String)
        fun onError(error: Throwable)
    }

    fun initialize() {
        engine.initialize()
        conversation = engine.createConversation(ConversationConfig())
    }

    fun isInitialized(): Boolean {
        return engine.isInitialized()
    }

    fun sendMessage(message: String): String {
        val activeConversation = conversation
            ?: throw IllegalStateException(
                "KivoChatEngine is not initialized"
            )

        val response: Message = activeConversation.sendMessage(message)

        return response.contents.contents
            .filterIsInstance<Content.Text>()
            .joinToString("") { it.text }
            .trim()
    }

    fun sendMessageAsync(
        message: String,
        onResponse: (String) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        val activeConversation = conversation

        if (activeConversation == null) {
            onError(
                IllegalStateException(
                    "KivoChatEngine is not initialized"
                )
            )
            return
        }

        activeConversation.sendMessageAsync(
            message,
            object : MessageCallback {

                override fun onMessage(response: Message) {
                    val text = response.contents.contents
                        .filterIsInstance<Content.Text>()
                        .joinToString("") { it.text }

                    if (text.isNotEmpty()) {
                        onResponse(text)
                    }
                }

                override fun onDone() {
                    // Streaming complete.
                }

                override fun onError(error: Throwable) {
                    onError(error)
                }
            }
        )
    }

    /*
     * Java-friendly async API.
     *
     * The blocking LiteRT-LM call runs on a background thread,
     * so the Android UI thread is never blocked.
     */
    fun sendMessageAsyncJava(
        message: String,
        callback: Callback
    ) {
        executor.execute {
            try {
                val response = sendMessage(message)

                callback.onResponse(response)
            } catch (error: Throwable) {
                callback.onError(error)
            }
        }
    }

    fun close() {
        conversation = null
        executor.shutdownNow()
        engine.close()
    }
}
