import { defineConfig, devices } from '@playwright/test';

// By default the tests serve dist/index.html themselves. To test a copy that is already hosted,
// give its address:  MARKOPAD_URL=https://markopad.example.com npm test
const hosted = process.env.MARKOPAD_URL;
const base = (hosted || 'http://127.0.0.1:4173').replace(/\/$/, '');

export default defineConfig({
  testDir: 'test',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 30000,
  use: { baseURL: base, acceptDownloads: true },
  webServer: hosted ? undefined : { command: 'node test/serve.mjs', url: base, reuseExistingServer: true },
  projects: [
    { name: 'desktop', testMatch: /desktop\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', testMatch: /phone\.spec\.mjs/, use: { ...devices['Pixel 7'] } },
    {
      name: 'firefox', testMatch: /desktop\.spec\.mjs/,
      use: {
        ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 },
        // Lets the tests read the clipboard back without a permission prompt. Test browser only.
        launchOptions: { firefoxUserPrefs: { 'dom.events.testing.asyncClipboard': true, 'dom.events.asyncClipboard.readText': true, 'dom.events.asyncClipboard.clipboardItem': true } },
      },
    },
    // Safari's engine. Off unless asked for, because on Linux it needs extra system libraries:
    //   npx playwright install --with-deps webkit   then   MARKOPAD_WEBKIT=1 npm test
    ...(process.env.MARKOPAD_WEBKIT ? [{ name: 'webkit', testMatch: /desktop\.spec\.mjs/, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } }] : []),
  ],
});
