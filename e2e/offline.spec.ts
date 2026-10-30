import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  await request.post("/api/robot/disconnect")
})

test("robot settings apply offline, survive reload, and reset unapplied edits", async ({ page, request }) => {
  await page.goto("/roboter")
  await page.getByText("Gesprächszeiten", { exact: true }).click()
  await expect(page.getByRole("heading", { name: "Robotereinstellungen" })).toBeVisible()
  const timing = page.getByRole("spinbutton", { name: "Zuhör-Timeout", exact: true })
  await expect(timing).toBeVisible()
  const initial = Number(await timing.inputValue())
  const changed = initial === 8.5 ? 9.5 : 8.5
  await timing.fill(String(changed))
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click()
  await expect(page.getByText("Übernommen.", { exact: true })).toBeVisible()
  expect((await (await request.get("/api/config/applied")).json()).applied.listening_timeout_secs).toBe(changed)
  await page.reload()
  await expect(timing).toHaveValue(String(changed))
  await timing.fill("12.5")
  await page.getByRole("button", { name: "Zurücksetzen", exact: true }).click()
  await expect(timing).toHaveValue(String(changed))
  await expect(page.getByRole("button", { name: "Winken links", exact: true })).toBeDisabled()
})

test("sensor mapping is editable offline and is applied with a valid motion", async ({ page, request }) => {
  await page.goto("/interaktionen")
  await page.locator("[data-trigger='middle_head']").click()
  await page.getByRole("combobox", { name: "Aktion", exact: true }).selectOption("motion")
  await page.getByRole("combobox", { name: "Bewegung", exact: true }).selectOption("nod")
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click()
  await expect(page.getByText("Übernommen.", { exact: true })).toBeVisible()
  const applied = (await (await request.get("/api/config/applied")).json()).applied
  expect(applied.triggers.middle_head).toMatchObject({ action: "motion", motion: "nod" })
  await expect(page.getByRole("button", { name: "Aktion testen" })).toBeDisabled()
  await page.getByRole("combobox", { name: "Aktion", exact: true }).selectOption("")
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click()
  await expect(page.getByText("Übernommen.", { exact: true })).toBeVisible()
  const reset = (await (await request.get("/api/config/applied")).json()).applied
  expect(reset.triggers.middle_head).toMatchObject({ action: null, motion: null })
})

test("setups retain selected component presets through create, edit, duplicate and activation", async ({ page, request }) => {
  await page.goto("/setups")
  await expect(page.getByRole("heading", { name: "Setups", exact: true })).toBeVisible()
  await expect(page.locator(".setup-item").first()).toBeVisible()
  const promptField = page.getByRole("combobox", { name: "System-Prompt", exact: true })
  const prompt = await promptField.inputValue()
  expect(prompt).not.toBe("")
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click()
  await expect(page.getByText("Setup dupliziert.", { exact: true })).toBeVisible()
  await page.locator(".setup-item").filter({ hasText: "Kopie" }).last().click()
  await page.getByLabel("Name", { exact: true }).fill("Browserprüfung Offline")
  await page.getByRole("button", { name: "Speichern", exact: true }).click()
  await expect(page.getByText("Setup gespeichert.", { exact: true })).toBeVisible()
  await expect(promptField).toHaveValue(prompt)
  await page.getByRole("button", { name: "Setup aktivieren", exact: true }).click()
  await expect(page.getByText("Setup aktiviert.", { exact: true })).toBeVisible()
  const setups = await (await request.get("/api/setups")).json()
  const saved = setups.find((item: { name: string }) => item.name === "Browserprüfung Offline")
  expect(saved.preset_ids.system_prompt).toBe(prompt)
  await page.reload()
  await page.locator(".setup-item").filter({ hasText: "Browserprüfung Offline" }).click()
  await expect(promptField).toHaveValue(prompt)
  await page.getByRole("button", { name: "Löschen", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen", exact: true }).click()
  await expect(page.locator(".setup-item").filter({ hasText: "Browserprüfung Offline" })).toHaveCount(0)
})

test("secret values stay on the server and the browser only receives status", async ({ page, request }) => {
  await page.goto("/system")
  const slot = page.locator("article").filter({ has: page.getByRole("heading", { name: "OpenAI", exact: true }) })
  await slot.getByLabel("Neuer Wert", { exact: true }).fill("test-browser-only-credential")
  await slot.getByRole("button", { name: "Setzen", exact: true }).click()
  await expect(slot.getByText("In der Konsole gesetzt", { exact: true })).toBeVisible()
  await expect(slot.getByLabel("Neuer Wert", { exact: true })).toHaveValue("")
  const response = await (await request.get("/api/secrets")).text()
  expect(response).not.toContain("test-browser-only-credential")
  await slot.getByRole("button", { name: "Entfernen", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Entfernen", exact: true }).click()
  await expect(slot.getByText("Fehlt", { exact: true })).toBeVisible()
})

test("all six screens load at desktop, tablet and phone widths without page overflow", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ["/", "/roboter", "/llm", "/interaktionen", "/setups", "/system"]) {
      await page.goto(route)
      await expect(page.locator("h1")).toBeVisible()
      await expect(page.locator(".top .dot")).toBeVisible()
      await expect(page.getByText("Noch keine Konfiguration", { exact: true })).toHaveCount(0)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(overflow, `${route} at ${width}px`).toBe(false)
      const headerOverlaps = await page.evaluate(() => {
        const connect = document.querySelector('.connect')!.getBoundingClientRect()
        const status = document.querySelector('.status')!.getBoundingClientRect()
        return connect.left < status.right && connect.right > status.left && connect.top < status.bottom && connect.bottom > status.top
      })
      expect(headerOverlaps, `connection and status at ${width}px`).toBe(false)
      await page.screenshot({ path: `../.taste-skill/after/screens/${route.slice(1) || "dashboard"}-${width}.png`, fullPage: true })
    }
  }
  expect(errors).toEqual([])
})
