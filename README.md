# Kivo v1.0.0

Private, offline AI chat for Android (Gemma 4 E2B on-device via LiteRT-LM) with the **FileNest** file
manager and soft-skills hub built in. Everything runs on the phone. After the one-time model download
nothing leaves the device.

## What is in this repository

| Path | What it is |
| --- | --- |
| `app/src/main/java/com/kivo/app/MainActivity.kt` | WebView host + the `KivoNative` JavaScript bridge, model download/import, chat, Save-as |
| `.../ModelDownloader.kt` | Parallel (8 x HTTP Range) resumable download with retries and SHA-256 check |
| `.../ai/KivoChatEngine.kt` | LiteRT-LM engine wrapper (streaming, stop, reset) |
| `.../KeepAliveService.kt` | Foreground service while downloading / loading / answering |
| `.../KivoState.kt` | Process-wide state so a running reply survives a page reload |
| `app/src/main/assets/kivo/` | The chat UI (HTML/CSS/JS), memory, backup & restore, setup-screen helpers |
| `filenest/` | FileNest source (React + TypeScript + Vite). Built into `assets/kivo/filenest/` |
| `tools/` | `build-web.sh`, `sign.sh`, `make-key.sh` |

The web part and the native part talk through `window.KivoNative`:
`isReady, isLoading, isDownloading, getPartialBytes, isMetered, downloadModel, pauseDownload, pickModel,
sendMessage(text,id), stop, newChat, getPending, clearPending, getVersion, saveFile(name,mime,base64), setBarColor`.
Native calls back with `kivoNativeChunk(id,text)` (deltas), `kivoNativeResponse(id,text,error)`,
`kivoNativeSetup`, `kivoNativeReady`, `kivoModelDownload(state,done,total,msg)`, `kivoModelProgress`,
`kivoModelInstallFailed`. The bridge only answers pages under `file:///android_asset/kivo/`.

## Build (Termux, no computer needed)

```
bash tools/make-key.sh        # once. Writes ~/kivo-release.jks and a backup. WRITE THE PASSWORD DOWN
bash tools/build-web.sh       # builds FileNest into the app assets
./gradlew assembleRelease     # first run downloads Gradle + dependencies
bash tools/sign.sh            # -> /storage/emulated/0/Download/Kivo-1.0.0.apk
```

`gradle.properties` points AAPT2 at Termux's `aapt2`. On a PC, delete that line.

### বাংলায় সংক্ষেপে
১. `bash tools/build-web.sh` (FileNest তৈরি) ২. `./gradlew assembleRelease` ৩. `bash tools/sign.sh`।
সাইনিং কী (`~/kivo-release.jks`) কখনো হারাবেন না, নইলে আপডেট ইনস্টল হবে না।

## Model download link

The model is Google's Gemma 4 E2B in LiteRT-LM format, hosted by the LiteRT community on Hugging Face (pinned to one
exact revision, checked by SHA-256 inside the app). One-tap link:

`https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/3d48132a00cf76de57d926de30f5c5c5ed9b8c0d/gemma-4-E2B-it.litertlm`

Open it in a browser (it downloads the 2.6 GB file), then in Kivo tap *I already have the model file* and choose it.
The setup screen shows the same link as "download in your browser". The file is not hosted in this repository.

## Upgrading

* Package id stays `com.kivo.app`, version code 10000.
* A phone with **Kivo-FileNest.apk** (signed with `~/kivo-release.jks`) updates in place; chats and the model stay.
* The very first v0.1.7 release was signed with a lost key: uninstall it first (chats and model are removed).
* Inside the app: sidebar -> *Backup & restore* exports chats, memory and settings to a JSON file.
* Android cloud backup is switched **off** (`allowBackup=false`): chats never leave the phone unless you export them yourself.

## Security notes

* The bridge only answers while the main page is one of Kivo's own assets, no remote page is ever loaded in the
  WebView and every `http(s)` request made by a page is blocked; links open in the browser instead.
* Imported models must have the exact size and SHA-256 of Gemma 4 E2B; a broken import never replaces a working model.
* ZIP files opened in FileNest are limited to 5000 entries / 500 MB and unsafe paths (`..`, absolute) are skipped.

## Status / honest notes

* The native Kotlin code was written without an Android SDK available and has **not been compiled or run yet**.
  Build it, and send any compiler or crash message back: they are expected to be small.
* `maxNumTokens` is 2048 (the first prototype used 1024). Lower it in `KivoChatEngine.kt` if a phone runs out of memory.
* Stop uses `Conversation.cancelProcess()` through reflection and falls back to resetting the conversation.
* Minimum Android version is 8.0 (API 26); the adaptive icon is a simple "K" and can be replaced.
