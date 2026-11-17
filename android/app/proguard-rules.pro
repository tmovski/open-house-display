# Methods called from JavaScript must keep their names.
-keepclassmembers class com.serafimovski.openhousedisplay.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
