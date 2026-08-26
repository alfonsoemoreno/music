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
        return BridgeConfig(MusicCloud.url, bridge, installationId())
    }
    fun save(bridgeId: String) = storage.edit().putString("server_url", MusicCloud.url).putString("bridge_id", bridgeId).apply()
    fun runtimeStatus(): String? = storage.getString("runtime_status", null)
    fun setRuntimeStatus(value: String) = storage.edit().putString("runtime_status", value).apply()
}
