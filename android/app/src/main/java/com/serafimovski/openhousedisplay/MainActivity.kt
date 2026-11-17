package com.serafimovski.openhousedisplay

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File

/**
 * Hosts the kiosk web app in a WebView and provides the few things a web page
 * can't do on its own: share a CSV file, pin the screen, and pick photos.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    lateinit var kiosk: KioskController
        private set

    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null

    private val pickOneImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        deliverPickedFiles(listOfNotNull(uri))
    }
    private val pickManyImages = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        deliverPickedFiles(uris)
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        kiosk = KioskController(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView = WebView(this).apply { setBackgroundColor(Color.parseColor("#0E241D")) }
        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0E241D"))
            addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        setContentView(container)

        // Keep the page clear of system bars, notches, and the on-screen keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        configureWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Never exit on back: let the web app decide (it returns to the welcome screen).
                webView.evaluateJavascript("window.OpenHouse && window.OpenHouse.onBack()", null)
            }
        })

        webView.loadUrl(NavigationPolicy.START_URL)
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun configureWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain(NavigationPolicy.APP_HOST)
            .addPathHandler(NavigationPolicy.ASSET_PATH, WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // IndexedDB, where listings and sign-ins live
            allowFileAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            // Debug builds may sync to a plain-http server on the dev machine.
            if (BuildConfig.DEBUG) mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !NavigationPolicy.isAllowedNavigation(request.url.toString())
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                params: WebChromeClient.FileChooserParams,
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                val mime = params.acceptTypes.firstOrNull { it.isNotBlank() } ?: "image/*"
                return try {
                    if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) pickManyImages.launch(mime) else pickOneImage.launch(mime)
                    true
                } catch (e: ActivityNotFoundException) {
                    pendingFileCallback = null
                    false
                }
            }
        }

        webView.addJavascriptInterface(NativeBridge(this), "OpenHouseNative")
    }

    private fun deliverPickedFiles(uris: List<Uri>) {
        pendingFileCallback?.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
        pendingFileCallback = null
    }

    /** Writes the CSV to private cache storage and opens Android's share sheet (email, Drive, etc.). */
    fun shareCsv(fileName: String, csvText: String) {
        try {
            val dir = File(cacheDir, "exports").apply { mkdirs() }
            // Don't leave earlier exports containing personal data lying around.
            dir.listFiles()?.forEach { it.delete() }
            val file = File(dir, fileName).apply { writeText(ExportFiles.withByteOrderMark(csvText), Charsets.UTF_8) }
            val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, getString(R.string.export_subject))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            kiosk.pauseForExternalActivity()
            startActivity(Intent.createChooser(send, getString(R.string.export_chooser_title)))
        } catch (e: Exception) {
            Toast.makeText(this, R.string.export_failed, Toast.LENGTH_LONG).show()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        kiosk.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        kiosk.onWindowFocusChanged(hasFocus)
    }

    override fun onDestroy() {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
