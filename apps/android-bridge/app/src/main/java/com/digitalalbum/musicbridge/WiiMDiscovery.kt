package com.digitalalbum.musicbridge

import android.content.Context
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.URI
import java.util.concurrent.ExecutorCompletionService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object WiiMDiscovery {
    private const val search = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n"

    fun find(context: Context, report: (String) -> Unit = {}): String? {
        val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
        val lock = wifi.createMulticastLock("music-bridge-discovery").apply { setReferenceCounted(false); acquire() }
        try {
            report("Buscando WiiM por SSDP…")
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
        } catch (_: Exception) {
            // Wi-Fi routers often suppress SSDP multicast. The subnet fallback remains local and read-only.
        } finally {
            lock.release()
        }
        report("SSDP no respondió; revisando la red Wi‑Fi…")
        val found = findOnWifiSubnet(context)
        if (found == null) report("No se encontró WiiM en esta Wi‑Fi")
        return found
    }

    private fun isWiiM(host: String, timeoutMs: Int = 1_000): Boolean {
        val status = runCatching { HttpJson.get("http://$host/httpapi.asp?command=getStatusEx", timeoutMs) }.getOrNull() ?: return false
        val device = status.optJSONObject("device") ?: status
        return device.optString("project").contains("WiiM", true) || device.optString("DeviceName").contains("WiiM", true)
    }

    /** Falls back to the current IPv4 Wi-Fi segment when SSDP multicast is unavailable. */
    private fun findOnWifiSubnet(context: Context): String? {
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val properties = connectivity.getLinkProperties(connectivity.activeNetwork) ?: return null
        val local = properties.linkAddresses.firstOrNull { it.address is Inet4Address && !it.address.isLoopbackAddress } ?: return null
        val prefix = local.prefixLength
        if (prefix !in 8..30) return null

        val address = local.address.address.fold(0L) { result, byte -> (result shl 8) or (byte.toInt() and 0xff).toLong() }
        val mask = (0xffff_ffffL shl (32 - prefix)) and 0xffff_ffffL
        val network = address and mask
        val broadcast = network or (mask.inv() and 0xffff_ffffL)
        // Keep the fallback civil on large networks: scan only the phone's /24.
        val current24 = address and 0xffff_ff00L
        val first = maxOf(network + 1, current24 + 1)
        val last = minOf(broadcast - 1, current24 + 254)
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

    private fun ipAddress(value: Long): String = listOf(value shr 24 and 0xff, value shr 16 and 0xff, value shr 8 and 0xff, value and 0xff).joinToString(".")
}
