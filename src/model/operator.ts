import type { Applied, ContentItem, Preset, PresetKind } from './types'
import type { InteractionsDraft, LlmDraft, RobotDraft } from './drafts'
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })
export function alphabetical<T>(items: readonly T[], label: (item: T) => string): T[] { return [...items].sort((a, b) => collator.compare(label(a), label(b))) }
export const PRESET_LABELS: Record<PresetKind, string> = {
  system_prompt: 'System-Prompt', knowledge_bundle: 'Hintergrundwissen', local_context: 'Örtlicher Kontext', personality: 'Persönlichkeit',
  llm: 'Modell / Generierung', voice: 'Stimme und Audio', stt_vocabulary: 'STT-Vokabular', tts_replacements: 'TTS-Ersetzungen', interaction_mappings: 'Interaktionen',
}
export const FIELD_LABELS: Record<string, string> = {
  volume: 'Lautstärke', speech_speed: 'Sprechtempo', tts_language: 'Sprache', posture: 'Haltung', microphone_enabled: 'Mikrofon', stt_enabled: 'Spracherkennung', llm_enabled: 'Modell im Gespräch',
  listening_timeout_secs: 'Zuhör-Timeout', context_reset_timeout_secs: 'Kontext zurücksetzen', thinking_timeout_secs: 'Antwortzeit', unmute_delay_secs: 'Mikrofon-Freigabe',
  llm_model: 'Modell', temperature: 'Temperatur', max_tokens: 'Maximale Antwort', gladia_region: 'Gladia-Region', gladia_endpointing: 'Endpunktung', gladia_max_utterance_secs: 'Maximale Äußerung',
  gladia_audio_enhancer: 'Audioverbesserung', gladia_language: 'Erkennungssprache', system_prompt_id: 'System-Prompt', knowledge_ids: 'Hintergrundwissen', local_context_id: 'Örtlicher Kontext', personality_id: 'Persönlichkeit',
  tts_replacements: 'TTS-Ersetzungen', stt_vocabulary: 'STT-Vokabular', triggers: 'Sensorzuordnungen', name: 'Name', description: 'Beschreibung', slots: 'Preset-Auswahl',
}
export function valueLabel(value: unknown, library: readonly { id: string; name: string }[] = []): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'An' : 'Aus'
  if (Array.isArray(value)) return value.map(item => valueLabel(item, library)).join(', ') || 'Keine'
  if (typeof value === 'object') return Object.entries(value).map(([key, entry]) => `${FIELD_LABELS[key] ?? key}: ${valueLabel(entry, library)}`).join('; ')
  return library.find(item => item.id === value)?.name ?? String(value)
}
export function changeLines(before: object | null, after: object | null, library: readonly { id: string; name: string }[] = []): string[] {
  if (!before || !after) return []
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>
  return Object.keys(b).filter(key => key !== 'revision' && JSON.stringify(a[key]) !== JSON.stringify(b[key])).map(key => `${FIELD_LABELS[key] ?? key}: ${valueLabel(a[key], library)} → ${valueLabel(b[key], library)}`)
}
export function presetPayload(kind: PresetKind, robot: RobotDraft | null, llm: LlmDraft | null, interactions: InteractionsDraft | null): Record<string, unknown> | null {
  if (kind === 'voice') return robot ? { ...robot } : null
  if (kind === 'interaction_mappings') return interactions ? { triggers: interactions.triggers } : null
  if (!llm) return null
  if (kind === 'system_prompt') return { content_id: llm.system_prompt_id }
  if (kind === 'knowledge_bundle') return { content_ids: llm.knowledge_ids }
  if (kind === 'local_context') return { content_id: llm.local_context_id }
  if (kind === 'personality') return { content_id: llm.personality_id }
  if (kind === 'tts_replacements') return { replacements: llm.tts_replacements }
  const stt = { gladia_region: llm.gladia_region, gladia_endpointing: llm.gladia_endpointing, gladia_max_utterance_secs: llm.gladia_max_utterance_secs, gladia_audio_enhancer: llm.gladia_audio_enhancer, gladia_language: llm.gladia_language }
  if (kind === 'stt_vocabulary') return { ...stt, terms: llm.stt_vocabulary }
  return { ...stt, llm_model: llm.llm_model, temperature: llm.temperature, max_tokens: llm.max_tokens }
}
export function textStats(text: string) { return { words: text.trim().match(/\S+/gu)?.length ?? 0, tokens: Math.ceil([...text].length / 4) } }
export function searchExcerpt(text: string, needle: string): string {
  if (!needle.trim()) return ''
  const index = text.toLocaleLowerCase('de').indexOf(needle.toLocaleLowerCase('de'))
  if (index < 0) return ''
  const start = Math.max(0, index - 40)
  return `${start ? '…' : ''}${text.slice(start, index + needle.length + 70).replace(/\s+/gu, ' ')}${text.length > index + needle.length + 70 ? '…' : ''}`
}
export interface Change { key: string; before: unknown; after: unknown }
export interface SystemReport { api_version: number; started_at: string; checks: Record<string, { state: string; detail: string; action: string }>; conversation_ready: boolean; setup_modified: boolean; setup_changes: Change[]; setup_error: string | null }
export interface References { applied: boolean; presets: { id: string; name: string }[]; setups: { id: string; name: string }[] }
