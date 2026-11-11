import { defineConfig } from '@playwright/test';

// e2e no build de produção (dist/), servido pelo vite preview. Chrome instalado (channel).
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4187/',
    channel: 'chrome',
    headless: true,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187/',
    reuseExistingServer: false,
  },
});
