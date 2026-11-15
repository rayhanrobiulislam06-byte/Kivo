#!/data/data/com.termux/files/usr/bin/bash
# Signs the release APK with YOUR key (~/kivo-release.jks, alias "kivo") and puts it in Download.
set -e
cd "$(dirname "$0")/.."
KS="${KIVO_KS:-$HOME/kivo-release.jks}"
IN=app/build/outputs/apk/release/app-release-unsigned.apk
OUT=/storage/emulated/0/Download/Kivo-1.0.0.apk
[ -f "$KS" ] || { echo "Missing key $KS (run tools/make-key.sh once, or restore it from KivoBackups)"; exit 1; }
[ -f "$IN" ] || { echo "Missing $IN. Run: ./gradlew assembleRelease"; exit 1; }
apksigner sign --ks "$KS" --ks-key-alias kivo --out "$OUT" "$IN"
apksigner verify --print-certs "$OUT" | head -3
rm -f "$OUT.idsig"
echo "Done: $OUT"
