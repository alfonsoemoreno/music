package com.digitalalbum.musicbridge

import android.content.Context
import org.json.JSONObject
import java.util.UUID

object CloudClient {
    fun activate(context: Context, enrollmentCode: String, name: String): String {
        val preferences = BridgePreferences(context)
        val response = HttpJson.post("${MusicCloud.url}/api/bridges/activate", JSONObject()
            .put("enrollmentCode", enrollmentCode)
            .put("installationId", preferences.installationId())
            .put("name", name)
            .put("publicKey", KeystoreSigner.publicKey()).toString())
        return response.getString("bridgeId")
    }
    fun sendPlayback(config: BridgeConfig, playback: JSONObject) {
        val body = playback.toString()
        val timestamp = System.currentTimeMillis().toString()
        val nonce = UUID.randomUUID().toString()
        val signature = KeystoreSigner.sign("$timestamp.$nonce.$body")
        HttpJson.post("${config.serverUrl}/api/bridges/playback", body, mapOf("x-music-bridge-id" to config.bridgeId, "x-music-timestamp" to timestamp, "x-music-nonce" to nonce, "x-music-signature" to signature))
    }
}
