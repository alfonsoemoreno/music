package com.digitalalbum.musicbridge

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object HttpJson {
    fun get(url: String, timeoutMs: Int = 5_000): JSONObject = request("GET", url, null, emptyMap(), timeoutMs)
    fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): JSONObject = request("POST", url, body, headers)
    private fun request(method: String, target: String, body: String?, headers: Map<String, String>, timeoutMs: Int = 5_000): JSONObject {
        val connection = URL(target).openConnection() as HttpURLConnection
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
}
