package com.kivo.app

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Resumable model download: HTTP Range requests into "<name>.part", automatic retries,
 * SHA-256 check, then an atomic rename. pause() stops it; calling download() again resumes.
 */
class ModelDownloader {

    interface Listener {
        fun onProgress(done: Long, total: Long)
        fun onVerifying()
    }

    class DownloadException(message: String) : Exception(message)
    class CancelledException : Exception()

    @Volatile
    private var stopRequested = false

    @Volatile
    var isRunning = false
        private set

    fun pause() {
        stopRequested = true
    }

    fun partFile(dir: File): File = File(dir, ModelConfig.NAME + ".part")

    fun download(dir: File, listener: Listener): File {
        isRunning = true
        stopRequested = false
        try {
            return run(dir, listener)
        } finally {
            isRunning = false
        }
    }

    private fun run(dir: File, listener: Listener): File {
        dir.mkdirs()
        val part = partFile(dir)
        val target = File(dir, ModelConfig.NAME)
        val total = ModelConfig.TOTAL_BYTES

        var have = if (part.exists()) part.length() else 0L
        if (have > total) {
            part.delete()
            have = 0L
        }
        if (have < total) {
            val need = total - have + ModelConfig.FREE_SPACE_MARGIN
            if (dir.usableSpace < need) {
                val gb = need / (1024L * 1024L * 1024L) + 1
                throw DownloadException("Not enough free storage. Free up about $gb GB and try again.")
            }
            fetch(part, have, listener)
        }

        if (part.length() != total) {
            throw DownloadException("The download is incomplete. Tap Try again to continue.")
        }

        listener.onVerifying()
        val digest = sha256(part)
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

    private fun open(start: Long): HttpURLConnection {
        var url = URL(ModelConfig.URL)
        for (hop in 0 until 6) {
            val c = url.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 20_000
            c.readTimeout = 30_000
            c.setRequestProperty("User-Agent", "Kivo-Android")
            c.setRequestProperty("Accept-Encoding", "identity")
            if (start > 0) c.setRequestProperty("Range", "bytes=$start-")
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

    private fun fetch(part: File, startAt: Long, listener: Listener) {
        val total = ModelConfig.TOTAL_BYTES
        var start = startAt
        var failures = 0
        while (true) {
            try {
                val c = open(start)
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
                val from = if (code == 206) start else 0L
                RandomAccessFile(part, "rw").use { raf ->
                    if (from == 0L) raf.setLength(0L)
                    raf.seek(from)
                    c.inputStream.use { input ->
                        val buf = ByteArray(256 * 1024)
                        var done = from
                        var lastReport = 0L
                        while (true) {
                            if (stopRequested) throw CancelledException()
                            val n = input.read(buf)
                            if (n < 0) break
                            raf.write(buf, 0, n)
                            done += n
                            val now = System.nanoTime()
                            if (now - lastReport > 400_000_000L) {
                                lastReport = now
                                listener.onProgress(done, total)
                            }
                        }
                        listener.onProgress(done, total)
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

    private fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(1 shl 20)
            while (true) {
                if (stopRequested) throw CancelledException()
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
