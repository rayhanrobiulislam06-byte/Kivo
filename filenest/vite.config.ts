import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode kivo` makes a build that runs from file:///android_asset inside the Kivo app:
// classic <script defer> (no ES module / CORS), no crossorigin attributes, output in dist-kivo.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    ...(mode === 'kivo'
      ? [{
          name: 'kivo-file-html',
          enforce: 'post' as const,
          transformIndexHtml: (html: string) =>
            html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin/g, ''),
        }]
      : []),
  ],
  build: mode === 'kivo' ? { outDir: 'dist-kivo', modulePreload: false } : {},
}))
