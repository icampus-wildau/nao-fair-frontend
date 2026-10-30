import type { SystemReport, References, Change } from "../model/operator"
import type {
  Applied,
  Capabilities,
  ConfigScreen,
  Connection,
  ContentItem,
  ContentKind,
  Preset,
  PresetKind,
  SecretSlot,
  SecretSlotId,
  Setup,
  SetupSlots,
} from "../model/types"
import { normalizeApplied } from "../model/screen"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, "Der Server ist nicht erreichbar.")
  }
  if (!response.ok) {
    let message = response.status >= 500 ? "Der Server ist nicht erreichbar." : "Die Anfrage ist fehlgeschlagen."
    try {
      const body = await response.json()
      if (typeof body?.error === "string" && body.error.trim()) message = body.error
      else if (typeof body?.detail === "string" && body.detail.trim()) message = body.detail
    } catch {
      /* The body was not JSON. */
    }
    if (response.status === 404 && message.toLowerCase() === "not found") message = "Der laufende Server kennt diese Funktion noch nicht. Bitte den NAO-Fair-Server neu starten."
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

function listOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== "object") return []
  const record = body as Record<string, unknown>
  for (const key of ["items", "content", "presets", "setups", "results", "data"]) {
    if (Array.isArray(record[key])) return record[key]
  }
  return []
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function nullableId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Die Anfrage ist fehlgeschlagen."
}

export function asConnection(body: unknown): Connection | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const source = record.connection && typeof record.connection === "object" ? (record.connection as Record<string, unknown>) : record
  const state = source.state
  if (state !== "disconnected" && state !== "connecting" && state !== "connected") return null
  return {
    state,
    address: typeof source.address === "string" ? source.address : null,
    name: typeof source.name === "string" ? source.name : null,
    failure: typeof source.failure === "string" ? source.failure : null,
    ...(source.redialing === true ? { redialing: true } : {}),
  }
}

export function asApplied(body: unknown): Applied | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const source = record.applied && typeof record.applied === "object" ? record.applied : record
  if (!source || typeof source !== "object" || typeof (source as Applied).revision !== "number") return null
  return normalizeApplied(source as Applied)
}

export function asCapabilities(body: unknown): Capabilities | null {
  if (!body || typeof body !== "object") return null
  const record = body as Partial<Capabilities>
  return {
    sensors: Array.isArray(record.sensors) ? record.sensors.flatMap((item: unknown) => typeof item === "string" ? [item] : item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []) : [],
    motions: Array.isArray(record.motions) ? record.motions.map(String) : [],
    voices: Array.isArray(record.voices) ? record.voices.map(String) : [],
    battery: record.battery === true,
    timing_ranges: record.timing_ranges && typeof record.timing_ranges === "object" ? record.timing_ranges : {},
  }
}

const CONTENT_KINDS: ContentKind[] = ["system_prompt", "knowledge", "local_context", "personality"]

export function asContent(body: unknown): ContentItem[] {
  return listOf(body).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const kind = record.kind
    if (!CONTENT_KINDS.includes(kind as ContentKind) || typeof record.id !== "string") return []
    return [{
      id: record.id,
      kind: kind as ContentKind,
      name: text(record.name, "Ohne Namen"),
      markdown: text(record.markdown),
      updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
    }]
  })
}

const PRESET_KINDS: PresetKind[] = [
  "system_prompt",
  "knowledge_bundle",
  "local_context",
  "personality",
  "llm",
  "voice",
  "stt_vocabulary",
  "tts_replacements",
  "interaction_mappings",
]

export function asPresets(body: unknown): Preset[] {
  return listOf(body).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    if (typeof record.id !== "string" || !PRESET_KINDS.includes(record.kind as PresetKind)) return []
    const payload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {}
    return [{
      id: record.id,
      kind: record.kind as PresetKind,
      name: text(record.name, "Ohne Namen"),
      description: text(record.description),
      payload,
    }]
  })
}

const SLOT_KEYS: (keyof SetupSlots)[] = [
  "system_prompt",
  "knowledge_bundle",
  "local_context",
  "personality",
  "llm",
  "voice",
  "stt_vocabulary",
  "tts_replacements",
  "interaction_mappings",
]

function slotValue(record: Record<string, unknown>, key: keyof SetupSlots): string | null {
  const slots = record.preset_ids && typeof record.preset_ids === "object" ? record.preset_ids as Record<string, unknown> : record.slots && typeof record.slots === "object" ? record.slots as Record<string, unknown> : null
  return nullableId(slots?.[key] ?? record[`${key}_preset_id`] ?? record[`${key}_id`])
}

export function asSetups(body: unknown): Setup[] {
  return listOf(body).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    if (typeof record.id !== "string") return []
    const slots = {} as SetupSlots
    for (const key of SLOT_KEYS) slots[key] = slotValue(record, key)
    return [{ id: record.id, name: text(record.name, "Ohne Namen"), description: text(record.description), slots }]
  })
}

export function asSecrets(body: unknown): SecretSlot[] {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : null
  const source = record && Array.isArray(record.slots) ? record.slots : listOf(body)
  const found = new Map<SecretSlotId, SecretSlot["status"]>()
  for (const item of source) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (row.slot !== "openai" && row.slot !== "gladia") continue
    if (row.status !== "missing" && row.status !== "environment" && row.status !== "console") continue
    found.set(row.slot, row.status)
  }
  return [
    { slot: "openai", status: found.get("openai") ?? "missing" },
    { slot: "gladia", status: found.get("gladia") ?? "missing" },
  ]
}

export function asActiveSetupId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  return nullableId(record.active_setup_id)
}

function setupBody(input: { name: string; description: string; slots: SetupSlots }) {
  const preset_ids: Record<string, string> = {}
  for (const key of SLOT_KEYS) if (input.slots[key]) preset_ids[key] = input.slots[key]!
  return { name: input.name, description: input.description, preset_ids }
}

export const api = {
  system: (probe = false) => request<SystemReport>(`/api/system?probe=${probe}`),
  setupPreview: (id: string) => request<{ setup_id: string; changes: Change[] }>(`/api/setups/${id}/preview`),
  references: (category: "content" | "presets", id: string) => request<References>(`/api/${category}/${id}/references`),
  audio: (patch: { volume?: number; speech_speed?: number }) => request<unknown>("/api/robot/audio", { method: "PATCH", body: JSON.stringify(patch) }),
  connect: (address: string) => request<unknown>("/api/robot/connect", { method: "POST", body: JSON.stringify({ address }) }),
  disconnect: () => request<unknown>("/api/robot/disconnect", { method: "POST" }),
  status: () => request<unknown>("/api/robot/status"),
  capabilities: () => request<unknown>("/api/robot/capabilities"),
  applied: () => request<unknown>("/api/config/applied"),
  appliedContent: () => request<{ items: Record<string, string> }>("/api/config/applied-content"),
  apply: (screen: ConfigScreen, draft: unknown, expectedRevision: number) =>
    request<unknown>("/api/config/apply", {
      method: "POST",
      body: JSON.stringify({ screen, draft, expected_revision: expectedRevision }),
    }),
  sendMessage: (text: string) => request<unknown>("/api/conversation/message", { method: "POST", body: JSON.stringify({ text }) }),
  startConversation: () => request<unknown>("/api/conversation/start", { method: "POST" }),
  stopConversation: () => request<unknown>("/api/conversation/stop", { method: "POST" }),
  stopAndClear: () => request<unknown>("/api/conversation/stop-and-clear", { method: "POST" }),
  speak: (text: string) => request<unknown>("/api/speech/speak", { method: "POST", body: JSON.stringify({ text }) }),
  stopSpeech: () => request<unknown>("/api/speech/stop", { method: "POST" }),
  executeMotion: (motion: string) => request<unknown>("/api/motions/execute", { method: "POST", body: JSON.stringify({ motion }) }),
  stopMotion: () => request<unknown>("/api/motions/stop", { method: "POST" }),
  listContent: async () => asContent(await request<unknown>("/api/content")),
  createContent: async (input: { kind: ContentKind; name: string; markdown: string }) => {
    const created = asContent([await request<unknown>("/api/content", { method: "POST", body: JSON.stringify(input) })])
    return created[0] ?? null
  },
  updateContent: (id: string, input: { name: string; markdown: string }) =>
    request<unknown>(`/api/content/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteContent: (id: string, replacement?: string) => request<unknown>(`/api/content/${id}${replacement ? `?replacement_id=${encodeURIComponent(replacement)}` : ""}`, { method: "DELETE" }),
  listPresets: async () => asPresets(await request<unknown>("/api/presets")),
  createPreset: (input: { kind: PresetKind; name: string; description: string; payload: Record<string, unknown> }) =>
    request<unknown>("/api/presets", { method: "POST", body: JSON.stringify(input) }),
  updatePreset: (id: string, input: { name?: string; description?: string; payload?: Record<string, unknown> }) =>
    request<unknown>(`/api/presets/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deletePreset: (id: string, replacement?: string) => request<unknown>(`/api/presets/${id}${replacement ? `?replacement_id=${encodeURIComponent(replacement)}` : ""}`, { method: "DELETE" }),
  listSetups: async () => asSetups(await request<unknown>("/api/setups")),
  createSetup: (input: { name: string; description: string; slots: SetupSlots }) =>
    request<unknown>("/api/setups", { method: "POST", body: JSON.stringify(setupBody(input)) }),
  updateSetup: (id: string, input: { name: string; description: string; slots: SetupSlots }) =>
    request<unknown>(`/api/setups/${id}`, { method: "PUT", body: JSON.stringify(setupBody(input)) }),
  deleteSetup: (id: string) => request<unknown>(`/api/setups/${id}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) }),
  activateSetup: (id: string) => request<unknown>(`/api/setups/${id}/activate`, { method: "POST" }),
  secrets: async () => asSecrets(await request<unknown>("/api/secrets")),
  putSecret: (slot: SecretSlotId, value: string) =>
    request<unknown>(`/api/secrets/${slot}`, { method: "PUT", body: JSON.stringify({ value }) }),
  deleteSecret: (slot: SecretSlotId) => request<unknown>(`/api/secrets/${slot}`, { method: "DELETE" }),
}
