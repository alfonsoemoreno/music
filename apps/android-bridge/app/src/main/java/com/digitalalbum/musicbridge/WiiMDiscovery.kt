package com.digitalalbum.musicbridge

import android.content.Context
import android.net.wifi.WifiManager
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.URI

object WiiMDiscovery {
    private const val search = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n"
    fun find(context: Context): String? {
        val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
        val lock = wifi.createMulticastLock("music-bridge-discovery").apply { setReferenceCounted(false); acquire() }
        try {
            DatagramSocket().use { socket ->
                socket.soTimeout = 2_500
                repeat(2) { socket.send(DatagramPacket(search.toByteArray(), search.length, InetAddress.getByName("239.255.255.250"), 1900)) }
                val buffer = ByteArray(4_096)
                while (true) {
                    val packet = DatagramPacket(buffer, buffer.size)
                    socket.receive(packet)
                    val response = String(packet.data, 0, packet.length, Charsets.UTF_8)
                    val location = response.lineSequence().firstOrNull { it.startsWith("location:", true) }?.substringAfter(':')?.trim() ?: continue
                    val host = URI(location).host ?: continue
                    val status = runCatching { HttpJson.get("http://$host/httpapi.asp?command=getStatusEx") }.getOrNull() ?: continue
                    // getStatusEx differs by firmware: Ultra returns its fields nested in `device`.
                    val device = status.optJSONObject("device") ?: status
                    if (device.optString("project").contains("WiiM", true) || device.optString("DeviceName").contains("WiiM", true)) return host
                }
            }
        } catch (_: Exception) { return null } finally { lock.release() }
    }
}
