package com.securetarget.sdk

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

/**
 * Device details are sent **once** to `POST /v1/session/bootstrap`.
 * The opaque session id is stored in SharedPreferences and sent as `x-session-id` on later calls.
 */
data class SecureTargetConfig(
    val apiKey: String,
    val companyId: String,
    val endpoint: String
)

data class DeviceDetails(
    val platform: String = "android",
    val osVersion: String? = null,
    val model: String? = null,
    val locale: String? = null,
    val timezone: String? = null,
    val appVersion: String? = null,
    val sdkVersion: String? = "0.2.0"
)

class SecureTargetSdk(
    context: Context,
    private val config: SecureTargetConfig
) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("securetarget_sdk", Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val ioExecutor = Executors.newSingleThreadExecutor()
    @Volatile
    private var sessionId: String? = prefs.getString(KEY_SESSION, null)

    @Deprecated("Record token is the bootstrap sessionId; this has no effect.")
    fun setLoginToken(@Suppress("UNUSED_PARAMETER") token: String) {
    }

    fun clearSession() {
        sessionId = null
        prefs.edit().remove(KEY_SESSION).apply()
    }

    /** Runs network work off the main thread; invokes callback on main thread. */
    fun ensureSession(device: DeviceDetails = defaultDevice(), callback: (Exception?) -> Unit) {
        ioExecutor.execute {
            try {
                if (sessionId.isNullOrEmpty()) {
                    val sid = bootstrapBlocking(device)
                    sessionId = sid
                    prefs.edit().putString(KEY_SESSION, sid).apply()
                }
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    /** Blocking bootstrap (call from background thread only). */
    fun bootstrapBlocking(device: DeviceDetails): String {
        val url = URL("${config.endpoint.trimEnd('/')}/v1/session/bootstrap")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("x-api-key", config.apiKey)
            doOutput = true
        }
        val occurredAt = isoUtcNow()
        val dev = JSONObject().apply {
            put("platform", device.platform)
            device.osVersion?.let { put("osVersion", it) }
            device.model?.let { put("model", it) }
            device.locale?.let { put("locale", it) }
            device.timezone?.let { put("timezone", it) }
            device.appVersion?.let { put("appVersion", it) }
            device.sdkVersion?.let { put("sdkVersion", it) }
        }
        val body = JSONObject().apply {
            put("occurredAt", occurredAt)
            put("device", dev)
        }
        conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        if (code !in 200..299) throw IllegalStateException("bootstrap HTTP $code: $text")
        val json = JSONObject(text)
        return json.getString("sessionId")
    }

    private fun postJson(path: String, json: JSONObject) {
        val sid = sessionId ?: throw IllegalStateException("Session missing; call ensureSession first")
        val url = URL("${config.endpoint.trimEnd('/')}$path")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("x-api-key", config.apiKey)
            setRequestProperty("x-session-id", sid)
            doOutput = true
        }
        conn.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        conn.disconnect()
        if (code !in 200..299) throw IllegalStateException("POST $path HTTP $code")
    }

    fun trackClick(eventId: String, occurredAt: String, campaignId: String? = null, callback: (Exception?) -> Unit) {
        ioExecutor.execute {
            try {
                ensureBlocking()
                val sid = sessionId ?: throw IllegalStateException("Session missing")
                val o = JSONObject().apply {
                    put("actionType", "click")
                    put("eventId", eventId)
                    put("companyId", config.companyId)
                    put("occurredAt", occurredAt)
                    put("token", sid)
                    campaignId?.let { put("campaignId", it) }
                }
                postJson("/v1/record", o)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    fun trackLogin(eventId: String, occurredAt: String, callback: (Exception?) -> Unit) {
        ioExecutor.execute {
            try {
                ensureBlocking()
                val sid = sessionId ?: throw IllegalStateException("Session missing")
                val o = JSONObject().apply {
                    put("actionType", "login")
                    put("eventId", eventId)
                    put("companyId", config.companyId)
                    put("occurredAt", occurredAt)
                    put("token", sid)
                }
                postJson("/v1/record", o)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    fun trackConversion(
        eventId: String,
        occurredAt: String,
        conversionName: String,
        value: Double? = null,
        callback: (Exception?) -> Unit
    ) {
        ioExecutor.execute {
            try {
                ensureBlocking()
                val sid = sessionId ?: throw IllegalStateException("Session missing")
                val o = JSONObject().apply {
                    put("actionType", "conversion")
                    put("eventId", eventId)
                    put("companyId", config.companyId)
                    put("occurredAt", occurredAt)
                    put("token", sid)
                    put("conversionName", conversionName)
                    value?.let { put("value", it) }
                }
                postJson("/v1/record", o)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    private fun ensureBlocking() {
        if (!sessionId.isNullOrEmpty()) return
        val dev = defaultDevice()
        sessionId = bootstrapBlocking(dev)
        prefs.edit().putString(KEY_SESSION, sessionId).apply()
    }

    private fun isoUtcNow(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    companion object {
        private const val KEY_SESSION = "session_id"

        fun defaultDevice(): DeviceDetails {
            val tz = TimeZone.getDefault().id
            val loc = Locale.getDefault().toString()
            return DeviceDetails(
                osVersion = "Android ${Build.VERSION.RELEASE}",
                model = Build.MODEL,
                locale = loc,
                timezone = tz
            )
        }
    }
}
