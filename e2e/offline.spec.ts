import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  await request.post("/api/robot/disconnect")
})

test("robot settings apply offline, survive reload, and reset unapplied edits", async ({ page, request }) => {
  await page.goto("/roboter")
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
  await page.getByRole("navigation", { name: "Roboterbereiche" }).getByRole("button", { name: "Bewegung" }).click()
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

test("a scenario stores the current combination and can be renamed and deleted", async ({ page, request }) => {
  const applied = (await (await request.get("/api/config/applied")).json()).applied
  await page.goto("/llm?abschnitt=scenario")
  await expect(page.getByRole("heading", { name: "Szenarien", exact: true })).toBeVisible()
  await expect(page.locator(".setup-item").first()).toBeVisible()
  await page.getByLabel("Name", { exact: true }).fill("Browserprüfung Offline")
  await page.getByLabel("Beschreibung", { exact: true }).fill("Kurzbeschreibung")
  await page.getByRole("button", { name: "Neu speichern", exact: true }).click()
  await expect(page.getByText("Szenario gespeichert.", { exact: true })).toBeVisible()
  const scenarios = await (await request.get("/api/scenarios")).json()
  const saved = scenarios.find((item: { name: string }) => item.name === "Browserprüfung Offline")
  expect(saved.system_prompt_id).toBe(applied.system_prompt_id)
  expect(saved.description).toBe("Kurzbeschreibung")
  await page.reload()
  await page.getByRole("button", { name: /Browserprüfung Offline/ }).click()
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Browserprüfung Offline")
  await page.getByLabel("Name", { exact: true }).fill("Browserprüfung Umbenannt")
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click()
  await expect(page.getByText("Szenario aktualisiert.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Löschen", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen", exact: true }).click()
  await expect(page.locator(".setup-item").filter({ hasText: "Browserprüfung" })).toHaveCount(0)
})

test("secret values stay on the server and the browser only receives status", async ({ page, request }) => {
  await page.goto("/system?abschnitt=schluessel")
  const slot = page.locator("article").filter({ has: page.getByRole("heading", { name: "OpenAI", exact: true }) })
  await slot.getByLabel("Neuer Wert", { exact: true }).fill("test-browser-only-credential")
  await slot.getByRole("button", { name: "Setzen", exact: true }).click()
  await expect(slot.getByText("In der NAO Fair App gesetzt", { exact: true })).toBeVisible()
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
