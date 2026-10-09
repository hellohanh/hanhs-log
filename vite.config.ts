import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site lives under /hanhs-log/ on GitHub Pages. Pull-request previews
// live under /hanhs-log/pr-preview/pr-N/, so the preview workflow passes its
// own path in through BASE_PATH. Locally (npm run dev) it's just /.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : process.env.BASE_PATH ?? '/hanhs-log/'
}))
