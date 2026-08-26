package com.digitalalbum.musicbridge

import org.json.JSONObject

data class Playback(val fingerprint: String, val body: JSONObject)

class WiiMClient(private val host: String) {
    private fun command(name: String): JSONObject = HttpJson.get("http://$host/httpapi.asp?command=$name")
    private fun decode(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val compact = value.replace("\\s".toRegex(), "")
        if (compact.length % 2 == 0 && compact.matches(Regex("[0-9a-fA-F]+"))) {
            return runCatching { compact.chunked(2).map { it.toInt(16).toByte() }.toByteArray().toString(Charsets.UTF_8) }.getOrDefault(value)
        }
        return value.replace("&apos;", "'").replace("&#39;", "'").replace("&amp;", "&")
    }
    fun nowPlaying(): Playback {
        val device = command("getStatusEx")
        val player = command("getPlayerStatus")
        val artist = decode(player.optString("Artist").ifBlank { player.optString("artist") }) ?: "Unknown artist"
        val title = decode(player.optString("Title").ifBlank { player.optString("title") }) ?: "Unknown track"
        val albumTitle = decode(player.optString("Album").ifBlank { player.optString("album") })
        val vendor = decode(player.optString("vendor")) ?: "WiiM"
        val state = when (player.optString("status")) { "play", "playing" -> "playing"; "pause", "paused" -> "paused"; else -> "stopped" }
        val payload = JSONObject()
            .put("agentVersion", "android-bridge-0.1.0")
            .put("deviceId", device.optString("uuid").ifBlank { host })
            .put("playbackProvider", vendor.lowercase().replace(Regex("[^a-z0-9]+"), ""))
            .put("source", vendor)
            .put("artist", JSONObject().put("name", artist))
            .put("track", JSONObject().put("title", title).put("durationMs", player.optLong("totlen", 0)))
            .put("playback", JSONObject().put("state", state))
        if (!albumTitle.isNullOrBlank()) payload.put("album", JSONObject().put("title", albumTitle))
        return Playback(listOf(vendor, artist, albumTitle.orEmpty(), title, state).joinToString("|").lowercase(), payload)
    }
}
