# Changelog

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
