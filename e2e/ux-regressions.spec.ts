import { expect, test } from '@playwright/test'

test('audio sliders commit on release offline without shifting the overview', async ({ page, request }) => {
  await request.post('/api/robot/disconnect')
  await page.goto('/')
  const slider = page.getByLabel('Lautstärke')
  await expect(slider).toBeVisible()
  const before = (await (await request.get('/api/config/applied')).json()).applied.volume
  const value = before === 63 ? 64 : 63
  const heading = page.getByRole('heading', { name: 'Schnellsteuerung' })
  const y = (await heading.boundingBox())!.y
  await slider.fill(String(value))
  await slider.dispatchEvent('change')
  await expect.poll(async () => (await (await request.get('/api/config/applied')).json()).applied.volume).toBe(value)
  await expect(page.getByRole('button', { name: 'Übernehmen', exact: true })).toHaveCount(0)
  expect((await heading.boundingBox())!.y).toBe(y)
})

test('clicking a system prompt title updates its radio selection', async ({ page, request }) => {
  const item = await (await request.post('/api/content', { data: { kind: 'system_prompt', name: 'Auswahlprüfung', markdown: 'Ein kurzer Testtext.' } })).json()
  await page.goto('/llm')
  await page.getByRole('button', { name: 'Auswahlprüfung', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Auswahlprüfung', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click()
  await request.delete(`/api/content/${item.id}`)
})

test('confirming discard clears changes before the next navigation', async ({ page }) => {
  await page.goto('/roboter')
  await page.getByText('Gesprächszeiten', { exact: true }).click()
  await page.getByRole("spinbutton", { name: "Zuhör-Timeout", exact: true }).fill('13.5')
  let confirmations = 0
  page.on('dialog', async (dialog) => { confirmations++; await dialog.accept() })
  await page.getByRole('link', { name: 'Interaktionen', exact: true }).click()
  await expect(page).toHaveURL(/interaktionen/)
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL('/')
  expect(confirmations).toBe(1)
})

test('notifications and connection failures never change header or panel positions', async ({ page }) => {
  await page.goto('/llm')
  const top = page.locator('.top')
  const height = (await top.boundingBox())!.height
  const titleY = (await page.getByRole('heading', { name: 'System-Prompt', exact: true }).boundingBox())!.y
  await page.getByRole('button', { name: 'Baustein hinzufügen' }).click()
  await expect(page.getByText('Baustein angelegt.', { exact: true })).toBeVisible()
  expect((await top.boundingBox())!.height).toBe(height)
  expect((await page.getByRole('heading', { name: 'System-Prompt', exact: true }).boundingBox())!.y).toBe(titleY)
  await page.getByLabel('IP-Adresse').fill('falsch')
  await page.getByRole('button', { name: 'Verbinden', exact: true }).click()
  const warning = page.getByRole('button', { name: 'Verbindungsfehler anzeigen' })
  await expect(warning).toBeVisible()
  expect((await top.boundingBox())!.height).toBe(height)
  await warning.click()
  await expect(page.getByRole('dialog', { name: 'Verbindungsfehler' })).toContainText('keine gültige IPv4-Adresse')
})

test('audio saves only its own field while other robot settings remain staged', async ({ page, request }) => {
  await page.goto('/roboter')
  await page.getByText('Gesprächszeiten', { exact: true }).click()
  const original = (await (await request.get('/api/config/applied')).json()).applied
  const timeout = original.listening_timeout_secs === 11.5 ? 12.5 : 11.5
  await page.getByRole("spinbutton", { name: "Zuhör-Timeout", exact: true }).fill(String(timeout))
  await page.getByLabel('Sprechtempo', { exact: true }).fill('135')
  await page.getByLabel('Sprechtempo', { exact: true }).dispatchEvent('change')
  await expect.poll(async () => (await (await request.get('/api/config/applied')).json()).applied.speech_speed).toBe(135)
  const next = (await (await request.get('/api/config/applied')).json()).applied
  expect(next.listening_timeout_secs).toBe(original.listening_timeout_secs)
  await expect(page.getByRole("spinbutton", { name: "Zuhör-Timeout", exact: true })).toHaveValue(String(timeout))
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click()
  await expect(page.getByLabel('Sprechtempo', { exact: true })).toHaveValue('135')
})

test('studio selects first, opens the editor explicitly, resizes and keeps independent scrolling', async ({ page, request }) => {
  const ids: string[] = []
  for (let i = 0; i < 24; i++) {
    const item = await (await request.post('/api/content', { data: { kind: 'knowledge', name: `Wissen Scrollprüfung ${i}`, markdown: 'Ein Testtext mit mehreren Wörtern.\n'.repeat(80) } })).json()
    ids.push(item.id)
  }
  await page.setViewportSize({ width: 1440, height: 640 })
  await page.goto('/llm?abschnitt=knowledge')
  await expect(page.getByRole('complementary', { name: 'Baustein-Editor' })).toHaveCount(0)
  const row = page.getByRole('button', { name: 'Wissen Scrollprüfung 0', exact: true })
  await row.click()
  await expect(page.getByRole('checkbox', { name: 'Wissen Scrollprüfung 0 verwenden', exact: true })).toBeChecked()
  await expect(page.getByRole('complementary', { name: 'Baustein-Editor' })).toHaveCount(0)
  await row.dblclick()
  const editor = page.getByRole('complementary', { name: 'Baustein-Editor' })
  await expect(editor).toBeVisible()
  const width = (await editor.boundingBox())!.width
  const splitter = page.getByRole('separator', { name: 'Editorbreite' })
  await splitter.focus()
  await page.keyboard.press('ArrowLeft')
  expect((await editor.boundingBox())!.width).toBe(width + 32)
  const box = (await splitter.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x - 50, box.y + 100)
  await page.mouse.up()
  expect((await editor.boundingBox())!.width).toBeGreaterThan(width + 60)
  await page.locator('.studio-main').evaluate((el) => { el.scrollTop = 400 })
  expect(await page.locator('.studio-main').evaluate((el) => el.scrollTop)).toBeGreaterThan(300)
  expect(await page.locator('.subnav').evaluate((el) => el.scrollTop)).toBe(0)
  expect(await page.locator('.canvas').evaluate((el) => el.scrollTop)).toBe(0)
  await page.screenshot({ path: '../.taste-skill/revision/studio-editor-1440.png' })
  await page.getByRole('button', { name: 'Editor einklappen' }).click()
  await expect(editor).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Inhalte' }).getByRole('button', { name: 'Modell / Generierung' }).click()
  await expect(page.getByLabel('Modell', { exact: true })).toBeVisible()
  await expect(splitter).toHaveCount(0)
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click()
  for (const id of ids) await request.delete(`/api/content/${id}`)
})

test('content menus delete the named unused item and protect applied content', async ({ page, request }) => {
  const created = await (await request.post('/api/content', { data: { kind: 'system_prompt', name: 'Menüprüfung', markdown: 'Drei kurze Wörter.' } })).json()
  await page.goto('/llm')
  const row = page.locator('.content-row').filter({ has: page.getByRole('button', { name: 'Menüprüfung', exact: true }) })
  await expect(row).toContainText('3 Wörter')
  await expect(row).toContainText(/ca\. \d+ Token/)
  await page.getByRole('button', { name: 'Menü für Menüprüfung', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Löschen', exact: true }).click()
  await page.getByRole('dialog', { name: 'Verwendung und Löschen' }).getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(row).toHaveCount(0)
  expect((await request.get(`/api/content/${created.id}`)).status()).toBe(404)
  await page.locator('.content-row:has(input:checked) .item-menu').click()
  await expect(page.getByRole('menuitem', { name: 'Löschen (aktuell übernommen)' })).toBeDisabled()
})

test('speech text information waits at least 500ms and can open a dialog', async ({ page }) => {
  await page.goto('/interaktionen')
  await page.locator('[data-trigger="middle_head"] .sensor-choice').click()
  await page.getByRole('combobox', { name: 'Aktion', exact: true }).selectOption('speak')
  await page.getByRole('textbox', { name: 'Wortlaut', exact: true }).fill('Willkommen in Wildau.')
  const info = page.getByRole('button', { name: 'Wortlaut für Kopf Mitte' })
  await info.hover()
  await page.waitForTimeout(450)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toContainText('Willkommen in Wildau.')
  await info.click()
  await expect(page.getByRole('dialog', { name: 'Wortlaut für Kopf Mitte' })).toContainText('Willkommen in Wildau.')
  await page.getByRole('dialog').getByRole('button', { name: 'Schließen', exact: true }).click()
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click()
})
