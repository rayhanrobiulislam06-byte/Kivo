package com.kivo.app

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLongArray
import java.util.concurrent.atomic.AtomicReference

/**
 * Model download in 8 parallel byte ranges (about as fast as aria2c with 8 connections).
 * Progress of every segment is kept in "<name>.part.state", so pause, app restarts and network
 * drops resume exactly where each segment stopped. An old single-stream ".part" is converted
 * automatically. If the server cannot serve byte ranges it falls back to one connection.
 * The finished file is verified with SHA-256 before it is renamed.
 */
class ModelDownloader {

    interface Listener {
        fun onProgress(done: Long, total: Long)
        fun onVerifying()
    }

    class DownloadException(message: String) : Exception(message)
    class CancelledException : Exception()

    companion object {
        private const val SEGMENTS = 8
        private val RANGE = Regex("bytes (\\d+)-(\\d+)/(\\d+|\\*)")
    }

    private val total = ModelConfig.TOTAL_BYTES
    private val segSize = (total + SEGMENTS - 1) / SEGMENTS

    private fun segStart(i: Int): Long = i * segSize
    private fun segLen(i: Int): Long = if (i == SEGMENTS - 1) total - segStart(i) else segSize

    @Volatile
    private var stopRequested = false

    @Volatile
    var isRunning = false
        private set

    /** Atomically claims the downloader; false when a download is already running. Clears an old pause request. */
    @Synchronized
    fun tryBegin(): Boolean {
        if (isRunning) return false
        isRunning = true
        stopRequested = false
        return true
    }

    fun pause() {
        stopRequested = true
    }

    fun partFile(dir: File): File = File(dir, ModelConfig.NAME + ".part")
    private fun stateFile(dir: File): File = File(dir, ModelConfig.NAME + ".part.state")

    /** Bytes already downloaded (works for the new segmented state and for an old single-stream .part). */
    fun partialBytes(dir: File): Long {
        val s = readState(stateFile(dir))
        if (s != null) return s.sum()
        val p = partFile(dir)
        return if (p.exists()) minOf(p.length(), total) else 0L
    }

    fun clearPartial(dir: File) {
        partFile(dir).delete()
        stateFile(dir).delete()
        File(stateFile(dir).path + ".tmp").delete()
    }

    /** SHA-256 of a file, not cancellable (used to check an imported model). */
    fun sha256Of(file: File): String = sha256(file, false)

    /** Call tryBegin() first. */
    fun download(dir: File, listener: Listener): File {
        try {
            return run(dir, listener)
        } finally {
            isRunning = false
        }
    }

    private fun run(dir: File, listener: Listener): File {
        dir.mkdirs()
        val part = partFile(dir)
        val state = stateFile(dir)
        val target = File(dir, ModelConfig.NAME)

        val done = AtomicLongArray(SEGMENTS)
        val loaded = loadProgress(part, state)
        for (i in 0 until SEGMENTS) done.set(i, loaded[i])
        val have = sum(done)

        if (have < total) {
            val need = total - have + ModelConfig.FREE_SPACE_MARGIN
            if (dir.usableSpace < need) {
                val gb = need / (1024L * 1024L * 1024L) + 1
                throw DownloadException("Not enough free storage. Free up about $gb GB and try again.")
            }
            listener.onProgress(have, total)
            if (!fetchParallel(part, state, done, listener)) {
                // the server cannot serve byte ranges: one classic connection, from the start
                part.delete()
                state.delete()
                fetch(part, 0L, listener)
            }
        }
        state.delete()

        if (part.length() != total) {
            throw DownloadException("The download is incomplete. Tap Try again to continue.")
        }

        listener.onVerifying()
        val digest = sha256(part, true)
        if (!digest.equals(ModelConfig.SHA256, ignoreCase = true)) {
            part.delete()
            throw DownloadException("The downloaded file is damaged. Please download it again.")
        }
        if (target.exists()) target.delete()
        if (!part.renameTo(target)) {
            throw DownloadException("Could not finalize model file")
        }
        return target
    }

    // ------------------------------------------------------------------ progress bookkeeping

    private fun sum(done: AtomicLongArray): Long {
        var s = 0L
        for (i in 0 until SEGMENTS) s += done.get(i)
        return s
    }

    private fun readState(state: File): LongArray? {
        if (!state.exists()) return null
        return try {
            val out = LongArray(SEGMENTS)
            val lines = state.readLines().filter { it.isNotBlank() }
            if (lines.size != SEGMENTS) return null
            for (line in lines) {
                val p = line.split(":")
                val i = p[0].trim().toInt()
                val v = p[1].trim().toLong()
                if (i !in 0 until SEGMENTS || v < 0 || v > segLen(i)) return null
                out[i] = v
            }
            out
        } catch (e: Exception) {
            null
        }
    }

    private fun writeState(state: File, done: AtomicLongArray) {
        try {
            val tmp = File(state.path + ".tmp")
            tmp.writeText((0 until SEGMENTS).joinToString("\n") { "$it:${done.get(it)}" })
            if (!tmp.renameTo(state)) {
                state.delete()
                tmp.renameTo(state)
            }
        } catch (e: IOException) {
            // progress is also recoverable from the next successful save
        }
    }

    private fun loadProgress(part: File, state: File): LongArray {
        val fromState = readState(state)
        if (fromState != null) return fromState
        val out = LongArray(SEGMENTS)
        if (!part.exists()) return out
        val len = part.length()
        if (len > total) {
            part.delete()
            return out
        }
        // an old single-stream download: the first `len` bytes are done
        for (i in 0 until SEGMENTS) out[i] = (len - segStart(i)).coerceIn(0L, segLen(i))
        return out
    }

    // ------------------------------------------------------------------ parallel download

    private fun fetchParallel(part: File, state: File, done: AtomicLongArray, listener: Listener): Boolean {
        writeState(state, done)  // before any data is written, so a crash can never leave an unmapped .part
        val err = AtomicReference<Throwable?>(null)
        val rangeBad = AtomicBoolean(false)
        val pool = Executors.newFixedThreadPool(SEGMENTS)
        val futures = ArrayList<Future<*>>()
        for (i in 0 until SEGMENTS) {
            futures.add(pool.submit(Runnable { worker(i, part, done, err, rangeBad) }))
        }
        var lastSave = 0L
        try {
            while (futures.any { !it.isDone }) {
                Thread.sleep(300)
                listener.onProgress(sum(done), total)
                val now = System.nanoTime()
                if (now - lastSave > 1_500_000_000L) {
                    lastSave = now
                    writeState(state, done)
                }
            }
        } finally {
            pool.shutdownNow()
            writeState(state, done)
        }
        if (stopRequested) throw CancelledException()
        val e = err.get()
        if (e != null) {
            throw if (e is DownloadException) e else DownloadException(e.message ?: "Download failed")
        }
        if (rangeBad.get()) return false
        if (sum(done) < total) throw DownloadException("The download is incomplete. Tap Resume to continue.")
        listener.onProgress(sum(done), total)
        RandomAccessFile(part, "rw").use { it.setLength(total) }
        return true
    }

    private fun worker(i: Int, part: File, done: AtomicLongArray, err: AtomicReference<Throwable?>, rangeBad: AtomicBoolean) {
        val base = segStart(i)
        val len = segLen(i)
        var failures = 0
        while (done.get(i) < len) {
            if (stopRequested || err.get() != null || rangeBad.get()) return
            val before = done.get(i)
            try {
                val from = base + before
                val to = base + len - 1
                val c = open(from, to)
                val code = c.responseCode
                if (code == 200) {          // the server ignored the Range header
                    c.disconnect()
                    rangeBad.set(true)
                    return
                }
                if (code != 206) {
                    c.disconnect()
                    throw IOException("Server error $code")
                }
                val m = RANGE.find(c.getHeaderField("Content-Range") ?: "")
                if (m == null || m.groupValues[1].toLong() != from) {
                    c.disconnect()
                    throw IOException("Unexpected data range from the server")
                }
                RandomAccessFile(part, "rw").use { raf ->
                    raf.seek(from)
                    c.inputStream.use { input ->
                        val buf = ByteArray(128 * 1024)
                        while (done.get(i) < len) {
                            if (stopRequested || rangeBad.get() || err.get() != null) break
                            val want = minOf(buf.size.toLong(), len - done.get(i)).toInt()
                            val n = input.read(buf, 0, want)
                            if (n < 0) break
                            raf.write(buf, 0, n)
                            done.addAndGet(i, n.toLong())
                        }
                    }
                }
                c.disconnect()
            } catch (e: Exception) {
                // network error or server hiccup: handled below together with "no progress"
            }
            if (done.get(i) == before) {
                failures++
                if (failures > 6) {
                    err.compareAndSet(null, DownloadException("Network problem. Check your connection and tap Resume."))
                    return
                }
                try {
                    Thread.sleep(1500L * failures)
                } catch (ie: InterruptedException) {
                    return
                }
            } else {
                failures = 0
            }
        }
    }

    private fun open(start: Long, end: Long): HttpURLConnection {
        var url = URL(ModelConfig.URL)
        for (hop in 0 until 6) {
            val c = url.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 20_000
            c.readTimeout = 30_000
            c.setRequestProperty("User-Agent", "Kivo-Android")
            c.setRequestProperty("Accept-Encoding", "identity")
            if (end >= 0) c.setRequestProperty("Range", "bytes=$start-$end")
            else if (start > 0) c.setRequestProperty("Range", "bytes=$start-")
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location")
                c.disconnect()
                if (loc == null) throw DownloadException("Bad redirect from the server")
                url = URL(url, loc)
                continue
            }
            return c
        }
        throw DownloadException("Too many redirects")
    }

    // ------------------------------------------------------------------ single connection fallback

    private fun fetch(part: File, startAt: Long, listener: Listener) {
        var start = startAt
        var failures = 0
        while (true) {
            try {
                val c = open(start, -1L)
                val code = c.responseCode
                if (code == 416) {
                    c.disconnect()
                    if (part.length() >= total) return
                    part.delete()
                    start = 0L
                    continue
                }
                if (code != 200 && code != 206) {
                    c.disconnect()
                    throw DownloadException("Server error $code")
                }
                if (code == 206) {
                    val m = RANGE.find(c.getHeaderField("Content-Range") ?: "")
                    if (m == null || m.groupValues[1].toLong() != start) {
                        c.disconnect()
                        failures++
                        if (failures > 5) throw DownloadException("The server sent an unexpected data range. Please try again later.")
                        part.delete()
                        start = 0L
                        continue
                    }
                }
                val from = if (code == 206) start else 0L
                RandomAccessFile(part, "rw").use { raf ->
                    if (from == 0L) raf.setLength(0L)
                    raf.seek(from)
                    c.inputStream.use { input ->
                        val buf = ByteArray(256 * 1024)
                        var got = from
                        var lastReport = 0L
                        while (true) {
                            if (stopRequested) throw CancelledException()
                            val n = input.read(buf)
                            if (n < 0) break
                            raf.write(buf, 0, n)
                            got += n
                            val now = System.nanoTime()
                            if (now - lastReport > 400_000_000L) {
                                lastReport = now
                                listener.onProgress(got, total)
                            }
                        }
                        listener.onProgress(got, total)
                    }
                }
                c.disconnect()
                return
            } catch (e: CancelledException) {
                throw e
            } catch (e: DownloadException) {
                throw e
            } catch (e: IOException) {
                if (stopRequested) throw CancelledException()
                failures++
                if (failures > 5) throw DownloadException("Network problem: " + (e.message ?: "connection lost"))
                start = if (part.exists()) part.length() else 0L
                Thread.sleep(2000L * failures)
            }
        }
    }

    private fun sha256(file: File, cancellable: Boolean): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(1 shl 20)
            while (true) {
                if (cancellable && stopRequested) throw CancelledException()
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
