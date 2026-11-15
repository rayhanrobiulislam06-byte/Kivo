# Changelog

## 0.4.0
- Inside Kivo: downloads and backups use the system Save-as dialog; Ask Kivo starts a clean chat and reads Kivo deltas

## 0.3.1
- FileNest now lives under assets/kivo/filenest/ inside the APK (Kivo's WebView only allows pages under its own asset folder)
- tools/kivo-ux.js: Kivo model-setup screen notes (EN+BN), download speed/time left, keeps screen on, clearer "I already have the model file" button
- `npm run build:kivo`: file://-safe build (dist-kivo) for embedding in the Kivo APK
- Back-to-Kivo link when running inside Kivo; service worker only on http(s)

## 0.3.0
- Progress backup/restore (JSON) in Settings
- Quiz retry after a wrong answer
- Ask Kivo panel in lessons (works inside the Kivo app; shows a download link elsewhere)
- Relative asset base for embedding in Kivo

## 0.2.0
- Soft skills learning hub (10 courses, 50 lessons, EN/BN), streak, bookmarks, notes saved to Files
- Install card, privacy page

## 0.1.0
- Local file manager, ZIP, donation screen, light/dark theme, EN/BN
