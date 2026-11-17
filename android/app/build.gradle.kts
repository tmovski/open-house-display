plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.serafimovski.openhousedisplay"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.serafimovski.openhousedisplay"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }

    // The kiosk UI lives in /web/site and is packaged as app assets unchanged,
    // so the browser demo, the tests, and the tablet all run the same files.
    sourceSets {
        getByName("main") {
            assets.srcDir(rootProject.file("../web/site"))
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
}
