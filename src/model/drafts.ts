import { TRIGGER_IDS, type TriggerId } from "./triggers"
import type { Applied, TtsReplacement, SttTerm, TriggerBinding, TimingKey, TimingRange } from "./types"

export interface RobotDraft {
  volume: number
  speech_speed: number
  tts_language: string
  posture: string
  microphone_enabled: boolean
  stt_enabled: boolean
  llm_enabled: boolean
  listening_timeout_secs: number
  context_reset_timeout_secs: number
  thinking_timeout_secs: number
  unmute_delay_secs: number
}

export interface LlmDraft {
  llm_model: string
  temperature: number | null
  max_tokens: number | null
  gladia_region: string
  gladia_endpointing: number
  gladia_max_utterance_secs: number
  gladia_audio_enhancer: boolean
  gladia_language: string
  system_prompt_id: string | null
  knowledge_ids: string[]
  local_context_id: string | null
  personality_id: string | null
  tts_replacements: TtsReplacement[]
  stt_vocabulary: SttTerm[]
}

export interface InteractionsDraft {
  triggers: Record<TriggerId, TriggerBinding>
}

export interface AddressField {
  value: string
  dirty: boolean
  remembered: string | null
}

const DEFAULT_RANGES: Record<TimingKey, TimingRange> = {
  listening_timeout_secs: { min: 0.5, max: 120, step: 0.1 },
  context_reset_timeout_secs: { min: 1, max: 3600, step: 1 },
  thinking_timeout_secs: { min: 1, max: 180, step: 0.1 },
  unmute_delay_secs: { min: 0, max: 10, step: 0.1 },
}

export function emptyBinding(): TriggerBinding {
  return { action: null, phrase: "", voice: null, motion: null, enabled: true }
}

export function bindingFrom(raw: Partial<TriggerBinding> | undefined): TriggerBinding {
  return {
    action: raw?.action ? raw.action : null,
    phrase: raw?.phrase ?? "",
    voice: null,
    motion: raw?.motion ?? null,
    enabled: raw?.enabled !== false,
  }
}

export function robotDraftFrom(applied: Applied): RobotDraft {
  return {
    volume: applied.volume,
    speech_speed: applied.speech_speed,
    tts_language: applied.tts_language,
    posture: applied.posture,
    microphone_enabled: applied.microphone_enabled,
    stt_enabled: applied.stt_enabled,
    llm_enabled: applied.llm_enabled,
    listening_timeout_secs: applied.listening_timeout_secs,
    context_reset_timeout_secs: applied.context_reset_timeout_secs,
    thinking_timeout_secs: applied.thinking_timeout_secs,
    unmute_delay_secs: applied.unmute_delay_secs,
  }
}

export function llmDraftFrom(applied: Applied): LlmDraft {
  return {
    llm_model: applied.llm_model,
    temperature: applied.temperature,
    max_tokens: applied.max_tokens,
    gladia_region: applied.gladia_region,
    gladia_endpointing: applied.gladia_endpointing,
    gladia_max_utterance_secs: applied.gladia_max_utterance_secs,
    gladia_audio_enhancer: applied.gladia_audio_enhancer,
    gladia_language: applied.gladia_language,
    system_prompt_id: applied.system_prompt_id,
    knowledge_ids: [...applied.knowledge_ids],
    local_context_id: applied.local_context_id,
    personality_id: applied.personality_id,
    tts_replacements: applied.tts_replacements.map((entry) => ({ ...entry })),
    stt_vocabulary: applied.stt_vocabulary.map((entry) => ({ ...entry })),
  }
}

export function interactionsDraftFrom(applied: Applied): InteractionsDraft {
  const triggers = {} as Record<TriggerId, TriggerBinding>
  for (const id of TRIGGER_IDS) triggers[id] = bindingFrom(applied.triggers?.[id])
  return { triggers }
}

export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function changedKeys(a: object, b: object): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((key) => !sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

export function timingRange(
  ranges: Partial<Record<TimingKey, TimingRange>> | null | undefined,
  key: TimingKey,
): { min: number; max: number; step: number } {
  const found = ranges?.[key]
  if (found && Number.isFinite(found.min) && Number.isFinite(found.max) && found.max > found.min) {
    return { min: found.min, max: found.max, step: found.step && found.step > 0 ? found.step : 0.1 }
  }
  const fallback = DEFAULT_RANGES[key]
  return { min: fallback.min, max: fallback.max, step: fallback.step ?? 0.1 }
}

export function ttsOverlapNotes(entries: TtsReplacement[]): string[] {
  const enabled = entries.map((row, index) => ({ ...row, index })).filter((row) => row.enabled && row.source.trim())
  const lines: string[] = []
  for (let i = 0; i < enabled.length; i++) for (let j = i + 1; j < enabled.length; j++) {
    const a = enabled[i]!, b = enabled[j]!
    if (a.source.includes(b.source) || b.source.includes(a.source) || a.replacement.includes(b.source)) lines.push(`Priorität ${a.index + 1} (${a.source}) kann Priorität ${b.index + 1} (${b.source}) beeinflussen.`)
  }
  return lines
}

export function previewReplacements(text: string, entries: TtsReplacement[]): string {
  let out = text
  for (const entry of entries) {
    if (!entry.enabled) continue
    const source = entry.source
    if (!source) continue
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu")
    out = out.replace(pattern, () => entry.replacement)
  }
  return out
}

export function highlightReplacements(text: string, entries: TtsReplacement[]): { text: string; highlight: boolean }[] {
  const result = previewReplacements(text, entries)
  const replacements = entries.filter((row) => row.enabled && row.replacement).map((row) => row.replacement).sort((a, b) => b.length - a.length)
  if (!result || !replacements.length) return [{ text: result, highlight: false }]
  const pattern = new RegExp(`(${replacements.map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})`, "gu")
  return result.split(pattern).filter(Boolean).map((part) => ({ text: part, highlight: replacements.includes(part) }))
}

export function ttsErrors(entries: TtsReplacement[]): string | null {
  const seen = new Set<string>()
  for (const entry of entries) {
    const source = entry.source.trim()
    if (!source) return "Eine Quelle ist leer."
    if (!entry.replacement.trim()) return `„${source}“ hat keine Ersetzung.`
    if (seen.has(source)) return `„${source}“ ist doppelt.`
    seen.add(source)
  }
  return null
}

export function sttErrors(entries: SttTerm[]): string | null {
  const seen = new Set<string>()
  for (const entry of entries) {
    const term = entry.term.trim()
    if (!term) return "Ein Begriff ist leer."
    const key = term.toLocaleLowerCase("de")
    if (seen.has(key)) return `„${term}“ ist doppelt.`
    seen.add(key)
  }
  return null
}

export function isIpv4(value: string): boolean {
  const parts = value.trim().split(".")
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    const number = Number(part)
    return number >= 0 && number <= 255
  })
}

export function addressFromPicture(field: AddressField, pictureAddress: string | null): AddressField {
  if (pictureAddress) {
    return { value: pictureAddress, dirty: false, remembered: pictureAddress }
  }
  if (field.dirty) return { ...field }
  return { value: field.remembered ?? "", dirty: false, remembered: field.remembered }
}

export function addressEdited(field: AddressField, value: string): AddressField {
  if (value.trim() === "") return { value: "", dirty: true, remembered: null }
  return { value, dirty: true, remembered: field.remembered }
}

export function addressUsedForConnect(field: AddressField): AddressField {
  const value = field.value.trim()
  if (!value) return { value: "", dirty: true, remembered: null }
  return { value, dirty: false, remembered: value }
}

export function reconcileDraft<T>(draft: T, next: T, dirty: boolean, originatedHere: boolean): { draft: T; notice: boolean } {
  if (originatedHere || !dirty) return { draft: next, notice: false }
  return { draft, notice: true }
}
