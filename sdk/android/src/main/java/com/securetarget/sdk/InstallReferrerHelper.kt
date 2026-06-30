package com.securetarget.sdk

import android.content.Context

/**
 * Reads Google Play Install Referrer when the Play Install Referrer library is present.
 * Falls back to null if unavailable (integrators can add `com.android.installreferrer:installreferrer`).
 */
object InstallReferrerHelper {
  @Volatile
  private var cachedReferrer: String? = null

  fun getInstallReferrer(context: Context): String? {
    cachedReferrer?.let { return it }
    val referrer = tryReadReferrer(context)
    cachedReferrer = referrer
    return referrer
  }

  private fun tryReadReferrer(context: Context): String? {
    return try {
      val clientClass = Class.forName("com.android.installreferrer.api.InstallReferrerClient")
      val builderMethod = clientClass.getMethod("newBuilder", Context::class.java)
      val builder = builderMethod.invoke(null, context.applicationContext)
      val buildMethod = builder.javaClass.getMethod("build")
      val client = buildMethod.invoke(builder)
      var result: String? = null
      val listenerClass = Class.forName("com.android.installreferrer.api.InstallReferrerStateListener")
      val latch = java.util.concurrent.CountDownLatch(1)
      val proxy = java.lang.reflect.Proxy.newProxyInstance(
        listenerClass.classLoader,
        arrayOf(listenerClass)
      ) { _, method, args ->
        when (method.name) {
          "onInstallReferrerSetupFinished" -> {
            val code = args?.getOrNull(0) as? Int
            if (code == 0) {
              try {
                val response = client.javaClass.getMethod("installReferrer").invoke(client)
                result = response?.javaClass?.getMethod("installReferrer")?.invoke(response) as? String
              } catch (_: Exception) { }
            }
            try {
              client.javaClass.getMethod("endConnection").invoke(client)
            } catch (_: Exception) { }
            latch.countDown()
            null
          }
          "onInstallReferrerServiceDisconnected" -> {
            latch.countDown()
            null
          }
          else -> null
        }
      }
      client.javaClass.getMethod("startConnection", listenerClass).invoke(client, proxy)
      latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
      result
    } catch (_: Exception) {
      null
    }
  }
}
