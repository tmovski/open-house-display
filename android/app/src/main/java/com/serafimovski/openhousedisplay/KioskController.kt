package com.serafimovski.openhousedisplay

import android.app.Activity
import android.app.ActivityManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Kiosk mode = hide the status and navigation bars and pin the app to the screen
 * (Android "lock task" mode). On an ordinary tablet Android asks the agent to
 * confirm pinning; on a device enrolled as a dedicated device it's silent.
 */
class KioskController(private val activity: Activity) {

    var enabled: Boolean = false
        private set

    fun setEnabled(on: Boolean) {
        enabled = on
        apply()
    }

    /** Re-applies after the app returns to the foreground (for example, after sharing a file). */
    fun onResume() {
        if (enabled) apply()
    }

    /** Sharing opens another app, which lock task mode would block. */
    fun pauseForExternalActivity() {
        if (enabled) stopLockTask()
    }

    fun onWindowFocusChanged(hasFocus: Boolean) {
        if (hasFocus && enabled) hideSystemBars()
    }

    private fun apply() {
        if (enabled) {
            hideSystemBars()
            startLockTask()
        } else {
            showSystemBars()
            stopLockTask()
        }
    }

    private fun insetsController() =
        WindowCompat.getInsetsController(activity.window, activity.window.decorView)

    private fun hideSystemBars() {
        insetsController().apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun showSystemBars() {
        insetsController().show(WindowInsetsCompat.Type.systemBars())
    }

    private fun isInLockTask(): Boolean {
        val am = activity.getSystemService(ActivityManager::class.java) ?: return false
        return am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }

    private fun startLockTask() {
        if (!isInLockTask()) runCatching { activity.startLockTask() }
    }

    private fun stopLockTask() {
        if (isInLockTask()) runCatching { activity.stopLockTask() }
    }
}
