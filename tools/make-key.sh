#!/data/data/com.termux/files/usr/bin/bash
# Creates the signing key ONCE. Never lose it: every future update must be signed with the same key.
set -e
KS="$HOME/kivo-release.jks"
[ -f "$KS" ] && { echo "Key already exists: $KS"; exit 0; }
keytool -genkeypair -keystore "$KS" -alias kivo -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Robiul, O=Kivo, C=BD"
mkdir -p /storage/emulated/0/KivoBackups && cp "$KS" /storage/emulated/0/KivoBackups/kivo-release.jks
echo "Key created and backed up. WRITE THE PASSWORD DOWN."
