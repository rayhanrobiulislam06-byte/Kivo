# FileNest

A private, installable web app (PWA) that combines:

- **Learn**: 10 soft skills courses (50 lessons) in English and Bengali, with quizzes, streaks, bookmarks and notes.
- **Files**: a local file manager (import, folders, rename, copy, move, delete, search, sort, filter, preview, ZIP).
- **Privacy first**: everything stays in the browser (IndexedDB). No accounts, analytics or uploads.

## Run

    npm install
    npm run dev -- --host

## Build and publish

    npx vite build
    npx surge dist <your-domain>.surge.sh

## Where to edit

- Lessons: `src/softskills.ts`, `src/more.ts`, `src/extra.ts`
- Donation settings: `src/donation.ts`
- Texts and translations: `src/i18n.ts`
- Privacy page: `public/privacy.html`

## Limits

A browser app cannot access the whole device storage. It manages files you import into its own storage.
