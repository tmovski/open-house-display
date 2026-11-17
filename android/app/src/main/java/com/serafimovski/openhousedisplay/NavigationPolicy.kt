package com.serafimovski.openhousedisplay

import java.net.URI

/**
 * Decides what the WebView may navigate to. The kiosk only ever shows its own
 * bundled pages; any other link is blocked so visitors can't wander onto the web.
 * Pure Kotlin (no Android types) so it runs in plain JVM unit tests.
 */
object NavigationPolicy {
    const val APP_HOST = "appassets.androidplatform.net"
    const val ASSET_PATH = "/assets/"
    const val START_URL = "https://$APP_HOST${ASSET_PATH}index.html"

    fun isAllowedNavigation(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = try {
            URI(url).normalize()
        } catch (e: Exception) {
            return false
        }
        val schemeOk = uri.scheme?.equals("https", ignoreCase = true) == true
        val hostOk = uri.host?.equals(APP_HOST, ignoreCase = true) == true
        val noUserInfo = uri.rawUserInfo == null
        val portOk = uri.port == -1 || uri.port == 443
        val rawPath = uri.rawPath.orEmpty()
        // Check both the raw and decoded path so "%2e%2e" can't smuggle in "..".
        val pathOk = rawPath.startsWith(ASSET_PATH) && !rawPath.contains("..") && !uri.path.orEmpty().contains("..")
        return schemeOk && hostOk && noUserInfo && portOk && pathOk
    }
}
