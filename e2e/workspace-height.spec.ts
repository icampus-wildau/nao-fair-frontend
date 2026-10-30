import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => { await request.post("/api/robot/disconnect") })
test.afterEach(async ({ request }) => { await request.post("/api/robot/disconnect") })

test("desktop workspaces and column separators reach the bottom at different window heights", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1440, height: 1200 }]) {
    await page.setViewportSize(viewport)
    for (const [route, selector, name] of [["/", ".dash", "dashboard"], ["/system", ".system-view", "system"], ["/system?abschnitt=tests", ".system-tests", "tests"]]) {
      await page.goto(route!)
      await expect(page.locator(selector!)).toBeVisible()
      await expect(page.getByText("Noch keine Konfiguration", { exact: true })).toHaveCount(0)
      if (name !== "system") await expect(page.locator("[data-transcript]")).toBeVisible()
      const layout = await page.locator(selector!).evaluate(element => {
        const canvas = document.querySelector(".canvas")!
        const frame = canvas.getBoundingClientRect()
        const workspace = element.getBoundingClientRect()
        const columns = new Map<number, number>()
        for (const child of element.children) {
          const bounds = child.getBoundingClientRect()
          const column = Math.round(bounds.left)
          columns.set(column, Math.max(columns.get(column) ?? 0, bounds.bottom))
        }
        return { bottom: workspace.bottom, canvasBottom: frame.bottom, columns: [...columns.values()], overflow: canvas.scrollHeight - canvas.clientHeight, horizontal: document.documentElement.scrollWidth - innerWidth }
      })
      expect(Math.abs(layout.bottom - layout.canvasBottom), `${name} at ${viewport.width}×${viewport.height}`).toBeLessThan(2)
      if (name !== "dashboard") for (const bottom of layout.columns) expect(Math.abs(bottom - layout.canvasBottom)).toBeLessThan(2)
      expect(layout.overflow).toBeLessThan(2)
      expect(layout.horizontal).toBeLessThan(2)
      await page.screenshot({ path: `../.taste-skill/full-height/${name}-${viewport.width}x${viewport.height}.png` })
    }
  }
})

test("the transcript absorbs extra height while controls and the saved mobile size stay stable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nao-fair.transcript-height", "180"))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const transcript = page.locator("[data-transcript]")
  await expect(transcript).toBeVisible()
  const small = (await transcript.boundingBox())!
  const heading = page.getByRole("heading", { name: "Schnellsteuerung" })
  const controlsY = (await heading.boundingBox())!.y
  await page.setViewportSize({ width: 1440, height: 1200 })
  const large = (await transcript.boundingBox())!
  expect(large.height - small.height).toBeCloseTo(300, 0)
  expect(large.height).toBeGreaterThan(600)
  expect((await heading.boundingBox())!.y).toBeCloseTo(controlsY, 0)
  await transcript.click()
  expect(await page.evaluate(() => localStorage.getItem("nao-fair.transcript-height"))).toBe("180")
  await page.setViewportSize({ width: 390, height: 844 })
  expect((await transcript.boundingBox())!.height).toBeCloseTo(180, 0)
  await page.getByRole("heading", { name: "Schnellsteuerung" }).scrollIntoViewIfNeeded()
  await expect(page.getByRole("heading", { name: "Schnellsteuerung" })).toBeInViewport()
})

test("long conversations scroll inside the transcript without moving the desktop controls", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Gespräch starten", exact: true })).toBeDisabled()
  const lines = Array.from({ length: 80 }, (_, index) => ({ speaker: index % 2 ? "nao" : "visitor", text: `Gesprächszeile ${index}: Eine längere Antwort zur Studienberatung und zum Testen der Gesprächspipeline.` }))
  await request.post("/api/test/driver", { data: { events: [{ type: "picture", connection: { state: "connected", address: "192.0.2.10" }, conversation_state: "idle", transcript: lines }] } })
  await expect(page.locator(".line")).toHaveCount(80)
  const transcript = page.locator("[data-transcript]")
  expect(await transcript.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  expect(await page.locator(".canvas").evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThan(2)
  await transcript.evaluate(element => element.scrollTo(0, 0))
  await expect(page.getByRole("button", { name: "Neue Zeilen", exact: true })).toBeVisible()
  await request.post("/api/test/driver", { data: { events: [{ type: "transcript.message", speaker: "nao", text: "Letzte Antwort im Gespräch." }] } })
  await expect(page.locator(".line")).toHaveCount(81)
  await page.getByRole("button", { name: "Neue Zeilen", exact: true }).click()
  await expect(page.getByText("Letzte Antwort im Gespräch.", { exact: true })).toBeInViewport()
  await expect(page.getByRole("button", { name: "Gespräch starten", exact: true })).toBeInViewport()
})

test("short windows and stacked layouts keep the final groups reachable", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 560 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const [route, label] of [["/", "Schnellsteuerung"], ["/system", "Gladia"], ["/system?abschnitt=tests", "Übernommene Konfiguration"]]) {
      await page.goto(route!)
      const lastGroup = page.getByRole("heading", { name: label!, exact: true })
      await lastGroup.scrollIntoViewIfNeeded()
      await expect(lastGroup).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
      await page.screenshot({ path: `../.taste-skill/full-height/stacked-${label}-${viewport.width}x${viewport.height}.png` })
    }
  }
})
