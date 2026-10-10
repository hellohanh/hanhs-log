import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The site lives under /hanhs-log/ on GitHub Pages; pull-request previews
// under /hanhs-log/pr-preview/pr-N/ (the preview workflow passes BASE_PATH).
// The browser tests build with BASE_PATH=/. Locally (npm run dev) it's /.
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'serve' ? '/' : '/hanhs-log/'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // a new deploy takes over on the next load
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "Hanh's Log",
        short_name: "Hanh's Log",
        description: 'Trips and eateries in one place: Wanderlog and Savorlog.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#F6F4F0',
        theme_color: '#F6F4F0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        // The live site's service worker must never answer for a preview
        // (/hanhs-log/pr-preview/...), or previews would show the live app.
        navigateFallbackDenylist: [/\/pr-preview\//],
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']
      }
    })
  ]
}))
