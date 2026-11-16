# Changelog

## 1.0.0 (diagnostics)
- Backup & restore -> *Show debug log*: last WebView console / native events, to find problems on a real phone.
- FileNest errors stay visible longer and are written to that log; IndexedDB is enabled explicitly.

## 1.0.0 (setup screen)
- Setup screen offers a one-tap browser download link for the model file.

## 1.0.0 (faster download)
- The model downloads over 8 parallel connections (about as fast as aria2c). Pause, resume, app restarts and
  network drops continue per segment; an old single-connection partial download is picked up automatically.

## 1.0.0 (hardening after review)
- Imported model is checked by exact size and SHA-256 and replaced safely (the old one is restored on failure).
- Download resume validates the server's Content-Range; start/pause can no longer race or start twice.
- Only one reply can run at a time; the next reply waits for a stopped one to finish.
- Android cloud backup is off; use the in-app JSON backup.
- Every http(s) request inside the WebView is blocked; message and save-file sizes are limited.
- FileNest refuses zip bombs (entry count and size limits).

## 1.0.0
- Complete source code of the app (the v0.1.7 native source was lost; rebuilt from the APK's interface).
- New: FileNest file manager and soft-skills hub inside Kivo (sidebar -> FileNest).
- New: Backup & restore of chats, memory and settings (JSON file, no server).
- New: model download resumes after interruptions, retries on network errors, verifies SHA-256,
  checks free storage, runs in a foreground service.
- New: setup screen shows size, speed, time left and keeps the screen on; "I already have the model file" is clearer.
- New: system "Save as" for exported files; file picker support inside the app.
- New: status/navigation bar colour follows the light/dark theme.
- Security: the JavaScript bridge only answers Kivo's own pages; no remote page is ever loaded in the WebView;
  cleartext traffic is off; the model is excluded from Android backups.
