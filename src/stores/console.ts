import { computed, ref, watch } from "vue"
import { defineStore } from "pinia"
import {
  api,
  asActiveSetupId,
  asApplied,
  asCapabilities,
  asConnection,
  asPresets,
  errorText,
} from "../api/client"
import {
  addressEdited,
  addressFromPicture,
  addressUsedForConnect,
  interactionsDraftFrom,
  isIpv4,
  llmDraftFrom,
  robotDraftFrom,
  sameJson,
  sttErrors,
  timingRange,
  ttsErrors,
  type AddressField,
  type InteractionsDraft,
  type LlmDraft,
  type RobotDraft,
} from "../model/drafts"
import { alphabetical, PRESET_LABELS, type SystemReport } from "../model/operator"
import { readLocal, writeLocal } from "../model/local-state"
import {
  clearActivePress,
  connectionLabel,
  initialScreen,
  normalizeApplied,
  reduce,
  SENSOR_PRESS_FLASH_MS,
  viewOf,
} from "../model/screen"
import { isTriggerId, type TriggerId } from "../model/triggers"
import {
  NOTICE_EXTERNAL_APPLY,
  type Applied,
  type Capabilities,
  type ConfigScreen,
  type ContentItem,
  type ContentKind,
  type Preset,
  type PresetKind,
  type SecretSlot,
  type SecretSlotId,
  type ServerMessage,
  type Setup,
  type SetupSlots,
  type TimingKey,
} from "../model/types"

const ADDRESS_KEY = "nao-fair.address"
const EMPTY_SLOTS: SetupSlots = {
  system_prompt: null,
  knowledge_bundle: null,
  local_context: null,
  personality: null,
  llm: null,
  voice: null,
  stt_vocabulary: null,
  tts_replacements: null,
  interaction_mappings: null,
}

function readRemembered(): string | null {
  try {
    const value = localStorage.getItem(ADDRESS_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

function writeRemembered(value: string | null) {
  try {
    if (!value) localStorage.removeItem(ADDRESS_KEY)
    else localStorage.setItem(ADDRESS_KEY, value)
  } catch {
    /* Private mode can reject storage. The field still works. */
  }
}

export const useConsole = defineStore("console", () => {
  const remembered = readRemembered()
  const screen = ref(initialScreen())
  const address = ref<AddressField>({ value: remembered ?? "", dirty: false, remembered })
  const addressError = ref<string | null>(null)
  const pendingConnect = ref(false)
  const robotDraft = ref<RobotDraft | null>(null)
  const llmDraft = ref<LlmDraft | null>(null)
  const interactionDraft = ref<InteractionsDraft | null>(null)
  const notice = ref<string | null>(null)
  const feedback = ref<{ ok: boolean; text: string } | null>(null)
  const serverLine = ref<string | null>(null)
  const capabilities = ref<Capabilities | null>(null)
  const content = ref<ContentItem[]>([])
  const appliedContent = ref<Record<string, string> | null>(null)
  const presets = ref<Preset[]>([])
  const setups = ref<Setup[]>([])
  const secrets = ref<SecretSlot[] | null>(null)
  const secretsError = ref<string | null>(null)
  const libraryError = ref<string | null>(null)
  const contentDirty = ref(false)
  const setupDirty = ref(false)
  const pictureSeen = ref(false)
  const systemReport = ref<SystemReport | null>(null)
  const systemError = ref<string | null>(null)
  const systemLoading = ref(false)
  const backendOutdated = ref(false)
  const textDrafts = ref<Record<string, { name: string; markdown: string }>>({})
  const setupFormDraft = ref<unknown>(null)
  const recoveryNavigation = ref(false)
  const recovery = ref<Record<string, unknown> | null>(null)
  let recoveryChecked = false
  const draftBackupEnabled = ref(readLocal("draft-backup-enabled", true))
  const localApply = ref(false)
  const applying = ref(false)
  const audioState = ref<Record<"volume" | "speech_speed", "" | "saving" | "saved" | "error">>({ volume: "", speech_speed: "" })
  const loadedPreset = ref<Partial<Record<PresetKind, string>>>({})
  const queuedSetup = ref<SetupSlots | null>(null)
  let socket: WebSocket | null = null
  let socketTimer = 0
  let started = false
  const pressFlashTimers = new Map<TriggerId, number>()

  function clearPressFlashTimers() {
    for (const timer of pressFlashTimers.values()) window.clearTimeout(timer)
    pressFlashTimers.clear()
  }

  function schedulePressFlashClear(sensorId: TriggerId) {
    const previous = pressFlashTimers.get(sensorId)
    if (previous !== undefined) window.clearTimeout(previous)
    pressFlashTimers.set(
      sensorId,
      window.setTimeout(() => {
        pressFlashTimers.delete(sensorId)
        screen.value = clearActivePress(screen.value, sensorId)
      }, SENSOR_PRESS_FLASH_MS),
    )
  }

  const view = computed(() => viewOf(screen.value))
  const shownFailure = computed(() => (pendingConnect.value ? null : screen.value.connection.failure))
  const statusLabel = computed(() =>
    connectionLabel(screen.value.connection.state, pendingConnect.value, screen.value.connection.redialing === true),
  )
  const robotDirty = computed(() => {
    const applied = screen.value.applied
    if (!applied || !robotDraft.value) return false
    return !sameJson({ ...robotDraft.value, volume: applied.volume, speech_speed: applied.speech_speed }, robotDraftFrom(applied))
  })
  const llmDirty = computed(() => {
    const applied = screen.value.applied
    if (!applied || !llmDraft.value) return false
    return !sameJson(llmDraft.value, llmDraftFrom(applied))
  })
  const llmContentPending = computed(() => appliedContent.value !== null && content.value.some((item) =>
    Object.hasOwn(appliedContent.value!, item.id) && appliedContent.value![item.id] !== item.markdown,
  ))
  const interactionDirty = computed(() => {
    const applied = screen.value.applied
    if (!applied || !interactionDraft.value) return false
    return !sameJson(interactionDraft.value, interactionsDraftFrom(applied))
  })
  const isDirty = computed(() => robotDirty.value || llmDirty.value || llmContentPending.value || interactionDirty.value || contentDirty.value || setupDirty.value)

  function setFeedback(ok: boolean, text: string) {
    feedback.value = { ok, text }
  }

  function dismissNotice() {
    notice.value = null
  }

  function dismissFeedback() {
    feedback.value = null
  }

  function setAddress(value: string) {
    address.value = addressEdited(address.value, value)
    writeRemembered(address.value.remembered)
    addressError.value = null
  }

  function syncDrafts(previous: Applied | null, originated: boolean) {
    const next = screen.value.applied
    if (!next) return
    const dirty =
      (robotDraft.value && previous ? !sameJson(robotDraft.value, robotDraftFrom(previous)) : false) ||
      (llmDraft.value && previous ? !sameJson(llmDraft.value, llmDraftFrom(previous)) : false) ||
      (interactionDraft.value && previous ? !sameJson(interactionDraft.value, interactionsDraftFrom(previous)) : false)
    if (!previous || !robotDraft.value || !llmDraft.value || !interactionDraft.value) {
      robotDraft.value = robotDraftFrom(next)
      llmDraft.value = llmDraftFrom(next)
      interactionDraft.value = interactionsDraftFrom(next)
      if (originated) notice.value = null
    } else {
      // Rebase unchanged fields. A direct audio update must not erase other drafts.
      function rebase<T extends object>(draft: T, before: T, after: T): T {
        const result = { ...draft }
        for (const key of Object.keys(after) as (keyof T)[]) {
          if (sameJson(draft[key], before[key])) result[key] = after[key]
        }
        return result
      }
      robotDraft.value = rebase(robotDraft.value, robotDraftFrom(previous), robotDraftFrom(next))
      llmDraft.value = rebase(llmDraft.value, llmDraftFrom(previous), llmDraftFrom(next))
      interactionDraft.value = rebase(interactionDraft.value, interactionsDraftFrom(previous), interactionsDraftFrom(next))
      if (originated) notice.value = null
      else if (dirty && Object.keys(next).some((key) => !["revision", "volume", "speech_speed"].includes(key) && !sameJson(previous[key as keyof Applied], next[key as keyof Applied])) && (robotDirty.value || llmDirty.value || interactionDirty.value)) notice.value = NOTICE_EXTERNAL_APPLY
    }
  }

  function ingest(message: ServerMessage) {
    if ((message.type === "picture" || message.type === "config.applied") && !message.applied) return
    const previous = screen.value.applied
    const originated = localApply.value
    screen.value = reduce(screen.value, message)
    if (message.type === "sensor.pressed" && isTriggerId(message.sensor_id)) {
      schedulePressFlashClear(message.sensor_id)
    } else if (
      message.type === "picture"
      || (message.type === "connection.changed" && message.connection.state !== "connected")
    ) {
      clearPressFlashTimers()
    }
    if (message.type === "picture") {
      pictureSeen.value = true
      serverLine.value = null
      const nextAddress = addressFromPicture(address.value, message.connection.address)
      address.value = nextAddress
      writeRemembered(nextAddress.remembered)
      if (message.connection.state === "connected" || message.connection.failure) pendingConnect.value = false
      syncDrafts(previous, originated)
      void loadAppliedContent()
      void loadSystem()
    } else if (message.type === "config.applied") {
      localApply.value = false
      syncDrafts(previous, originated)
      void loadAppliedContent()
      void loadSystem()
    } else if (message.type === "connection.changed") {
      if (message.connection.state === "connected" || message.connection.failure) pendingConnect.value = false
      const nextAddress = addressFromPicture(address.value, message.connection.address)
      address.value = nextAddress
      writeRemembered(nextAddress.remembered)
    } else if (message.type === "action.failed") {
      setFeedback(false, message.error || "Der Befehl ist fehlgeschlagen.")
    } else if (message.type === "action.completed") {
      if (message.action !== "speak") setFeedback(true, "Befehl ausgeführt.")
    }
  }

  function eventsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    // HTTP /api is proxied by Vite. A second websocket on that same host can
    // stay in CONNECTING, so the dev console talks to the API port directly.
    const host = location.port === "5173" ? `${location.hostname}:8000` : location.host
    return `${protocol}//${host}/api/events`
  }

  function connectSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
    const ws = new WebSocket(eventsUrl())
    socket = ws
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage
        if (message && typeof message === "object" && "type" in message) ingest(message)
      } catch {
        /* Ignore a frame that is not a picture or an event. */
      }
    }
    ws.onclose = () => {
      if (socket === ws) socket = null
      if (!pictureSeen.value) serverLine.value = "Der Server ist nicht erreichbar."
      window.clearTimeout(socketTimer)
      socketTimer = window.setTimeout(connectSocket, 1500)
    }
  }

  async function loadSystem(probe = false) {
    if (systemLoading.value) return
    systemLoading.value = true
    try {
      const report = await api.system(probe)
      if (typeof report.api_version !== "number") throw new Error("Der laufende Server liefert keine Versionsinformation. Bitte den Server neu starten.")
      systemReport.value = report
      backendOutdated.value = report.api_version < 2
      systemError.value = null
      if (serverLine.value && /Server|not found|kennt diese Funktion/i.test(serverLine.value)) serverLine.value = null
    } catch (error) {
      systemError.value = errorText(error)
      backendOutdated.value = /kennt diese Funktion|Versionsinformation/.test(systemError.value)
    } finally { systemLoading.value = false }
  }

  function checkRecovery() {
    if (recoveryChecked || !screen.value.applied) return
    recoveryChecked = true
    const saved = readLocal<Record<string, unknown> | null>("draft-backup", null)
    if (draftBackupEnabled.value && saved && saved.version === 1) recovery.value = saved
  }
  function restoreDrafts() {
    const saved = recovery.value
    if (!saved) return
    // Only known draft fields are restored; credentials are never part of a backup.
    if (saved.robot && robotDraft.value) robotDraft.value = { ...robotDraft.value, ...saved.robot as RobotDraft, volume: screen.value.applied!.volume, speech_speed: screen.value.applied!.speech_speed }
    if (saved.llm && llmDraft.value) llmDraft.value = { ...llmDraft.value, ...saved.llm as LlmDraft }
    if (saved.interactions) interactionDraft.value = saved.interactions as InteractionsDraft
    if (saved.texts) textDrafts.value = saved.texts as typeof textDrafts.value
    if (saved.setup) setupFormDraft.value = saved.setup
    contentDirty.value = Object.keys(textDrafts.value).length > 0
    setupDirty.value = Boolean(saved.setup)
    recovery.value = null
    recoveryNavigation.value = true
    return typeof saved.path === "string" ? saved.path : "/llm"
  }
  function dismissRecovery() { recovery.value = null; writeLocal("draft-backup", null) }
  watch(() => screen.value.applied, checkRecovery)
  watch([robotDraft, llmDraft, interactionDraft, textDrafts, setupFormDraft, isDirty, draftBackupEnabled], () => {
    if (!recoveryChecked || recovery.value) return
    writeLocal("draft-backup-enabled", draftBackupEnabled.value)
    writeLocal("draft-backup", draftBackupEnabled.value && isDirty.value ? { version: 1, path: location.pathname, robot: robotDirty.value ? robotDraft.value : null, llm: llmDirty.value ? llmDraft.value : null, interactions: interactionDirty.value ? interactionDraft.value : null, texts: textDrafts.value, setup: setupDirty.value ? setupFormDraft.value : null } : null)
  }, { deep: true, flush: "post" })

  async function loadCapabilities() {
    try {
      capabilities.value = asCapabilities(await api.capabilities())
    } catch {
      capabilities.value = capabilities.value
    }
  }

  async function loadLibrary() {
    try {
      const [nextContent, nextPresets, nextSetups] = await Promise.all([api.listContent(), api.listPresets(), api.listSetups()])
      content.value = alphabetical(nextContent, item => item.name)
      presets.value = alphabetical(nextPresets, item => `${item.name} ${PRESET_LABELS[item.kind]}`)
      setups.value = alphabetical(nextSetups, item => item.name)
      libraryError.value = null
    } catch (error) {
      libraryError.value = errorText(error)
    }
  }

  async function loadAppliedContent() {
    try {
      const result = await api.appliedContent()
      if (result?.items && typeof result.items === "object") appliedContent.value = result.items
    } catch {
      // A failed read must not replace the last known runtime snapshot.
    }
  }

  async function resetLlmContent(): Promise<boolean> {
    if (!appliedContent.value) return true
    try {
      for (const item of content.value) {
        const markdown = appliedContent.value[item.id]
        if (markdown !== undefined && item.markdown !== markdown) {
          await api.updateContent(item.id, { name: item.name, markdown })
        }
      }
      await loadLibrary()
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function loadSecrets() {
    try {
      secrets.value = await api.secrets()
      secretsError.value = null
    } catch (error) {
      secretsError.value = errorText(error)
    }
  }

  async function loadFallback() {
    if (pictureSeen.value) return
    try {
      const [statusBody, appliedBody] = await Promise.all([api.status(), api.applied()])
      if (pictureSeen.value) return
      const connection = asConnection(statusBody)
      if (connection) ingest({ type: "connection.changed", connection })
      const conversation = (statusBody as { conversation_state?: unknown }).conversation_state
      if (
        connection?.state === "connected" &&
        (conversation === "idle" || conversation === "listening" || conversation === "thinking" || conversation === "speaking")
      ) {
        ingest({ type: "conversation.state_changed", state: conversation })
      }
      const applied = asApplied(appliedBody)
      if (applied && !pictureSeen.value) {
        screen.value = { ...screen.value, applied: normalizeApplied(applied), activeSetupId: asActiveSetupId(appliedBody) ?? screen.value.activeSetupId }
        if (!robotDraft.value) robotDraft.value = robotDraftFrom(applied)
        if (!llmDraft.value) llmDraft.value = llmDraftFrom(applied)
        if (!interactionDraft.value) interactionDraft.value = interactionsDraftFrom(applied)
      }
    } catch {
      /* The socket error line covers a missing server. */
    }
  }

  function start() {
    if (started) return
    started = true
    connectSocket()
    void loadCapabilities()
    void loadLibrary()
    void loadAppliedContent()
    void loadSecrets()
    void loadSystem()
    void loadFallback()
    window.addEventListener("beforeunload", (event) => {
      if (!isDirty.value) return
      event.preventDefault()
      event.returnValue = ""
    })
  }

  async function connect() {
    const value = address.value.value.trim()
    if (!value) {
      addressError.value = "Geben Sie eine IP-Adresse ein."
      return
    }
    if (!isIpv4(value)) {
      addressError.value = "Das ist keine gültige IPv4-Adresse."
      return
    }
    address.value = addressUsedForConnect({ ...address.value, value })
    writeRemembered(address.value.remembered)
    addressError.value = null
    pendingConnect.value = true
    serverLine.value = null
    feedback.value = null
    try {
      const body = await api.connect(value)
      const connection = asConnection(body)
      if (connection) ingest({ type: "connection.changed", connection })
    } catch (error) {
      pendingConnect.value = false
      serverLine.value = errorText(error)
    }
  }

  async function disconnect() {
    pendingConnect.value = false
    try {
      const body = await api.disconnect()
      const connection = asConnection(body)
      if (connection) ingest({ type: "connection.changed", connection })
    } catch (error) {
      setFeedback(false, errorText(error))
    }
  }

  function rangeFor(key: TimingKey) {
    return timingRange(capabilities.value?.timing_ranges, key)
  }

  function validate(screenName: ConfigScreen): string | null {
    if (screenName === "robot" && robotDraft.value) {
      const draft = robotDraft.value
      if (draft.volume < 0 || draft.volume > 100) return "Die Lautstärke liegt zwischen 0 und 100."
      if (draft.speech_speed < 50 || draft.speech_speed > 200) return "Das Sprechtempo liegt zwischen 50 und 200 Prozent."
      for (const key of ["listening_timeout_secs", "context_reset_timeout_secs", "thinking_timeout_secs", "unmute_delay_secs"] as const) {
        const range = rangeFor(key)
        const value = draft[key]
        if (value < range.min || value > range.max) return `Der Wert liegt außerhalb von ${range.min}–${range.max} Sekunden.`
      }
    }
    if (screenName === "llm" && llmDraft.value) {
      const draft = llmDraft.value
      if (!draft.llm_model.trim()) return "Das Modell fehlt."
      if (draft.temperature !== null && (!Number.isFinite(draft.temperature) || draft.temperature < 0 || draft.temperature > 2)) return "Die Temperatur liegt zwischen 0 und 2."
      if (draft.max_tokens !== null && (!Number.isInteger(draft.max_tokens) || draft.max_tokens < 1 || draft.max_tokens > 128000)) return "Die Antwortlänge braucht eine ganze Zahl zwischen 1 und 128000."
      if (!draft.gladia_region.trim() || !draft.gladia_language.trim()) return "Region und Sprache für Gladia sind erforderlich."
      if (!Number.isFinite(draft.gladia_endpointing) || draft.gladia_endpointing <= 0 || draft.gladia_endpointing > 10) return "Die Endpunktung muss größer als 0 und höchstens 10 Sekunden sein."
      if (!Number.isFinite(draft.gladia_max_utterance_secs) || draft.gladia_max_utterance_secs < 1 || draft.gladia_max_utterance_secs > 120) return "Die maximale Äußerung liegt zwischen 1 und 120 Sekunden."
      const tts = ttsErrors(draft.tts_replacements)
      if (tts) return tts
      const stt = sttErrors(draft.stt_vocabulary)
      if (stt) return stt
      const prompts = content.value.filter((item) => item.kind === "system_prompt")
      if (prompts.length > 0 && !draft.system_prompt_id) return "Wählen Sie einen System-Prompt."
    }
    if (screenName === "interactions" && interactionDraft.value) {
      for (const binding of Object.values(interactionDraft.value.triggers)) {
        if (binding.action === "speak" && !binding.phrase.trim()) return "Text sprechen braucht einen Wortlaut."
      }
    }
    return null
  }

  async function apply(screenName: ConfigScreen) {
    await audioQueue
    if (applying.value) return false
    const applied = screen.value.applied
    if (!applied) {
      setFeedback(false, "Noch keine Konfiguration vom Server.")
      return
    }
    const problem = validate(screenName)
    if (problem) {
      setFeedback(false, problem)
      return
    }
    const draft = screenName === "robot" ? robotDraft.value : screenName === "llm" ? llmDraft.value : interactionDraft.value
    if (!draft) return
    applying.value = true
    localApply.value = true
    try {
      const body = await api.apply(screenName, draft, applied.revision)
      const next = asApplied(body)
      if (next) {
        ingest({
          type: "config.applied",
          applied: next,
          active_setup_id: asActiveSetupId(body) ?? screen.value.activeSetupId,
        })
      }
      if (screenName === "llm") await loadAppliedContent()
      setFeedback(true, "Übernommen.")
      return true
    } catch (error) {
      localApply.value = false
      setFeedback(false, errorText(error))
      return false
    } finally {
      applying.value = false
    }
  }

  function resetDraft(screenName: ConfigScreen) {
    const applied = screen.value.applied
    if (!applied) return
    if (screenName === "robot") robotDraft.value = robotDraftFrom(applied)
    if (screenName === "llm") llmDraft.value = llmDraftFrom(applied)
    if (screenName === "interactions") interactionDraft.value = interactionsDraftFrom(applied)
  }

  function patchRobot(patch: Partial<RobotDraft>) {
    if (!robotDraft.value) return
    robotDraft.value = { ...robotDraft.value, ...patch }
  }

  let audioQueue: Promise<unknown> = Promise.resolve()
  function commitAudio(key: "volume" | "speech_speed", value: number) {
    patchRobot({ [key]: value })
    audioState.value[key] = "saving"
    feedback.value = null
    audioQueue = audioQueue.then(async () => {
      try {
        const body = await api.audio({ [key]: value })
        audioState.value[key] = "saved"
        window.setTimeout(() => { if (audioState.value[key] === "saved") audioState.value[key] = "" }, 2500)
        const next = asApplied(body)
        if (next && (!screen.value.applied || next.revision > screen.value.applied.revision)) {
          ingest({ type: "config.applied", applied: next, active_setup_id: asActiveSetupId(body) ?? screen.value.activeSetupId })
        }
      } catch (error) {
        audioState.value[key] = "error"
        if (robotDraft.value?.[key] === value && screen.value.applied) patchRobot({ [key]: screen.value.applied[key] })
        setFeedback(false, errorText(error))
      }
    })
    return audioQueue
  }

  async function discardChanges() {
    if (llmContentPending.value && !(await resetLlmContent())) return false
    resetDraft("robot")
    resetDraft("llm")
    resetDraft("interactions")
    textDrafts.value = {}
    setupFormDraft.value = null
    contentDirty.value = false
    setupDirty.value = false
    dismissRecovery()
    notice.value = null
    return true
  }

  function patchLlm(patch: Partial<LlmDraft>) {
    if (!llmDraft.value) return
    llmDraft.value = { ...llmDraft.value, ...patch }
  }

  function patchTrigger(id: TriggerId, patch: Partial<InteractionsDraft["triggers"][TriggerId]>) {
    if (!interactionDraft.value) return
    const next = { ...interactionDraft.value.triggers[id], ...patch, voice: null }
    if (patch.action === "motion" && !next.motion) next.motion = "wave_left"
    if ("action" in patch && patch.action !== "motion") next.motion = null
    interactionDraft.value = {
      triggers: {
        ...interactionDraft.value.triggers,
        [id]: next,
      },
    }
  }

  function requireHardware(): boolean {
    if (view.value.hardwareEnabled) return true
    setFeedback(false, "Kein Roboter verbunden.")
    return false
  }

  async function run(command: () => Promise<unknown>, success: string) {
    if (!requireHardware()) return
    try {
      await command()
      if (success) setFeedback(true, success)
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  function sendMessage(text: string) {
    return run(() => api.sendMessage(text), "Nachricht gesendet.")
  }
  function startConversation() {
    return run(() => api.startConversation(), "Gespräch gestartet.")
  }
  function stopConversation() {
    return run(() => api.stopConversation(), "Gespräch beendet.")
  }
  function speak(text: string) {
    const phrase = text.trim()
    if (!phrase) {
      setFeedback(false, "Der Text ist leer.")
      return
    }
    return run(() => api.speak(phrase), "")
  }
  function stopSpeech() {
    return run(() => api.stopSpeech(), "Sprechen wurde gestoppt.")
  }
  function executeMotion(motion: string) {
    return run(() => api.executeMotion(motion), "Bewegung gestartet.")
  }
  function stopMotion() {
    return run(() => api.stopMotion(), "Bewegung gestoppt.")
  }

  async function testTrigger(id: TriggerId) {
    const binding = interactionDraft.value?.triggers[id]
    if (!binding?.action) {
      setFeedback(false, "Diesem Auslöser ist keine Aktion zugeordnet.")
      return
    }
    if (binding.action === "speak") return speak(binding.phrase)
    if (binding.action === "stop_speech") return stopSpeech()
    if (binding.action === "start_conversation") return startConversation()
    if (binding.action === "stop_conversation") return stopConversation()
    if (binding.action === "stop_and_clear") {
      if (!requireHardware()) return
      return run(() => api.stopAndClear(), "Gespräch beendet und Kontext gelöscht.")
    }
    if (binding.action === "toggle_conversation") {
      return view.value.conversationState === "idle" ? startConversation() : stopConversation()
    }
    if (binding.action === "wave" || binding.action === "motion") return executeMotion(binding.motion || "wave_left")
    if (binding.action === "stop_motion") return stopMotion()
    if (binding.action === "nod") return executeMotion("nod")
    if (binding.action === "shake") return executeMotion("shake")
    setFeedback(false, "Diese Aktion kann hier nicht getestet werden.")
  }

  function motionAllowed(id: string): boolean {
    if (!view.value.hardwareEnabled) return false
    const motions = capabilities.value?.motions
    return motions?.includes(id) ?? false
  }

  async function refreshAfterWrite() {
    await loadLibrary()
    await loadSystem()
  }

  async function saveContent(id: string, input: { name: string; markdown: string }) {
    try {
      await api.updateContent(id, input)
      await refreshAfterWrite()
      contentDirty.value = false
      setFeedback(true, "Baustein gespeichert.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function createContent(input: { kind: ContentKind; name: string; markdown: string }) {
    try {
      const created = await api.createContent(input)
      await refreshAfterWrite()
      setFeedback(true, "Baustein angelegt.")
      return created
    } catch (error) {
      setFeedback(false, errorText(error))
      return null
    }
  }

  async function removeContent(id: string, replacement?: string) {
    try {
      await api.deleteContent(id, replacement)
      await refreshAfterWrite()
      setFeedback(true, "Baustein gelöscht.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function savePreset(kind: PresetKind, name: string, payload: Record<string, unknown>, id?: string) {
    try {
      if (id) await api.updatePreset(id, { name, description: presets.value.find((preset) => preset.id === id)?.description ?? "", payload })
      else {
        const created = await api.createPreset({ kind, name, description: "", payload })
        const preset = asPresets([created])[0]
        if (preset) rememberPreset(kind, preset.id)
      }
      await refreshAfterWrite()
      setFeedback(true, "Preset gespeichert.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function duplicatePreset(id: string) {
    const source = presets.value.find((preset) => preset.id === id)
    if (!source) { setFeedback(false, "Preset nicht gefunden."); return }
    try {
      await api.createPreset({ kind: source.kind, name: `${source.name} Kopie`, description: source.description, payload: source.payload })
      await refreshAfterWrite()
      setFeedback(true, "Preset dupliziert.")
    } catch (error) { setFeedback(false, errorText(error)) }
  }

  async function removePreset(id: string, replacement?: string) {
    try {
      await api.deletePreset(id, replacement)
      if (Object.values(loadedPreset.value).includes(id)) {
        const next = { ...loadedPreset.value }
        for (const key of Object.keys(next) as PresetKind[]) if (next[key] === id) delete next[key]
        loadedPreset.value = next
      }
      await refreshAfterWrite()
      setFeedback(true, "Preset gelöscht.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
    }
  }

  function rememberPreset(kind: PresetKind, id: string) {
    loadedPreset.value = { ...loadedPreset.value, [kind]: id }
  }

  function applyPreset(preset: Preset) {
    rememberPreset(preset.kind, preset.id)
    const payload = preset.payload
    if (preset.kind === "voice" && robotDraft.value) {
      robotDraft.value = { ...robotDraft.value, ...robotFields(payload) }
      void commitAudio("volume", robotDraft.value.volume)
      void commitAudio("speech_speed", robotDraft.value.speech_speed)
      return
    }
    if (preset.kind === "interaction_mappings" && interactionDraft.value && screen.value.applied && payload.triggers && typeof payload.triggers === "object") {
      interactionDraft.value = interactionsDraftFrom({ ...screen.value.applied, triggers: payload.triggers as Applied["triggers"] })
      return
    }
    if (!llmDraft.value) return
    if (preset.kind === "system_prompt") patchLlm({ system_prompt_id: stringOf(payload.content_id ?? payload.system_prompt_id) })
    if (preset.kind === "knowledge_bundle") patchLlm({ knowledge_ids: stringList(payload.content_ids ?? payload.knowledge_ids) })
    if (preset.kind === "local_context") patchLlm({ local_context_id: stringOf(payload.content_id ?? payload.local_context_id) })
    if (preset.kind === "personality") patchLlm({ personality_id: stringOf(payload.content_id ?? payload.personality_id) })
    if (preset.kind === "llm") {
      patchLlm({
        llm_model: typeof payload.llm_model === "string" ? payload.llm_model : llmDraft.value.llm_model,
        temperature: payload.temperature === null ? null : numberOf(payload.temperature, llmDraft.value.temperature ?? 1),
        max_tokens: payload.max_tokens === null ? null : numberOf(payload.max_tokens, llmDraft.value.max_tokens ?? 1024),
        gladia_region: typeof payload.gladia_region === "string" ? payload.gladia_region : llmDraft.value.gladia_region,
        gladia_language: typeof payload.gladia_language === "string" ? payload.gladia_language : llmDraft.value.gladia_language,
        gladia_endpointing: numberOf(payload.gladia_endpointing, llmDraft.value.gladia_endpointing),
        gladia_max_utterance_secs: numberOf(payload.gladia_max_utterance_secs, llmDraft.value.gladia_max_utterance_secs),
        gladia_audio_enhancer: typeof payload.gladia_audio_enhancer === "boolean" ? payload.gladia_audio_enhancer : llmDraft.value.gladia_audio_enhancer,
      })
    }
    if (preset.kind === "tts_replacements" && Array.isArray(payload.replacements ?? payload.entries ?? payload.tts_replacements)) {
      patchLlm({ tts_replacements: (payload.replacements ?? payload.entries ?? payload.tts_replacements) as LlmDraft["tts_replacements"] })
    }
    if (preset.kind === "stt_vocabulary") {
      const terms = payload.terms ?? payload.stt_vocabulary
      patchLlm({
        ...(Array.isArray(terms) ? { stt_vocabulary: terms as LlmDraft["stt_vocabulary"] } : {}),
        gladia_region: typeof payload.gladia_region === "string" ? payload.gladia_region : llmDraft.value.gladia_region,
        gladia_language: typeof payload.gladia_language === "string" ? payload.gladia_language : llmDraft.value.gladia_language,
        gladia_endpointing: numberOf(payload.gladia_endpointing, llmDraft.value.gladia_endpointing),
        gladia_max_utterance_secs: numberOf(payload.gladia_max_utterance_secs, llmDraft.value.gladia_max_utterance_secs),
        gladia_audio_enhancer: typeof payload.gladia_audio_enhancer === "boolean" ? payload.gladia_audio_enhancer : llmDraft.value.gladia_audio_enhancer,
      })
    }
  }

  function queueSetup(slots: SetupSlots) {
    queuedSetup.value = slots
  }

  function takeQueuedSetup(): SetupSlots | null {
    const slots = queuedSetup.value
    queuedSetup.value = null
    return slots
  }

  async function saveSetup(id: string | null, input: { name: string; description: string; slots: SetupSlots }) {
    try {
      if (id) await api.updateSetup(id, input)
      else await api.createSetup(input)
      await refreshAfterWrite()
      setupDirty.value = false
      setFeedback(true, "Setup gespeichert.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function duplicateSetup(id: string) {
    const source = setups.value.find((setup) => setup.id === id)
    if (!source) { setFeedback(false, "Setup nicht gefunden."); return }
    try {
      await api.createSetup({ name: `${source.name} Kopie`, description: source.description, slots: source.slots })
      await refreshAfterWrite()
      setFeedback(true, "Setup dupliziert.")
    } catch (error) { setFeedback(false, errorText(error)) }
  }

  async function removeSetup(id: string) {
    try {
      await api.deleteSetup(id)
      await refreshAfterWrite()
      setFeedback(true, "Setup gelöscht.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function activateSetup(id: string) {
    localApply.value = true
    try {
      const body = await api.activateSetup(id)
      const next = asApplied(body)
      if (next) {
        ingest({ type: "config.applied", applied: next, active_setup_id: asActiveSetupId(body) ?? id })
      } else {
        screen.value = { ...screen.value, activeSetupId: id }
      }
      setFeedback(true, "Setup aktiviert.")
    } catch (error) {
      localApply.value = false
      setFeedback(false, errorText(error))
    }
  }

  async function putSecret(slot: SecretSlotId, value: string) {
    if (!value.trim()) return
    try {
      await api.putSecret(slot, value)
      await loadSecrets()
      await loadSystem()
      setFeedback(true, "Gespeichert.")
      return true
    } catch (error) {
      setFeedback(false, errorText(error))
      return false
    }
  }

  async function removeSecret(slot: SecretSlotId) {
    try {
      await api.deleteSecret(slot)
      await loadSecrets()
      await loadSystem()
      setFeedback(true, "Schlüssel entfernt.")
    } catch (error) {
      setFeedback(false, errorText(error))
    }
  }

  const activeSetup = computed(() => setups.value.find((setup) => setup.id === screen.value.activeSetupId) ?? null)

  return {
    screen,
    systemReport, systemError, systemLoading, backendOutdated, loadSystem,
    textDrafts, setupFormDraft, draftBackupEnabled, recovery, recoveryNavigation, restoreDrafts, dismissRecovery,
    view,
    address,
    addressError,
    pendingConnect,
    shownFailure,
    statusLabel,
    robotDraft,
    llmDraft,
    interactionDraft,
    robotDirty,
    llmDirty,
    llmContentPending,
    interactionDirty,
    notice,
    feedback,
    serverLine,
    capabilities,
    content,
    presets,
    setups,
    secrets,
    secretsError,
    libraryError,
    contentDirty,
    setupDirty,
    isDirty,
    pictureSeen,
    applying, audioState,
    loadedPreset,
    activeSetup,
    emptySlots: EMPTY_SLOTS,
    start,
    ingest,
    setAddress,
    connect,
    disconnect,
    dismissNotice,
    dismissFeedback,
    apply,
    validate,
    resetDraft,
    resetLlmContent,
    patchRobot,
    commitAudio,
    discardChanges,
    patchLlm,
    patchTrigger,
    rangeFor,
    startConversation,
    stopConversation,
    speak,
    sendMessage,
    stopSpeech,
    executeMotion,
    stopMotion,
    testTrigger,
    motionAllowed,
    loadLibrary,
    saveContent,
    createContent,
    removeContent,
    savePreset,
    duplicatePreset,
    removePreset,
    applyPreset,
    queueSetup,
    takeQueuedSetup,
    saveSetup,
    duplicateSetup,
    removeSetup,
    activateSetup,
    putSecret,
    removeSecret,
  }
})

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function robotFields(payload: Record<string, unknown>): Partial<RobotDraft> {
  const patch: Partial<RobotDraft> = {}
  if (typeof payload.volume === "number") patch.volume = payload.volume
  if (typeof payload.speech_speed === "number") patch.speech_speed = payload.speech_speed
  if (typeof payload.tts_language === "string") patch.tts_language = payload.tts_language
  if (typeof payload.posture === "string") patch.posture = payload.posture
  if (typeof payload.microphone_enabled === "boolean") patch.microphone_enabled = payload.microphone_enabled
  if (typeof payload.stt_enabled === "boolean") patch.stt_enabled = payload.stt_enabled
  if (typeof payload.llm_enabled === "boolean") patch.llm_enabled = payload.llm_enabled
  if (typeof payload.listening_timeout_secs === "number") patch.listening_timeout_secs = payload.listening_timeout_secs
  if (typeof payload.context_reset_timeout_secs === "number") patch.context_reset_timeout_secs = payload.context_reset_timeout_secs
  if (typeof payload.thinking_timeout_secs === "number") patch.thinking_timeout_secs = payload.thinking_timeout_secs
  if (typeof payload.unmute_delay_secs === "number") patch.unmute_delay_secs = payload.unmute_delay_secs
  return patch
}
