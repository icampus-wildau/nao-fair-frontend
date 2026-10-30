import { expect, test } from '@playwright/test'

const applied = {
  revision: 1, volume: 50, speech_speed: 100, tts_language: 'de', posture: 'stand',
  microphone_enabled: true, stt_enabled: true, llm_enabled: true,
  listening_timeout_secs: 5, context_reset_timeout_secs: 30, thinking_timeout_secs: 15, unmute_delay_secs: 1,
  llm_model: 'gpt-6-luna', temperature: null, max_tokens: null,
  gladia_region: 'eu', gladia_endpointing: 0.5, gladia_max_utterance_secs: 30, gladia_audio_enhancer: false, gladia_language: 'de',
  system_prompt_id: 'prompt', knowledge_ids: [], local_context_id: 'context', personality_id: 'personality',
  tts_replacements: [], stt_vocabulary: [], triggers: {},
}

test('LLM Studio opens server defaults and can edit, reset and apply without a robot', async ({ page }) => {
  let config: any = { ...applied }
  const content = [
    { id: 'prompt', kind: 'system_prompt', name: 'Standard', markdown: '# Hallo' },
    { id: 'context', kind: 'local_context', name: 'Messe', markdown: 'Wildau' },
    { id: 'personality', kind: 'personality', name: 'Freundlich', markdown: 'Kurz' },
  ]
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let body: unknown = {}
    if (path === '/api/config/applied') body = { applied: config }
    else if (path === '/api/robot/status') body = { state: 'disconnected', address: null, name: null, failure: null }
    else if (path === '/api/content') body = content
    else if (path.startsWith('/api/content/') && route.request().method() === 'PUT') {
      const item = content.find((entry) => entry.id === path.split('/').pop())!
      Object.assign(item, route.request().postDataJSON())
      body = item
    }
    else if (path === '/api/presets' || path === '/api/setups') body = []
    else if (path === '/api/config/apply') {
      config = { ...config, ...route.request().postDataJSON().draft, revision: config.revision + 1 }
      body = { applied: config }
    }
    await route.fulfill({ json: body })
  })
  await page.goto('/llm')
  await expect(page.getByRole('heading', { name: 'System-Prompt', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Standard', exact: true }).dblclick()
  await expect(page.locator('.cm-content')).toContainText('# Hallo')
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' Entwurf')
  await page.getByRole('button', { name: 'Zurücksetzen' }).click()
  await expect(page.locator('.cm-content')).toContainText('# Hallo')
  await expect(page.locator('.cm-content')).not.toContainText('Entwurf')
  await page.getByRole('navigation', { name: 'Inhalte' }).getByRole('button', { name: 'Modell / Generierung' }).click()
  await page.getByLabel('Modell', { exact: true }).fill('gpt-test')
  await page.getByRole('button', { name: 'Zurücksetzen' }).click()
  await expect(page.getByLabel('Modell', { exact: true })).toHaveValue('gpt-6-luna')
  await page.getByRole('navigation', { name: 'Inhalte' }).getByRole('button', { name: 'System-Prompt' }).click()
  await page.getByRole('button', { name: 'Standard', exact: true }).dblclick()
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' Neu')
  await page.getByRole('navigation', { name: 'Inhalte' }).getByRole('button', { name: 'Modell / Generierung' }).click()
  await page.getByLabel('Modell', { exact: true }).fill('gpt-test')
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect.poll(() => config.llm_model).toBe('gpt-test')
  expect(content[0].markdown).toBe('# Hallo Neu')
  expect(config.temperature).toBeNull()
  expect(config.max_tokens).toBeNull()
})
