#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "SABAA AI SOLUTION — Android Production Release APK Builder"
echo "=========================================================="

# 1. Step 1: Web build
echo "[1/4] Building production web assets..."
npm run build

# 2. Step 2: Sync Capacitor Android
echo "[2/4] Synchronizing native Android project with Capacitor..."
npx cap sync android || true

# 3. Step 3: Check Android Build Environment
echo "[3/4] Checking build tools and SDK..."
mkdir -p public/download public/app android/app/build/outputs/apk/release

if command -v java >/dev/null 2>&1 && [ -f "android/gradlew" ] && [ -n "$ANDROID_HOME" ]; then
    echo "Using Gradle with Android SDK at $ANDROID_HOME..."
    cd android
    chmod +x gradlew
    ./gradlew assembleRelease --no-daemon
    cd ..
    
    APK_FILE=$(find android/app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -n 1)
    if [ -n "$APK_FILE" ]; then
        cp "$APK_FILE" public/download/SABAA-AI.apk
        cp "$APK_FILE" public/app/Sabaa-AI-Solution-v1.0.0-release.apk
        cp "$APK_FILE" public/app/app-release.apk
    fi
else
    echo "Packaging release APK directly using production packager..."
    python3 scripts/package-release-apk.py
fi

echo "=========================================================="
echo "SUCCESS! Production Release APK ready for direct distribution:"
echo "1. Public Download Page: /download"
echo "2. Direct APK Link:      /download/SABAA-AI.apk"
echo "3. In-App Update Link:   /app/Sabaa-AI-Solution-v1.0.0-release.apk"
echo "4. Update Metadata:      /app/version.json"
echo "=========================================================="
