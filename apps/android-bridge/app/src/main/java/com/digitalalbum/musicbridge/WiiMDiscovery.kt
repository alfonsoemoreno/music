package com.digitalalbum.musicbridge

import android.content.Context
import android.net.wifi.WifiManager
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.ExecutorCompletionService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

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
                    if (isWiiM(host)) return host
                }
            }
        } catch (_: Exception) { /* Some routers block SSDP multicast; use the local fallback below. */ }
        finally { lock.release() }
        return findOnWifiSubnet(wifi)
    }

    private fun isWiiM(host: String, timeoutMs: Int = 1_000): Boolean {
        val status = runCatching { HttpJson.get("http://$host/httpapi.asp?command=getStatusEx", timeoutMs) }.getOrNull() ?: return false
        // getStatusEx differs by firmware: Ultra returns its fields nested in `device`.
        val device = status.optJSONObject("device") ?: status
        return device.optString("project").contains("WiiM", true) || device.optString("DeviceName").contains("WiiM", true)
    }

    /**
     * Fallback for Wi-Fi networks that suppress SSDP multicast. It probes only the
     * current IPv4 LAN and accepts a host only after its WiiM HTTP identity matches.
     */
    @Suppress("DEPRECATION")
    private fun findOnWifiSubnet(wifi: WifiManager): String? {
        val dhcp = wifi.dhcpInfo ?: return null
        // DhcpInfo stores IPv4 values little-endian; normalize before incrementing hosts.
        val address = Integer.reverseBytes(dhcp.ipAddress)
        val mask = Integer.reverseBytes(dhcp.netmask)
        if (address == 0 || mask == 0) return null
        val network = address and mask
        val broadcast = network or mask.inv()
        // A broad network could contain thousands of addresses. The bridge scans
        // the current /24 around the phone instead of probing a whole corporate LAN.
        val first = network + 1
        val last = minOf(broadcast - 1, (address and -0x100) + 254)
        if (last < first) return null

        val workers = Executors.newFixedThreadPool(24)
        val results = ExecutorCompletionService<String?>(workers)
        val candidates = (first..last).filter { it != address }.toList()
        try {
            candidates.forEach { candidate -> results.submit { ipAddress(candidate).takeIf { isWiiM(it, 650) } } }
            repeat(candidates.size) {
                val host: String? = results.poll(8, TimeUnit.SECONDS)?.get()
                if (host != null) return host
            }
        } catch (_: Exception) {
            return null
        } finally {
            workers.shutdownNow()
        }
        return null
    }

    private fun ipAddress(value: Int): String = listOf(value ushr 24 and 0xff, value ushr 16 and 0xff, value ushr 8 and 0xff, value and 0xff).joinToString(".")
}
