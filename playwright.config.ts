import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

const browserPath = process.env.CHROME_PATH || ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/opt/brave.com/brave/brave"].find(existsSync)
const apiUrl = "http://127.0.0.1:8001"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4183",
    trace: "retain-on-failure",
    launchOptions: { ...(browserPath ? { executablePath: browserPath } : {}), args: ["--use-fake-device-for-media-stream"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `${process.env.NAO_FAIR_TEST_PYTHON || "../nao-fair-server/.venv/bin/python"} e2e/start-server.py`,
      url: `${apiUrl}/api/robot/status`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4183 --strictPort",
      url: "http://127.0.0.1:4183",
      env: { NAO_FAIR_API_URL: apiUrl },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
