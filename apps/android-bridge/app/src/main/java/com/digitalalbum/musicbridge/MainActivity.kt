package com.digitalalbum.musicbridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var enrollmentCode: EditText
    private lateinit var bridgeName: EditText
    private lateinit var status: TextView
    private lateinit var connect: Button
    private val statusHandler = Handler(Looper.getMainLooper())
    private val refreshStatus = object : Runnable {
        override fun run() {
            BridgePreferences(this@MainActivity).runtimeStatus()?.let { status.text = it }
            statusHandler.postDelayed(this, 1_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestRelevantPermissions()
        val padding = (24 * resources.displayMetrics.density).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(padding, padding, padding, padding)
        }
        val title = TextView(this).apply { text = "Music Bridge"; textSize = 30f }
        val description = TextView(this).apply {
            text = "Este teléfono descubre el WiiM en tu Wi‑Fi y envía los cambios de disco a Music. Se conecta automáticamente a musicwiim.vercel.app."
            textSize = 16f
            setPadding(0, padding / 2, 0, padding)
        }
        enrollmentCode = field("PIN de 6 dígitos mostrado en Music", InputType.TYPE_CLASS_NUMBER).apply { maxEms = 6 }
        bridgeName = field("Nombre del puente", InputType.TYPE_CLASS_TEXT).apply { setText("Android Music Bridge") }
        connect = Button(this).apply { text = "Emparejar y comenzar" }
        status = TextView(this).apply { textSize = 15f; setPadding(0, padding, 0, 0) }
        layout.addView(title)
        layout.addView(description)
        layout.addView(enrollmentCode)
        layout.addView(bridgeName)
        layout.addView(connect)
        layout.addView(status)
        setContentView(layout)

        BridgePreferences(this).configuration()?.let { config ->
            enrollmentCode.visibility = View.GONE
            connect.text = "Iniciar Music Bridge"
            status.text = BridgePreferences(this).runtimeStatus() ?: "Este teléfono ya está emparejado. Déjalo conectado a la misma Wi‑Fi que el WiiM."
        }
        connect.setOnClickListener { begin() }
    }

    private fun field(hint: String, inputType: Int): EditText = EditText(this).apply {
        this.hint = hint
        this.inputType = inputType
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun begin() {
        if (!hasLocalNetworkAccess()) {
            requestRelevantPermissions()
            status.text = "Autoriza Dispositivos cercanos para que Music Bridge pueda encontrar tu WiiM en la red local."
            return
        }
        val existing = BridgePreferences(this).configuration()
        if (existing != null) {
            PlaybackMonitorService.start(this)
            status.text = "Music Bridge está activo. Android mostrará una notificación persistente mientras funciona."
            return
        }
        val code = enrollmentCode.text.toString().trim()
        val name = bridgeName.text.toString().trim().ifBlank { "Android Music Bridge" }
        if (!code.matches(Regex("\\d{6}"))) {
            status.text = "Ingresa el PIN de seis dígitos mostrado en Music."
            return
        }
        connect.isEnabled = false
        status.text = "Emparejando de forma segura…"
        worker.execute {
            try {
                val bridgeId = CloudClient.activate(this, code, name)
                BridgePreferences(this).save(bridgeId)
                PlaybackMonitorService.start(this)
                runOnUiThread {
                    enrollmentCode.visibility = View.GONE
                    connect.text = "Iniciar Music Bridge"
                    connect.isEnabled = true
                    status.text = "Emparejado. Music Bridge está buscando el WiiM en esta Wi‑Fi."
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connect.isEnabled = true
                    status.text = "No se pudo emparejar: ${error.message ?: "error de conexión"}"
                }
            }
        }
    }

    private fun requestRelevantPermissions() {
        val permissions = buildList {
            if (Build.VERSION.SDK_INT >= 37) add(Manifest.permission.ACCESS_LOCAL_NETWORK)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
                add(Manifest.permission.NEARBY_WIFI_DEVICES)
            }
        }
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()
        if (permissions.isNotEmpty()) requestPermissions(permissions, 42)
    }

    private fun hasLocalNetworkAccess(): Boolean =
        Build.VERSION.SDK_INT < 37 || checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) == PackageManager.PERMISSION_GRANTED

    override fun onDestroy() {
        worker.shutdownNow()
        statusHandler.removeCallbacks(refreshStatus)
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        statusHandler.post(refreshStatus)
    }

    override fun onPause() {
        statusHandler.removeCallbacks(refreshStatus)
        super.onPause()
    }
}
