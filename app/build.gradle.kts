plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.kivo.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kivo.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 10001          // 1.0.0 -> major*10000 + minor*100 + patch
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false  // the LiteRT-LM native bridge uses reflection/JNI: keep names intact
        }
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true   // extractNativeLibs=true, as in v0.1.7
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(
                org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
            )
        }
    }
}

dependencies {
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.17.1")
}
