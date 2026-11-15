#!/data/data/com.termux/files/usr/bin/bash
# One command to ship an update: build number +1 (version name stays 1.0.0), push, build on GitHub, sign.
set -e
cd "$(dirname "$0")/.."
n=$(grep -o 'versionCode = [0-9]*' app/build.gradle.kts | head -1 | grep -o '[0-9]*$'); n=$((n+1))
sed -i "s/versionCode = [0-9]*/versionCode = $n/" app/build.gradle.kts
git add -A
git -c user.name=Robiul -c user.email=kivo@localhost commit -qm "Kivo 1.0.0 (build $n)"
git push -q
gh workflow run build.yml
sleep 10
id=$(gh run list --workflow build.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$id" --exit-status
rm -rf ~/kivo-out; mkdir -p ~/kivo-out app/build/outputs/apk/release
gh run download "$id" -n Kivo-1.0.0-unsigned -D ~/kivo-out
cp ~/kivo-out/app-release-unsigned.apk app/build/outputs/apk/release/
bash tools/sign.sh
