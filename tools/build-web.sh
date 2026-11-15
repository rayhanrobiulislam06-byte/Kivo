#!/data/data/com.termux/files/usr/bin/bash
# Builds FileNest (React/Vite) in "kivo" mode and copies it into the app's assets.
set -e
cd "$(dirname "$0")/.."
( cd filenest && npm install && npm run build:kivo )
rm -rf app/src/main/assets/kivo/filenest
mkdir -p app/src/main/assets/kivo/filenest
cp -r filenest/dist-kivo/. app/src/main/assets/kivo/filenest/
if grep -lE '^(import|export) ' app/src/main/assets/kivo/filenest/assets/*.js >/dev/null 2>&1; then
  echo "ERROR: the FileNest build contains ES-module syntax and will not run from file://"; exit 1
fi
echo "FileNest copied into app/src/main/assets/kivo/filenest ($(ls app/src/main/assets/kivo/filenest | wc -l) entries)"
