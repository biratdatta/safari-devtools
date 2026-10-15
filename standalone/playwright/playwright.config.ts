import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 8765);

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // Safari's engine (WebKit) on desktop and an iPhone profile. Add chromium/firefox if you like.
  projects: [
    { name: 'Desktop Safari (WebKit)', use: { ...devices['Desktop Safari'] } },
    { name: 'iPhone (WebKit)', use: { ...devices['iPhone 15'] } },
  ],
  // Serves ../demo.html for the example tests. Remove when testing your own app (set BASE_URL instead).
  webServer: process.env.BASE_URL ? undefined : {
    command: `python3 -m http.server ${PORT} --directory ..`,
    url: `http://localhost:${PORT}/demo.html`,
    reuseExistingServer: true,
  },
});
