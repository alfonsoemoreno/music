package com.digitalalbum.musicbridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var enrollmentCode: EditText
    private lateinit var bridgeName: EditText
    private lateinit var status: TextView
    private lateinit var connect: Button
    private lateinit var linkScreen: Button
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
        val padding = dp(24)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(Color.rgb(18, 15, 14))
        }
        val mark = TextView(this).apply { text = "M"; textSize = 26f; gravity = Gravity.CENTER; setTextColor(Color.rgb(32, 24, 20)); typeface = Typeface.create("serif", Typeface.BOLD); background = rounded(Color.rgb(214, 185, 132), 0); layoutParams = LinearLayout.LayoutParams(dp(54), dp(54)).apply { gravity = Gravity.CENTER_HORIZONTAL; bottomMargin = dp(22) } }
        val eyebrow = TextView(this).apply { text = "DIGITAL ALBUM COMPANION"; textSize = 11f; letterSpacing = .14f; gravity = Gravity.CENTER; setTextColor(Color.rgb(179, 157, 135)) }
        val title = TextView(this).apply { text = "Music Bridge"; textSize = 34f; gravity = Gravity.CENTER; setTextColor(Color.rgb(244, 237, 227)); typeface = Typeface.create("serif", Typeface.BOLD); setPadding(0, dp(6), 0, 0) }
        val description = TextView(this).apply {
            text = "Tu enlace privado entre el WiiM de casa y Music. Descubre el reproductor automáticamente y sincroniza solo los cambios de álbum."
            textSize = 16f; gravity = Gravity.CENTER; setTextColor(Color.rgb(202, 187, 172)); setLineSpacing(dp(3).toFloat(), 1f)
            setPadding(0, dp(15), 0, dp(26))
        }
        enrollmentCode = field("PIN de 6 dígitos mostrado en Music", InputType.TYPE_CLASS_NUMBER).apply { maxEms = 6 }
        bridgeName = field("Nombre de este puente", InputType.TYPE_CLASS_TEXT).apply { setText("Music Bridge · ${Build.MODEL}") }
        connect = Button(this).apply { text = "EMPAREJAR Y COMENZAR"; setTextColor(Color.rgb(31, 23, 19)); textSize = 12f; letterSpacing = .08f; typeface = Typeface.DEFAULT_BOLD; background = rounded(Color.rgb(214, 185, 132), dp(2)); layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(8) } }
        linkScreen = Button(this).apply { text = "VINCULAR OTRA PANTALLA"; setTextColor(Color.rgb(197, 172, 138)); textSize = 11f; letterSpacing = .08f; background = rounded(Color.TRANSPARENT, dp(2), Color.rgb(94, 76, 64)); layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(10) }; visibility = View.GONE }
        status = TextView(this).apply { textSize = 15f; setTextColor(Color.rgb(221, 207, 191)); setLineSpacing(dp(3).toFloat(), 1f); background = rounded(Color.rgb(38, 30, 26), dp(2), Color.rgb(90, 73, 62)); setPadding(dp(16), dp(15), dp(16), dp(15)); layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(20) } }
        val privacy = TextView(this).apply { text = "✓ Sin puertos abiertos  ·  ✓ Firma protegida en Android  ·  ✓ Solo envía cambios de reproducción"; textSize = 11f; gravity = Gravity.CENTER; setTextColor(Color.rgb(139, 124, 111)); setLineSpacing(dp(2).toFloat(), 1f); setPadding(dp(8), dp(20), dp(8), 0) }
        layout.addView(mark)
        layout.addView(eyebrow)
        layout.addView(title)
        layout.addView(description)
        layout.addView(enrollmentCode)
        layout.addView(bridgeName)
        layout.addView(connect)
        layout.addView(linkScreen)
        layout.addView(status)
        layout.addView(privacy)
        setContentView(ScrollView(this).apply { addView(layout, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)) })

        BridgePreferences(this).configuration()?.let {
            enrollmentCode.visibility = View.GONE
            bridgeName.visibility = View.GONE
            connect.text = "Reintentar detección WiiM"
            linkScreen.visibility = View.VISIBLE
            status.text = BridgePreferences(this).runtimeStatus() ?: "Este teléfono ya está emparejado. Déjalo conectado a la misma Wi‑Fi que el WiiM."
            // Android may stop a foreground service during an app update or a manual
            // force-stop. Re-establish it whenever the already paired app is opened.
            if (hasLocalNetworkAccess()) PlaybackMonitorService.start(this)
        }
        connect.setOnClickListener { begin() }
        linkScreen.setOnClickListener {
            enrollmentCode.setText("")
            enrollmentCode.visibility = View.VISIBLE
            enrollmentCode.requestFocus()
            connect.text = "VINCULAR ESTA PANTALLA"
            linkScreen.visibility = View.GONE
            status.text = "Escribe el PIN mostrado en la nueva pantalla de Music. Tu conexión actual seguirá funcionando."
        }
    }

    private fun field(hint: String, inputType: Int): EditText = EditText(this).apply {
        this.hint = hint
        this.inputType = inputType
        setHintTextColor(Color.rgb(150, 135, 123)); setTextColor(Color.rgb(241, 232, 220)); textSize = 16f
        background = rounded(Color.rgb(31, 24, 20), dp(2), Color.rgb(88, 72, 62)); setPadding(dp(15), 0, dp(15), 0)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) }
    }

    private fun rounded(color: Int, radius: Int, stroke: Int? = null): GradientDrawable = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat(); stroke?.let { setStroke(dp(1), it) } }
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun begin() {
        if (!hasLocalNetworkAccess()) {
            requestRelevantPermissions()
            status.text = "Autoriza Dispositivos cercanos para que Music Bridge pueda encontrar tu WiiM en la red local."
            return
        }
        val existing = BridgePreferences(this).configuration()
        val code = enrollmentCode.text.toString().trim()
        if (code.matches(Regex("\\d{6}"))) {
            val name = bridgeName.text.toString().trim().ifBlank { "Music Bridge · ${Build.MODEL}" }
            connect.isEnabled = false
            status.text = "Vinculando de forma segura…"
            worker.execute {
                try {
                    val bridgeId = CloudClient.activate(this, code, name)
                    BridgePreferences(this).save(bridgeId)
                    // Restarting resets the in-memory fingerprint, so the newly
                    // linked screen receives the album already playing right away.
                    PlaybackMonitorService.restart(this)
                    runOnUiThread {
                        enrollmentCode.visibility = View.GONE
                        bridgeName.visibility = View.GONE
                        linkScreen.visibility = View.VISIBLE
                        connect.text = "Reintentar detección WiiM"
                        connect.isEnabled = true
                        status.text = "Pantalla vinculada. Music Bridge está buscando el WiiM en esta Wi‑Fi."
                    }
                } catch (error: Exception) {
                    runOnUiThread { connect.isEnabled = true; status.text = "No se pudo vincular: ${error.message ?: "error de conexión"}" }
                }
            }
            return
        }
        if (existing != null) {
            BridgePreferences(this).setRuntimeStatus("Reiniciando búsqueda de WiiM…")
            PlaybackMonitorService.restart(this)
            status.text = "Reiniciando búsqueda de WiiM…"
            return
        }
        if (!code.matches(Regex("\\d{6}"))) {
            status.text = "Ingresa el PIN de seis dígitos mostrado en Music."
            return
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
