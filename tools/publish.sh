#!/data/data/com.termux/files/usr/bin/bash
# Publishes the signed APK as the newest GitHub release and removes the older ones.
set -e
cd "$(dirname "$0")/.."
APK=/storage/emulated/0/Download/Kivo-1.0.0.apk
[ -f "$APK" ] || { echo "Missing $APK (run tools/release.sh first)"; exit 1; }
n=$(grep -o 'versionCode = [0-9]*' app/build.gradle.kts | head -1 | grep -o '[0-9]*$')
tag="v1.0.0-b$n"
S=$(sha256sum "$APK" | cut -d' ' -f1)
NOTES="Private, offline AI chat for Android (Gemma 4 E2B runs on your phone) with the FileNest file manager built in. Download Kivo-1.0.0.apk and allow installing from this source. The first start downloads the 2.6 GB model once (use Wi-Fi); after that Kivo works fully offline. SHA-256: $S"
gh release create "$tag" "$APK" --target main --title "Kivo v1.0.0" --notes "$NOTES" --latest
gh release list --limit 100 --json tagName -q '.[].tagName' | grep -vx "$tag" | while read t; do gh release delete "$t" --cleanup-tag -y || echo "could not delete $t"; done
gh release view "$tag" --json url -q .url
