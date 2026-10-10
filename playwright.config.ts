import { defineConfig } from '@playwright/test'

// Browser checks on every pull request: the built site is served locally
// and opened at the three sizes that bit Wanderlog — phone, laptop, and
// laptop at 150% browser zoom (the high-zoom layout bug, E87–E92) — plus
// a 2560 × 1440 desktop monitor.
// 150% zoom = a 1440×900 screen showing a 960×600 page at 1.5× pixels.
export default defineConfig({
  testDir: 'tests/browser',
  outputDir: 'test-results/artifacts',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/' },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: '/' }
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1440, height: 900 } } },
    // Hanh's desktop monitor, the main target for Wanderlog (decision in session 2).
    { name: 'monitor', use: { viewport: { width: 2560, height: 1440 } } },
    { name: 'laptop-150-zoom', use: { viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.5 } }
  ]
})
