package com.digitalalbum.musicbridge

import org.json.JSONObject

data class Playback(val fingerprint: String, val body: JSONObject)

class WiiMClient(private val host: String) {
    private var scheme: String? = null
    private fun command(name: String): JSONObject {
        val schemes = listOfNotNull(scheme, "https", "http").distinct()
        for (candidate in schemes) {
            val response = runCatching { HttpJson.get("$candidate://$host/httpapi.asp?command=$name") }.getOrNull()
            if (response != null) {
                scheme = candidate
                return response
            }
        }
        throw IllegalStateException("WiiM did not respond over HTTPS or HTTP")
    }
    private fun decode(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val compact = value.replace("\\s".toRegex(), "")
        val decoded = if (compact.length % 2 == 0 && compact.matches(Regex("[0-9a-fA-F]+"))) {
            runCatching { compact.chunked(2).map { it.toInt(16).toByte() }.toByteArray().toString(Charsets.UTF_8) }.getOrDefault(value)
        } else value
        // WiiM can return a UTF-8 value encoded as hex that still contains HTML
        // entities. Decode entities after hex decoding so titles such as
        // "I&apos;ll String Along With You" remain ordinary text end to end.
        return decoded
            .replace(Regex("&apos;|&#39;|&#x27;", RegexOption.IGNORE_CASE), "'")
            .replace(Regex("&quot;|&#34;|&#x22;", RegexOption.IGNORE_CASE), "\"")
            .replace(Regex("&amp;", RegexOption.IGNORE_CASE), "&")
    }
    fun nowPlaying(): Playback {
        val status = command("getStatusEx")
        val device = status.optJSONObject("device") ?: status
        // Some WiiM firmwares expose player data directly in getStatusEx; keep that
        // response as a fallback when getPlayerStatus is absent or formatted differently.
        val playerResponse = runCatching { command("getPlayerStatus") }.getOrNull()
        val player = playerResponse?.optJSONObject("player") ?: playerResponse ?: status.optJSONObject("player") ?: status
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
