import { expect, test, type WebSocketRoute } from "@playwright/test"

test.use({ permissions: ["microphone"] })

test.beforeEach(async ({ request, page }) => {
  await request.post("/api/robot/disconnect")
  await page.addInitScript(() => {
    const streams: MediaStream[] = []
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints)
      streams.push(stream)
      return stream
    }
    Object.assign(window, { microphoneTracksStopped: () => streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")), microphoneAcquisitions: () => streams.length })
  })
})

test("streams real browser PCM, displays replies, waits for speech and releases the microphone", async ({ page }) => {
  let route!: WebSocketRoute
  let packets = 0
  let speechFinished = false
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: {
      speak: (utterance: SpeechSynthesisUtterance) => { Object.assign(window, { finishTestSpeech: () => utterance.onend?.(new SpeechSynthesisEvent("end", { utterance })) }) },
      cancel: () => {},
    } })
  })
  await page.routeWebSocket("**/api/browser-audio", ws => {
    route = ws
    ws.onMessage(message => {
      if (typeof message !== "string") { packets++; return }
      const control = JSON.parse(message)
      if (control.type === "speech.finished") {
        speechFinished = true
        ws.send(JSON.stringify({ type: "state", state: "listening" }))
      }
    })
    ws.send(JSON.stringify({ type: "state", state: "listening" }))
    ws.send(JSON.stringify({ type: "ready", sample_rate: 16000 }))
  })
  await page.goto("/system?abschnitt=tests")
  await page.getByRole("button", { name: "Mikrofontest starten" }).click()
  await expect(page.getByText("Mikrofon aktiv", { exact: true })).toBeVisible()
  await expect.poll(() => packets).toBeGreaterThan(2)
  route.send(JSON.stringify({ type: "state", state: "speaking" }))
  route.send(JSON.stringify({ type: "transcript", id: "reply", speaker: "nao", text: "Hallo vom Browser-Test.", timestamp: new Date().toISOString() }))
  route.send(JSON.stringify({ type: "speech", id: "speech-1", text: "Hallo vom Browser-Test.", language: "de", volume: .5, rate: 1 }))
  await expect(page.getByText("Hallo vom Browser-Test.", { exact: true })).toBeVisible()
  await expect(page.getByText("Mikrofon pausiert", { exact: true })).toBeVisible()
  expect(speechFinished).toBe(false)
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { finishTestSpeech?: unknown }).finishTestSpeech)).toBe("function")
  await page.evaluate(() => (window as unknown as { finishTestSpeech: () => void }).finishTestSpeech())
  await expect.poll(() => speechFinished).toBe(true)
  await page.getByRole("button", { name: "Test beenden", exact: true }).click()
  await expect(page.getByText("Mikrofon aus", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { microphoneTracksStopped: () => boolean }).microphoneTracksStopped())).toBe(true)
  await expect(page.getByText("Hallo vom Browser-Test.", { exact: true })).toBeVisible()
})

test("permission denial is explained and leaves a retry available", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError") } })
  await page.goto("/system?abschnitt=tests")
  await page.getByRole("button", { name: "Mikrofontest starten" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Mikrofonzugriff verweigert" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mikrofontest starten" })).toBeEnabled()
})

test("a server error and leaving the test tab both release the microphone", async ({ page }) => {
  let route!: WebSocketRoute
  await page.routeWebSocket("**/api/browser-audio", ws => {
    route = ws
    ws.send(JSON.stringify({ type: "state", state: "listening" }))
    ws.send(JSON.stringify({ type: "ready", sample_rate: 16000 }))
  })
  await page.goto("/system?abschnitt=tests")
  await page.getByRole("button", { name: "Mikrofontest starten" }).click()
  await expect(page.getByText("Mikrofon aktiv", { exact: true })).toBeVisible()
  route.send(JSON.stringify({ type: "error", message: "Gladia-Schlüssel fehlt." }))
  await expect(page.getByRole("alert").filter({ hasText: "Gladia-Schlüssel fehlt" })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { microphoneTracksStopped: () => boolean }).microphoneTracksStopped())).toBe(true)
  await page.getByRole("button", { name: "Mikrofontest starten" }).click()
  await expect(page.getByText("Mikrofon aktiv", { exact: true })).toBeVisible()
  await page.getByRole("navigation", { name: "Systembereiche" }).getByRole("link", { name: "Übersicht", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Betriebsbereitschaft" })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { microphoneTracksStopped: () => boolean }).microphoneTracksStopped())).toBe(true)
})

test("browser test controls fit desktop, tablet and phone", async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Gespräch ohne NAO testen" })).toBeVisible()
    await expect(page.getByRole("searchbox", { name: "Transkript durchsuchen" })).toHaveCount(0)
    await page.screenshot({ path: `../.taste-skill/system-tests/dashboard-${width}.png`, fullPage: true })
    await page.getByRole("link", { name: "Gespräch ohne NAO testen" }).click()
    await expect(page.getByRole("button", { name: "Mikrofontest starten" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Übernommene Konfiguration" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: `../.taste-skill/system-tests/tests-${width}.png`, fullPage: true })
  }
})


test("the disconnected dashboard opens tests without starting a microphone", async ({ page, request }) => {
  const applied = (await (await request.get("/api/config/applied")).json()).applied
  await page.goto("/")
  await expect(page.getByRole("combobox", { name: "Audioquelle" })).toHaveCount(0)
  await expect(page.getByRole("searchbox", { name: "Transkript durchsuchen" })).toHaveCount(0)
  await page.getByRole("link", { name: "Gespräch ohne NAO testen" }).click()
  await expect(page).toHaveURL(/system\?abschnitt=tests$/)
  await expect(page.getByRole("navigation", { name: "Systembereiche" }).getByRole("link", { name: "Tests", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.locator(".test-configuration-list")).toContainText(`Revision ${applied.revision}`)
  await expect(page.locator(".test-configuration-list")).toContainText(applied.llm_model)
  expect(await page.evaluate(() => (window as unknown as { microphoneAcquisitions: () => number }).microphoneAcquisitions())).toBe(0)
  await expect(page.getByText("Mikrofon aus", { exact: true })).toBeVisible()
})

test("a connected NAO keeps the dashboard focused on the robot", async ({ page, request }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Gespräch starten", exact: true })).toBeDisabled()
  await request.post("/api/test/driver", { data: { events: [{ type: "picture", connection: { state: "connected", address: "192.0.2.10" }, conversation_state: "idle" }] } })
  await expect(page.getByRole("button", { name: "Gespräch starten", exact: true })).toBeEnabled()
  await expect(page.getByRole("link", { name: "Gespräch ohne NAO testen" })).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "Audioquelle" })).toHaveCount(0)
  await page.getByRole("link", { name: "System", exact: true }).click()
  await page.getByRole("navigation", { name: "Systembereiche" }).getByRole("link", { name: "Tests", exact: true }).click()
  await expect(page.getByRole("button", { name: "Mikrofontest starten" })).toBeDisabled()
  await expect(page.getByText("Für den Browser-Test zuerst den Roboter trennen.")).toBeVisible()
  expect((await (await request.get("/api/robot/status")).json()).state).toBe("connected")
  await request.post("/api/robot/disconnect")
})

test("test transcripts remain searchable and export the visible lines", async ({ page }) => {
  await page.routeWebSocket("**/api/browser-audio", ws => {
    ws.send(JSON.stringify({ type: "state", state: "listening" }))
    ws.send(JSON.stringify({ type: "ready", sample_rate: 16000 }))
    for (const [id, speaker, text] of [["visitor", "visitor", "Gesuchte Testzeile"], ["reply", "nao", "Andere Antwort"]]) {
      ws.send(JSON.stringify({ type: "transcript", id, speaker, text, timestamp: new Date().toISOString() }))
    }
  })
  await page.goto("/system?abschnitt=tests")
  await page.getByRole("button", { name: "Mikrofontest starten" }).click()
  await expect(page.locator(".line")).toHaveCount(2)
  await page.getByRole("searchbox", { name: "Transkript durchsuchen" }).fill("Gesuchte")
  await expect(page.locator(".line")).toHaveCount(1)
  await page.getByRole("button", { name: "Transkript-Menü" }).click()
  const download = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: "Sichtbare Zeilen als Text exportieren" }).click()
  expect((await download).suggestedFilename()).toBe("nao-transkript.txt")
  await page.getByRole("button", { name: "Test beenden", exact: true }).click()
})
