package com.securetarget.sdk

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
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

data class SecureTargetConfig(
    val apiKey: String,
    val companyId: String,
    val endpoint: String
)

data class UtmParams(
    val source: String? = null,
    val medium: String? = null,
    val campaign: String? = null,
    val term: String? = null,
    val content: String? = null
)

data class DeviceDetails(
    val platform: String = "android",
    val osVersion: String? = null,
    val model: String? = null,
    val locale: String? = null,
    val timezone: String? = null,
    val appVersion: String? = null,
    val sdkVersion: String? = "0.3.0",
    val advertisingId: String? = null,
    val vendorId: String? = null,
    val installReferrer: String? = null,
    val deepLinkUrl: String? = null,
    val utm: UtmParams? = null
)

data class InstallAttributionResult(
    val attributed: Boolean,
    val isOrganic: Boolean,
    val confidence: Double,
    val mediaSource: String? = null,
    val campaignId: String? = null,
    val adgroupId: String? = null,
    val creativeId: String? = null,
    val clickId: String? = null,
    val deepLinkValue: String? = null,
    val ruleName: String? = null
)

class SecureTargetSdk(
    context: Context,
    private val config: SecureTargetConfig
) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("securetarget_sdk", Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val ioExecutor = Executors.newSingleThreadExecutor()
    @Volatile
    private var sessionId: String? = prefs.getString(KEY_SESSION, null)
    @Volatile
    private var storedClickId: String? = prefs.getString(KEY_CLICK_ID, null)
    private val installCallbacks = mutableListOf<(InstallAttributionResult) -> Unit>()

    @Deprecated("Record token is the bootstrap sessionId; this has no effect.")
    fun setLoginToken(@Suppress("UNUSED_PARAMETER") token: String) {}

    fun clearSession() {
        sessionId = null
        storedClickId = null
        prefs.edit().remove(KEY_SESSION).remove(KEY_FIRST_OPEN).remove(KEY_CLICK_ID).apply()
    }

    fun onInstallAttribution(callback: (InstallAttributionResult) -> Unit) {
        installCallbacks.add(callback)
    }

    fun ensureSession(device: DeviceDetails = defaultDevice(), callback: (Exception?) -> Unit) {
        ioExecutor.execute {
            try {
                ensureBlocking(device)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    fun handleDeepLink(intent: Intent?, callback: (Exception?) -> Unit = {}) {
        val data: Uri = intent?.data ?: run {
            callback(null)
            return
        }
        ioExecutor.execute {
            try {
                ensureBlocking()
                val clickId = data.getQueryParameter("st_click_id")
                if (!clickId.isNullOrEmpty()) {
                    storedClickId = clickId
                    prefs.edit().putString(KEY_CLICK_ID, clickId).apply()
                }
                val o = JSONObject().apply {
                    put("actionType", "record")
                    put("eventId", java.util.UUID.randomUUID().toString())
                    put("companyId", config.companyId)
                    put("occurredAt", isoUtcNow())
                    put("token", sessionId)
                    data.getQueryParameter("pid")?.let { put("mediaSource", it) }
                    data.getQueryParameter("c")?.let { put("campaignId", it) }
                    data.getQueryParameter("adset")?.let { put("adgroupId", it) }
                        ?: data.getQueryParameter("af_adset")?.let { put("adgroupId", it) }
                    data.getQueryParameter("ad")?.let { put("creativeId", it) }
                        ?: data.getQueryParameter("af_ad")?.let { put("creativeId", it) }
                    put("landingUrl", data.toString())
                }
                postJson("/v1/record", o)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    fun bootstrapBlocking(device: DeviceDetails): String {
        val enriched = device.copy(
            installReferrer = device.installReferrer ?: InstallReferrerHelper.getInstallReferrer(appContext)
        )
        val url = URL("${config.endpoint.trimEnd('/')}/v1/session/bootstrap")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("x-api-key", config.apiKey)
            doOutput = true
        }
        val occurredAt = isoUtcNow()
        val dev = deviceToJson(enriched)
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
        val sid = json.getString("sessionId")
        sessionId = sid
        prefs.edit().putString(KEY_SESSION, sid).apply()

        if (!prefs.getBoolean(KEY_FIRST_OPEN, false)) {
            trackInstallBlocking(java.util.UUID.randomUUID().toString(), occurredAt, enriched.installReferrer)
            prefs.edit().putBoolean(KEY_FIRST_OPEN, true).apply()
        }
        return sid
    }

    fun trackRecord(
        eventId: String,
        occurredAt: String,
        mediaSource: String? = null,
        campaignId: String? = null,
        adgroupId: String? = null,
        creativeId: String? = null,
        callback: (Exception?) -> Unit
    ) {
        ioExecutor.execute {
            try {
                ensureBlocking()
                val sid = sessionId ?: throw IllegalStateException("Session missing")
                val o = JSONObject().apply {
                    put("actionType", "record")
                    put("eventId", eventId)
                    put("companyId", config.companyId)
                    put("occurredAt", occurredAt)
                    put("token", sid)
                    mediaSource?.let { put("mediaSource", it) }
                    campaignId?.let { put("campaignId", it) }
                    adgroupId?.let { put("adgroupId", it) }
                    creativeId?.let { put("creativeId", it) }
                }
                postJson("/v1/record", o)
                mainHandler.post { callback(null) }
            } catch (e: Exception) {
                mainHandler.post { callback(e) }
            }
        }
    }

    fun trackInstall(
        eventId: String,
        occurredAt: String,
        installReferrer: String? = null,
        callback: (InstallAttributionResult?, Exception?) -> Unit
    ) {
        ioExecutor.execute {
            try {
                val result = trackInstallBlocking(eventId, occurredAt, installReferrer)
                mainHandler.post { callback(result, null) }
            } catch (e: Exception) {
                mainHandler.post { callback(null, e) }
            }
        }
    }

    private fun trackInstallBlocking(
        eventId: String,
        occurredAt: String,
        installReferrer: String?
    ): InstallAttributionResult {
        ensureBlocking()
        val sid = sessionId ?: throw IllegalStateException("Session missing")
        val referrer = installReferrer ?: InstallReferrerHelper.getInstallReferrer(appContext)
        val clickId = storedClickId ?: extractClickId(referrer)
        val o = JSONObject().apply {
            put("actionType", "install")
            put("eventId", eventId)
            put("companyId", config.companyId)
            put("occurredAt", occurredAt)
            put("token", sid)
            referrer?.let { put("installReferrer", it) }
            clickId?.let { put("clickId", it) }
        }
        val responseText = postJsonWithResponse("/v1/record", o)
        val result = parseAttribution(responseText)
        installCallbacks.forEach { it(result) }
        return result
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

    private fun ensureBlocking(device: DeviceDetails = defaultDevice()) {
        if (!sessionId.isNullOrEmpty()) return
        bootstrapBlocking(device)
    }

    private fun deviceToJson(device: DeviceDetails): JSONObject {
        return JSONObject().apply {
            put("platform", device.platform)
            device.osVersion?.let { put("osVersion", it) }
            device.model?.let { put("model", it) }
            device.locale?.let { put("locale", it) }
            device.timezone?.let { put("timezone", it) }
            device.appVersion?.let { put("appVersion", it) }
            device.sdkVersion?.let { put("sdkVersion", it) }
            device.advertisingId?.let { put("advertisingId", it) }
            device.installReferrer?.let { put("installReferrer", it) }
            device.deepLinkUrl?.let { put("deepLinkUrl", it) }
        }
    }

    private fun postJson(path: String, json: JSONObject) {
        postJsonWithResponse(path, json)
    }

    private fun postJsonWithResponse(path: String, json: JSONObject): String {
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
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        if (code !in 200..299) throw IllegalStateException("POST $path HTTP $code")
        return text
    }

    private fun parseAttribution(jsonText: String): InstallAttributionResult {
        return try {
            val root = JSONObject(jsonText)
            val attr = root.optJSONObject("attribution") ?: return InstallAttributionResult(false, true, 0.0)
            InstallAttributionResult(
                attributed = attr.optBoolean("attributed", false),
                isOrganic = attr.optBoolean("isOrganic", true),
                confidence = attr.optDouble("confidence", 0.0),
                mediaSource = attr.optString("mediaSource").takeIf { it.isNotEmpty() },
                campaignId = attr.optString("campaignId").takeIf { it.isNotEmpty() },
                adgroupId = attr.optString("adgroupId").takeIf { it.isNotEmpty() },
                creativeId = attr.optString("creativeId").takeIf { it.isNotEmpty() },
                clickId = attr.optString("clickId").takeIf { it.isNotEmpty() },
                deepLinkValue = attr.optString("deepLinkValue").takeIf { it.isNotEmpty() },
                ruleName = attr.optString("ruleName").takeIf { it.isNotEmpty() }
            )
        } catch (_: Exception) {
            InstallAttributionResult(false, true, 0.0)
        }
    }

    private fun extractClickId(referrer: String?): String? {
        if (referrer.isNullOrEmpty()) return null
        val regex = Regex("st_click_id=([a-f0-9-]{36})", RegexOption.IGNORE_CASE)
        return regex.find(referrer)?.groupValues?.getOrNull(1)
    }

    private fun isoUtcNow(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    companion object {
        private const val KEY_SESSION = "session_id"
        private const val KEY_FIRST_OPEN = "first_open_sent"
        private const val KEY_CLICK_ID = "click_id"

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
