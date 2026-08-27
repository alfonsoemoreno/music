package com.digitalalbum.musicbridge

import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

object HttpJson {
    fun get(url: String, timeoutMs: Int = 5_000): JSONObject = request("GET", url, null, emptyMap(), timeoutMs)
    fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): JSONObject = request("POST", url, body, headers)
    private fun request(method: String, target: String, body: String?, headers: Map<String, String>, timeoutMs: Int = 5_000): JSONObject {
        val connection = URL(target).openConnection() as HttpURLConnection
        if (connection is HttpsURLConnection && isPrivateIpUrl(target)) {
            // WiiM's local HTTPS endpoint uses a device-local, self-signed certificate.
            // This exception is deliberately limited to RFC1918 addresses; cloud calls
            // continue using Android's normal certificate validation.
            connection.sslSocketFactory = localWiiMSslSocketFactory
            connection.hostnameVerifier = HostnameVerifier { _, _ -> true }
        }
        connection.requestMethod = method
        connection.connectTimeout = timeoutMs
        connection.readTimeout = timeoutMs
        connection.setRequestProperty("accept", "application/json")
        headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("content-type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException("HTTP ${connection.responseCode}: $response")
        return JSONObject(response)
    }

    private fun isPrivateIpUrl(target: String): Boolean = runCatching {
        Uri.parse(target).host?.let { InetAddress.getByName(it).isSiteLocalAddress } == true
    }.getOrDefault(false)

    private val localWiiMSslSocketFactory by lazy {
        val trustAll = arrayOf<TrustManager>(object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = Unit
        })
        SSLContext.getInstance("TLS").apply { init(null, trustAll, SecureRandom()) }.socketFactory
    }
}
