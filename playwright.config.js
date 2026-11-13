import { defineConfig, devices } from '@playwright/test';

/** Browser-level regression suite for the rendered DM and player applications. */
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    forbidOnly: Boolean(process.env.CI),
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
