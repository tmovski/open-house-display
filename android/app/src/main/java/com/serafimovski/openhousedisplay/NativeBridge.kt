package com.serafimovski.openhousedisplay

import android.webkit.JavascriptInterface

/**
 * The JavaScript-visible object `window.OpenHouseNative`.
 *
 * Calls arrive on a background thread, so anything touching the UI hops to the
 * main thread. NavigationPolicy guarantees only the bundled app pages are ever
 * loaded, so no outside page can reach these methods.
 */
class NativeBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun shareCsv(fileName: String?, csvText: String?) {
        val text = csvText ?: return
        activity.runOnUiThread { activity.shareCsv(ExportFiles.safeCsvName(fileName), text) }
    }

    @JavascriptInterface
    fun setKioskMode(enabled: Boolean) {
        activity.runOnUiThread { activity.kiosk.setEnabled(enabled) }
    }

    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.kiosk.setEnabled(false)
            activity.finishAndRemoveTask()
        }
    }
}
