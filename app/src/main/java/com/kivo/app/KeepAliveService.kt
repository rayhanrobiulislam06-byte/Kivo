package com.kivo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/** Foreground service that keeps Kivo alive while it downloads, loads or runs the model. */
class KeepAliveService : Service() {

    companion object {
        const val CHANNEL_ID = "kivo_engine"
        const val NOTIFICATION_ID = 7
        private const val EXTRA_TEXT = "text"

        fun start(context: Context, text: String) {
            try {
                val i = Intent(context, KeepAliveService::class.java).putExtra(EXTRA_TEXT, text)
                context.startForegroundService(i)
            } catch (t: Throwable) {
                // The app was not allowed to start a foreground service right now: carry on without it.
            }
        }

        fun stop(context: Context) {
            try {
                context.stopService(Intent(context, KeepAliveService::class.java))
            } catch (t: Throwable) {
                // ignore
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val text = intent?.getStringExtra(EXTRA_TEXT) ?: "Kivo is running"
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(text: String): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Kivo AI engine", NotificationManager.IMPORTANCE_LOW)
        )
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Kivo")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_kivo)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }
}
