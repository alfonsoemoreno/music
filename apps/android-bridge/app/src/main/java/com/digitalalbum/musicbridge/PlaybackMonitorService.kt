package com.digitalalbum.musicbridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * Runs only while Android displays the persistent Music Bridge notification.
 * The bridge keeps WiiM traffic on the local network and posts only meaningful
 * playback changes to the user's cloud app.
 */
class PlaybackMonitorService : Service() {
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private var polling: ScheduledFuture<*>? = null
    private var lastFingerprint: String? = null
    private var host: String? = null
    private var failedPolls = 0
    private var statusText = "Buscando WiiM en esta red Wi‑Fi"

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(notificationId, notification())
        if (polling == null) {
            polling = executor.scheduleWithFixedDelay(::poll, 0, pollIntervalMs, TimeUnit.MILLISECONDS)
        }
        return START_STICKY
    }

    private fun poll() {
        val config = BridgePreferences(this).configuration() ?: return
        val activeHost = host ?: WiiMDiscovery.find(this)?.also {
            host = it
            updateStatus("WiiM encontrado: $it")
        } ?: run {
            updateStatus("Buscando WiiM en esta red Wi‑Fi")
            return
        }
        try {
            val playback = WiiMClient(activeHost).nowPlaying()
            failedPolls = 0
            if (playback.fingerprint != lastFingerprint) {
                CloudClient.sendPlayback(config, playback.body)
                lastFingerprint = playback.fingerprint
                updateStatus("WiiM conectado · reproducción sincronizada")
            }
        } catch (error: Exception) {
            Log.w("MusicBridge", "WiiM polling failed", error)
            failedPolls += 1
            updateStatus("No se pudo consultar el WiiM; reintentando…")
            // Re-discover after a device/IP change without spamming the LAN.
            if (failedPolls >= 3) {
                host = null
                failedPolls = 0
            }
        }
    }

    private fun notification() = android.app.Notification.Builder(this, channelId)
        .setContentTitle("Music Bridge activo")
        .setContentText(statusText)
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setOngoing(true)
        .build()

    private fun updateStatus(text: String) {
        if (statusText == text) return
        statusText = text
        getSystemService(NotificationManager::class.java).notify(notificationId, notification())
    }

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(channelId, "Music Bridge", NotificationManager.IMPORTANCE_LOW))
        }
    }

    override fun onDestroy() {
        polling?.cancel(true)
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val channelId = "music_bridge_status"
        private const val notificationId = 1001
        private const val pollIntervalMs = 2_000L

        fun start(context: Context) {
            val intent = Intent(context, PlaybackMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
        }

        fun stop(context: Context) = context.stopService(Intent(context, PlaybackMonitorService::class.java))
    }
}
