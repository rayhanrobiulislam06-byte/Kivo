@file:Suppress("DEPRECATION")

package com.kivo.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import com.kivo.app.ai.KivoChatEngine
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.Executors

class MainActivity : Activity() {

    companion object {
        private const val BASE = "file:///android_asset/kivo/"
        private const val REQ_PICK_MODEL = 1001
        private const val REQ_PICK_FILE = 1002
        private const val REQ_SAVE_FILE = 1003
        private const val REQ_NOTIFY = 1004

        @Volatile
        private var current: MainActivity? = null

        @Volatile
        private var appContext: Context? = null

        private val downloader = ModelDownloader()
        private val worker = Executors.newSingleThreadExecutor()   // engine load / reset / chat
        private val longTasks = Executors.newSingleThreadExecutor() // download / copy / save

        fun q(s: String): String = JSONObject.quote(s)
    }

    private lateinit var container: FrameLayout
    private var webView: WebView? = null
    private val ui = Handler(Looper.getMainLooper())

    @Volatile
    private var currentUrl = ""

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSaveFile: File? = null

    private val modelsDir: File get() = File(filesDir, "models")
    private val modelFile: File get() = File(modelsDir, ModelConfig.NAME)

    // ------------------------------------------------------------------ lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        current = this
        appContext = applicationContext

        container = FrameLayout(this)
        container.setBackgroundColor(resources.getColor(R.color.window_bg, theme))
        container.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                v.setPadding(i.left, i.top, i.right, i.bottom)
                WindowInsets.CONSUMED
            } else {
                v.setPadding(
                    insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom
                )
                insets
            }
        }
        setContentView(container)

        createWebView()
        webView?.loadUrl(BASE + "index.html")
        initializeExistingModel()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onDestroy() {
        if (current === this) current = null
        webView?.let {
            container.removeView(it)
            it.destroy()
        }
        webView = null
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val w = webView
        if (w != null && w.canGoBack()) w.goBack() else super.onBackPressed()
    }

    // ------------------------------------------------------------------ web view

    private fun createWebView() {
        val w = WebView(this)
        webView = w
        container.addView(
            w,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        WebView.setWebContentsDebuggingEnabled(false)

        val s = w.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = true            // needed for file:///android_asset
        s.allowContentAccess = false
        s.allowFileAccessFromFileURLs = false
        s.allowUniversalAccessFromFileURLs = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        s.setSupportZoom(false)
        s.mediaPlaybackRequiresUserGesture = true

        w.addJavascriptInterface(KivoNativeBridge(), "KivoNative")

        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith(BASE)) return false          // Kivo, FileNest (inside our own assets)
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    } catch (e: Exception) {
                        // no browser installed
                    }
                }
                return true                                     // nothing else is ever loaded in this view
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val scheme = request.url.scheme
                if (scheme == "http" || scheme == "https") {
                    return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                return null
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                currentUrl = url ?: ""
            }

            override fun onPageFinished(view: WebView, url: String?) {
                currentUrl = url ?: ""
                if (currentUrl.startsWith(BASE)) {
                    try {
                        val js = assets.open("kivo/host.js").bufferedReader().use { it.readText() }
                        view.evaluateJavascript(js, null)
                    } catch (e: Exception) {
                        // optional helper script
                    }
                }
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                recoverWebView()
                return true
            }
        }

        w.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(params.createIntent(), REQ_PICK_FILE)
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    callback.onReceiveValue(null)
                    false
                }
            }
        }
    }

    private fun recoverWebView() {
        runOnUiThread {
            webView?.let {
                container.removeView(it)
                it.destroy()
            }
            createWebView()
            webView?.loadUrl(BASE + "index.html")
        }
    }

    private fun trusted(): Boolean = currentUrl.startsWith(BASE)

    fun postJs(script: String) {
        runOnUiThread { webView?.evaluateJavascript(script, null) }
    }

    private fun toast(message: String) {
        runOnUiThread { Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
    }

    // ------------------------------------------------------------------ activity results

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_PICK_FILE -> {
                fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
                fileCallback = null
            }
            REQ_PICK_MODEL -> {
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null) installModel(uri)
            }
            REQ_SAVE_FILE -> {
                val src = pendingSaveFile
                pendingSaveFile = null
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null && src != null) writeSavedFile(src, uri)
                else src?.delete()
            }
        }
    }

    private fun requestNotificationPermission() {
        runOnUiThread {
            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
            }
        }
    }

    // ------------------------------------------------------------------ keep-alive service

    private fun busy(): Boolean =
        downloader.isRunning || KivoState.copyingModel || KivoState.engineLoading || KivoState.activeRequest != null

    private fun stopServiceIfIdle() {
        if (!busy()) appContext?.let { KeepAliveService.stop(it) }
    }

    private fun startService(text: String) {
        appContext?.let { KeepAliveService.start(it, text) }
    }

    // ------------------------------------------------------------------ model: load / download / import

    private fun initializeExistingModel() {
        if (KivoState.engineReady || KivoState.engineLoading) return
        if (modelFile.exists() && modelFile.length() > 0) initializeEngine(modelFile)
    }

    private fun initializeEngine(file: File) {
        if (KivoState.engineLoading) return
        KivoState.engineLoading = true
        KivoState.engineReady = false
        startService("Loading Gemma 4 E2B…")
        postJs("window.kivoNativeSetup && window.kivoNativeSetup('loading')")
        worker.execute {
            try {
                KivoState.engine?.let {
                    try { it.close() } catch (t: Throwable) { /* ignore */ }
                }
                val e = KivoChatEngine(file.absolutePath)
                e.initialize()
                KivoState.engine = e
                KivoState.engineReady = true
                KivoState.engineLoading = false
                current?.postJs("window.kivoNativeReady && window.kivoNativeReady(true)")
            } catch (t: Throwable) {
                KivoState.engineLoading = false
                val msg = t.message ?: "Could not load the model"
                current?.postJs("window.kivoNativeReady && window.kivoNativeReady(false, " + q(msg) + ")")
            } finally {
                stopServiceIfIdle()
            }
        }
    }

    private fun downloadJs(state: String, done: Long, total: Long, msg: String): String =
        "window.kivoModelDownload && window.kivoModelDownload('$state', $done, $total, ${q(msg)})"

    private fun startModelDownload() {
        if (KivoState.copyingModel || KivoState.engineLoading) return
        if (!downloader.tryBegin()) return
        requestNotificationPermission()
        startService("Downloading Gemma 4 E2B…")
        val part = downloader.partFile(modelsDir)
        postJs(downloadJs("start", if (part.exists()) part.length() else 0L, ModelConfig.TOTAL_BYTES, ""))
        longTasks.execute {
            try {
                val file = downloader.download(modelsDir, object : ModelDownloader.Listener {
                    override fun onProgress(done: Long, total: Long) {
                        current?.postJs(downloadJs("progress", done, total, ""))
                    }

                    override fun onVerifying() {
                        current?.postJs(downloadJs("verifying", 0, 0, ""))
                    }
                })
                current?.initializeEngine(file)
            } catch (e: ModelDownloader.CancelledException) {
                val p = downloader.partFile(modelsDir)
                current?.postJs(downloadJs("paused", if (p.exists()) p.length() else 0L, ModelConfig.TOTAL_BYTES, ""))
            } catch (e: ModelDownloader.DownloadException) {
                current?.postJs(downloadJs("error", 0, 0, e.message ?: "Download failed"))
            } catch (t: Throwable) {
                current?.postJs(downloadJs("error", 0, 0, t.message ?: "Download failed"))
            } finally {
                stopServiceIfIdle()
            }
        }
    }

    private fun pickModel() {
        runOnUiThread {
            try {
                val i = Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*")
                startActivityForResult(i, REQ_PICK_MODEL)
            } catch (e: Exception) {
                toast("No file picker available")
            }
        }
    }

    private fun querySize(uri: Uri): Long {
        return try {
            contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use {
                if (it.moveToFirst() && !it.isNull(0)) it.getLong(0) else -1L
            } ?: -1L
        } catch (e: Exception) {
            -1L
        }
    }

    private fun installModel(uri: Uri) {
        if (KivoState.copyingModel || downloader.isRunning) return
        KivoState.copyingModel = true
        startService("Installing Gemma 4 E2B…")
        postJs("window.kivoModelProgress && window.kivoModelProgress(0)")
        longTasks.execute {
            val tmp = File(modelsDir, ModelConfig.NAME + ".copy")
            try {
                modelsDir.mkdirs()
                val size = querySize(uri)
                if (size in 0 until ModelConfig.MIN_PICKED_BYTES) {
                    throw IOException("That file is too small to be the Gemma 4 E2B model.")
                }
                if (size > 0 && size != ModelConfig.TOTAL_BYTES) {
                    throw IOException("That file is not the Gemma 4 E2B model (its size is different).")
                }
                val need = (if (size > 0) size else ModelConfig.TOTAL_BYTES) + ModelConfig.FREE_SPACE_MARGIN
                if (modelsDir.usableSpace < need) {
                    throw IOException("Not enough free storage. Free up about ${need / (1024L * 1024L * 1024L) + 1} GB and try again.")
                }
                val input = contentResolver.openInputStream(uri) ?: throw IOException("Unable to open selected model")
                input.use { src ->
                    FileOutputStream(tmp).use { out ->
                        val buf = ByteArray(1 shl 20)
                        var copied = 0L
                        var last = 0L
                        while (true) {
                            val n = src.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            copied += n
                            val now = System.nanoTime()
                            if (now - last > 400_000_000L) {
                                last = now
                                current?.postJs("window.kivoModelProgress && window.kivoModelProgress($copied)")
                            }
                        }
                        out.fd.sync()
                    }
                }
                current?.postJs(downloadJs("verifying", 0, 0, ""))
                val digest = downloader.sha256Of(tmp)
                if (!digest.equals(ModelConfig.SHA256, ignoreCase = true)) {
                    throw IOException("The file is damaged or is not the Gemma 4 E2B model.")
                }
                val backup = File(modelsDir, ModelConfig.NAME + ".old")
                backup.delete()
                val hadOld = modelFile.exists()
                if (hadOld && !modelFile.renameTo(backup)) throw IOException("Could not replace the existing model")
                if (!tmp.renameTo(modelFile)) {
                    if (hadOld) backup.renameTo(modelFile)   // roll back: the old model keeps working
                    throw IOException("Could not finalize model file")
                }
                backup.delete()
                downloader.partFile(modelsDir).delete()
                current?.initializeEngine(modelFile)
            } catch (t: Throwable) {
                tmp.delete()
                current?.postJs(
                    "window.kivoModelInstallFailed && window.kivoModelInstallFailed(" +
                        q(t.message ?: "Model installation failed") + ")"
                )
            } finally {
                KivoState.copyingModel = false
                stopServiceIfIdle()
            }
        }
    }

    // ------------------------------------------------------------------ chat

    private fun finishRequest(id: String, error: String?) {
        if (KivoState.activeRequest != id) return
        KivoState.activeRequest = null
        val full = KivoState.pendingTextSnapshot()
        KivoState.finishPending(error)
        val errJs = if (error == null) "null" else q(error)
        current?.postJs("window.kivoNativeResponse && window.kivoNativeResponse(${q(id)}, ${q(full)}, $errJs)")
        stopServiceIfIdle()
    }

    private fun sendMessage(text: String, id: String) {
        if (text.length > 100_000) {
            current?.postJs("window.kivoNativeResponse && window.kivoNativeResponse(${q(id)}, '', 'The message is too long')")
            return
        }
        val engine = KivoState.engine
        if (!KivoState.engineReady || engine == null) {
            current?.postJs("window.kivoNativeResponse && window.kivoNativeResponse(${q(id)}, '', 'MODEL_NOT_READY')")
            return
        }
        if (KivoState.activeRequest != null && !engine.isGenerating) KivoState.activeRequest = null // stale
        if (KivoState.activeRequest != null) {
            current?.postJs("window.kivoNativeResponse && window.kivoNativeResponse(${q(id)}, '', 'Kivo is still busy with the previous reply')")
            return
        }
        KivoState.activeRequest = id
        KivoState.beginPending(id)
        startService("Kivo is thinking…")
        worker.execute {
            try {
                var waited = 0
                while (engine.isGenerating && waited < 3000) {   // a stopped reply may still be winding down
                    Thread.sleep(100)
                    waited += 100
                }
                engine.sendMessageStream(text, object : KivoChatEngine.StreamCallback {
                    override fun onChunk(text: String) {
                        KivoState.appendPending(text)
                        current?.postJs("window.kivoNativeChunk && window.kivoNativeChunk(${q(id)}, ${q(text)})")
                    }

                    override fun onDone() = finishRequest(id, null)
                    override fun onError(message: String) = finishRequest(id, message)
                })
            } catch (t: Throwable) {
                finishRequest(id, t.message ?: "Unknown model error")
            }
        }
    }

    private fun stopGeneration() {
        val id = KivoState.activeRequest ?: return
        KivoState.engine?.cancelGeneration()
        ui.postDelayed({ finishRequest(id, null) }, 1500)
    }

    private fun resetConversation() {
        worker.execute {
            try {
                KivoState.engine?.resetConversation()
            } catch (t: Throwable) {
                // the next message will report any real problem
            }
        }
    }

    // ------------------------------------------------------------------ saving files (system "Save as")

    private fun safeName(name: String): String {
        val n = name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim().take(120)
        return if (n.isEmpty()) "kivo-file" else n
    }

    private fun saveFile(name: String, mime: String, base64: String) {
        longTasks.execute {
            try {
                if (base64.length > 80_000_000) throw IOException("File too large")
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val tmp = File(cacheDir, "pending-save.bin")
                tmp.writeBytes(bytes)
                runOnUiThread {
                    pendingSaveFile?.delete()
                    pendingSaveFile = tmp
                    try {
                        val i = Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType(if (mime.isBlank()) "application/octet-stream" else mime)
                            .putExtra(Intent.EXTRA_TITLE, safeName(name))
                        startActivityForResult(i, REQ_SAVE_FILE)
                    } catch (e: Exception) {
                        tmp.delete()
                        pendingSaveFile = null
                        toast("Could not open the save dialog")
                    }
                }
            } catch (t: Throwable) {
                toast("Could not save the file")
            }
        }
    }

    private fun writeSavedFile(src: File, uri: Uri) {
        longTasks.execute {
            try {
                contentResolver.openOutputStream(uri)?.use { out -> src.inputStream().use { it.copyTo(out) } }
                    ?: throw IOException("no stream")
                toast("Saved")
            } catch (t: Throwable) {
                toast("Could not save the file")
            } finally {
                src.delete()
            }
        }
    }

    // ------------------------------------------------------------------ bar colours follow the page theme

    private fun applyBarColor(css: String) {
        val m = Regex("(\\d+)\\D+(\\d+)\\D+(\\d+)").find(css) ?: return
        val (r, g, b) = m.destructured
        val color = Color.rgb(r.toInt().coerceIn(0, 255), g.toInt().coerceIn(0, 255), b.toInt().coerceIn(0, 255))
        val light = (0.299 * r.toInt() + 0.587 * g.toInt() + 0.114 * b.toInt()) > 150
        runOnUiThread {
            container.setBackgroundColor(color)
            if (Build.VERSION.SDK_INT < 35) {
                window.statusBarColor = color
                window.navigationBarColor = color
            }
            if (Build.VERSION.SDK_INT >= 30) {
                val mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                window.insetsController?.setSystemBarsAppearance(if (light) mask else 0, mask)
            } else {
                val flags = if (light) View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0
                window.decorView.systemUiVisibility = flags
            }
        }
    }

    // ------------------------------------------------------------------ the JavaScript bridge

    /** Exposed to our own pages as window.KivoNative. Every call checks that the page is ours. */
    inner class KivoNativeBridge {

        @JavascriptInterface
        fun isReady(): Boolean = KivoState.engineReady

        @JavascriptInterface
        fun isLoading(): Boolean = KivoState.engineLoading

        @JavascriptInterface
        fun isDownloading(): Boolean = downloader.isRunning

        @JavascriptInterface
        fun getPartialBytes(): Long {
            val p = downloader.partFile(modelsDir)
            return if (p.exists()) p.length() else 0L
        }

        @JavascriptInterface
        fun isMetered(): Boolean = try {
            (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).isActiveNetworkMetered
        } catch (e: Exception) {
            false
        }

        @JavascriptInterface
        fun downloadModel() {
            if (trusted()) startModelDownload()
        }

        @JavascriptInterface
        fun pauseDownload() {
            if (trusted()) downloader.pause()
        }

        @JavascriptInterface
        fun pickModel() {
            if (trusted()) this@MainActivity.pickModel()
        }

        @JavascriptInterface
        fun sendMessage(text: String, id: String) {
            if (trusted()) this@MainActivity.sendMessage(text, id)
        }

        @JavascriptInterface
        fun stop() {
            if (trusted()) stopGeneration()
        }

        @JavascriptInterface
        fun newChat() {
            if (trusted()) resetConversation()
        }

        @JavascriptInterface
        fun getPending(): String = if (trusted()) KivoState.pendingJson() else ""

        @JavascriptInterface
        fun clearPending() {
            if (trusted()) KivoState.clearPending()
        }

        @JavascriptInterface
        fun getVersion(): String = try {
            val info = packageManager.getPackageInfo(packageName, 0)
            val o = JSONObject()
            o.put("name", info.versionName ?: "")
            o.put("code", if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong())
            o.toString()
        } catch (e: Exception) {
            "{}"
        }

        /** Used by FileNest and the Kivo backup: opens the system Save-as dialog. */
        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64: String) {
            if (trusted()) this@MainActivity.saveFile(name, mime, base64)
        }

        /** Called by assets/kivo/host.js with the page background colour (rgb(...)). */
        @JavascriptInterface
        fun setBarColor(css: String) {
            if (trusted()) applyBarColor(css)
        }
    }
}
