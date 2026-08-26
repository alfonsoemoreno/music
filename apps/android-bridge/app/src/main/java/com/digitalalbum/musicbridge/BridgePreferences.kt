package com.digitalalbum.musicbridge

import android.content.Context
import java.util.UUID

data class BridgeConfig(val serverUrl: String, val bridgeId: String, val installationId: String)

class BridgePreferences(context: Context) {
    private val storage = context.getSharedPreferences("music_bridge", Context.MODE_PRIVATE)
    fun installationId(): String = storage.getString("installation_id", null) ?: UUID.randomUUID().toString().also { storage.edit().putString("installation_id", it).apply() }
    fun configuration(): BridgeConfig? {
        val server = storage.getString("server_url", null) ?: return null
        val bridge = storage.getString("bridge_id", null) ?: return null
        return BridgeConfig(server, bridge, installationId())
    }
    fun save(serverUrl: String, bridgeId: String) = storage.edit().putString("server_url", serverUrl.trimEnd('/')).putString("bridge_id", bridgeId).apply()
}
