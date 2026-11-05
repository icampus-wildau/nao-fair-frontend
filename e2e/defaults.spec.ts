import { expect, test } from "@playwright/test"

test("starts with empty optional content and can save and reload a scenario without local context", async ({ page, request }) => {
  const applied = (await (await request.get("/api/config/applied")).json()).applied
  expect(applied.local_context_id).toBeNull()
  expect(applied.knowledge_ids).toEqual([])
  for (const section of ["knowledge", "local_context"]) {
    await page.goto(`/llm?abschnitt=${section}`)
    await expect(page.getByText("Noch kein Baustein.", { exact: true })).toBeVisible()
    await expect(page.locator(".content-row")).toHaveCount(0)
  }
  await page.goto("/llm?abschnitt=scenario")
  await expect(page.locator(".scenario-row")).toHaveCount(0)
  await page.getByLabel("Name", { exact: true }).fill("Ohne örtlichen Kontext")
  await page.getByRole("button", { name: "Aktuelle Konfiguration als neues Szenario speichern", exact: true }).click()
  const row = page.locator(".scenario-row").filter({ hasText: "Ohne örtlichen Kontext" })
  await expect(row).toBeVisible()
  await page.reload()
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Szenario laden", exact: true }).click()
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ohne örtlichen Kontext")
})
