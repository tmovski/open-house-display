package com.serafimovski.openhousedisplay

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationPolicyTest {

    @Test
    fun allowsTheBundledApp() {
        assertTrue(NavigationPolicy.isAllowedNavigation(NavigationPolicy.START_URL))
        assertTrue(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net/assets/index.html#tour"))
        assertTrue(NavigationPolicy.isAllowedNavigation("HTTPS://APPASSETS.androidplatform.net/assets/css/app.css"))
    }

    @Test
    fun blocksTheOpenWeb() {
        assertFalse(NavigationPolicy.isAllowedNavigation("https://example.com/"))
        assertFalse(NavigationPolicy.isAllowedNavigation("http://appassets.androidplatform.net/assets/index.html"))
        assertFalse(NavigationPolicy.isAllowedNavigation("intent://scan/#Intent;scheme=zxing;end"))
        assertFalse(NavigationPolicy.isAllowedNavigation("javascript:alert(1)"))
        assertFalse(NavigationPolicy.isAllowedNavigation("file:///sdcard/secret.txt"))
    }

    @Test
    fun blocksLookalikeAddresses() {
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net@evil.example/assets/"))
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net.evil.example/assets/"))
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net:8443/assets/index.html"))
    }

    @Test
    fun blocksPathsOutsideAssets() {
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net/res/raw/x"))
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net/assets/../res/x"))
        assertFalse(NavigationPolicy.isAllowedNavigation("https://appassets.androidplatform.net/assets/%2e%2e/res/x"))
    }

    @Test
    fun rejectsGarbage() {
        assertFalse(NavigationPolicy.isAllowedNavigation(null))
        assertFalse(NavigationPolicy.isAllowedNavigation(""))
        assertFalse(NavigationPolicy.isAllowedNavigation("not a url at all"))
    }
}
