import { expect, test, type Page } from "@playwright/test"

const SERVER = "http://127.0.0.1:8001"

async function listening(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER}/api/robot/status`, { signal: AbortSignal.timeout(1500) })
    return response.status < 500
  } catch {
    return false
  }
}

async function driverAccepts(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER}/api/test/driver`, { method: "GET", signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function gate() {
  expect(await listening(), "The isolated browser-test backend must be running on port 8001.").toBe(true)
  expect(await driverAccepts(), "Live-state tests require the test-only event driver.").toBe(true)
}

async function drive(events: unknown[]) {
  const response = await fetch(`${SERVER}/api/test/driver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Test driver returned ${response.status}: ${text.slice(0, 240)}`)
  }
}

function picture(state: "disconnected" | "connected", conversation: "idle" | "listening" | "thinking" | "speaking", transcript: unknown[]) {
  return {
    type: "picture",
    sequence: Date.now(),
    connection: {
      state,
      address: "10.0.0.8",
      name: state === "connected" ? "NAO-Messe" : null,
      failure: state === "disconnected" ? null : null,
    },
    conversation_state: conversation,
    transcript,
    active_setup_id: null,
  }
}

async function openConsole(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
}

test("disconnected console follows four states, two lines, and one press without clicking hardware", async ({ page }) => {
  await gate()
  await openConsole(page)
  await drive([picture("disconnected", "idle", [])])
  await expect(page.getByText("Schläft", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Winken links" }).first()).toBeDisabled()

  const visitor = { id: "visitor-1", speaker: "visitor", text: "Welche Studiengänge gibt es?", timestamp: "2026-05-14T14:23:00" }
  const nao = { id: "nao-1", speaker: "nao", text: "Wir stellen Telematik vor.", timestamp: "2026-05-14T14:23:20" }
  await drive([picture("connected", "idle", [])])
  for (const [state, label] of [["idle", "Schläft"], ["listening", "Hört zu"], ["thinking", "Denkt"], ["speaking", "Spricht"]]) {
    await drive([{ type: "conversation.state_changed", state }])
    await expect(page.locator(".state.is-on")).toHaveText(label)
  }
  await drive([
    { type: "transcript.message", ...visitor },
    { type: "transcript.message", ...nao },
    { type: "sensor.pressed", sensor_id: "front_head", timestamp: "2026-05-14T14:23:30" },
  ])

  await expect(page.getByText("Spricht", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Welche Studiengänge gibt es?")).toBeVisible()
  await expect(page.getByText("Wir stellen Telematik vor.")).toBeVisible()
  await expect(page.locator("[data-trigger='front_head']")).toHaveAttribute("data-pressed", "true")
  await expect(page.getByRole("button", { name: "Winken links" }).first()).toBeEnabled()
  await expect(page.getByRole("button", { name: "Gespräch beenden" })).toBeEnabled()
})

test("ending the connection from Speaking returns to idle, an empty transcript, and disabled hardware", async ({ page }) => {
  await gate()
  await openConsole(page)
  const line = { id: "nao-9", speaker: "nao", text: "Einen Moment.", timestamp: "2026-05-14T14:24:00" }
  await drive([
    picture("connected", "speaking", [line]),
    { type: "sensor.pressed", sensor_id: "left_bumper", timestamp: "2026-05-14T14:24:01" },
  ])
  await expect(page.getByText("Spricht", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Einen Moment.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Winken links" }).first()).toBeEnabled()

  await drive([picture("disconnected", "idle", [])])

  await expect(page.getByText("Schläft", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Einen Moment.")).toHaveCount(0)
  await expect(page.locator("[data-trigger='left_bumper']")).toHaveAttribute("data-pressed", "false")
  await expect(page.locator("[data-pressed='true']")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Winken links" }).first()).toBeDisabled()
  await expect(page.getByRole("button", { name: "Gespräch starten" })).toBeDisabled()
})
