import type { GestureId, TriggerId } from "./triggers"

export type ConnectionState = "disconnected" | "connecting" | "connected"
export type ConversationState = "idle" | "listening" | "thinking" | "speaking"
export type Speaker = "visitor" | "nao"
export type ConfigScreen = "robot" | "llm" | "interactions"

export interface Connection {
  state: ConnectionState
  address: string | null
  name: string | null
  failure: string | null
  /** Set only when the server reports a bridge redial. The NAO Fair app never invents it. */
  redialing?: boolean
}

export interface KnownRobot {
  address: string
  name: string
}

export interface TranscriptLine {
  id: string
  speaker: Speaker
  text: string
  timestamp: string
}

export type DialogDelivery = "plain" | "motion" | "animated"

export interface GestureBinding {
  action: string | null
  phrase: string
  voice: string | null
  motion: string | null
  enabled: boolean
}

export interface TriggerBinding {
  tap: GestureBinding
  double_tap: GestureBinding
  long_press: GestureBinding
}

export interface DialogLine {
  speaker?: "nao" | "human"
  id: string
  text: string
  delivery: DialogDelivery
  motion: string | null
}

export interface Dialog {
  id: string
  name: string
  wrap: boolean
  idle_reset_secs: number | null
  lines: DialogLine[]
}

export interface TtsReplacement {
  source: string
  replacement: string
  enabled: boolean
}

export interface SttTerm {
  term: string
  enabled: boolean
}

export interface Applied {
  revision: number
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
  triggers: Record<TriggerId, TriggerBinding>
  dialogs: Dialog[]
  active_dialog_id: string | null
  autostart_enabled: boolean
}

export interface Picture {
  type: "picture"
  sequence: number
  connection: Connection
  conversation_state: ConversationState
  transcript: TranscriptLine[]
  applied: Applied
  active_setup_id: string | null
  autostart_synced?: boolean | null
  known_robots?: KnownRobot[]
}

export type ServerMessage =
  | Picture
  | { type: "conversation.state_changed"; state: ConversationState }
  | { type: "transcript.message"; id: string; speaker: Speaker; text: string; timestamp: string }
  | { type: "transcript.replaced"; sequence: number; lines: TranscriptLine[] }
  | { type: "sensor.pressed"; sensor_id: string; timestamp: string }
  | { type: "config.applied"; applied: Applied; active_setup_id: string | null }
  | { type: "action.completed"; action: string }
  | { type: "action.failed"; action: string; error: string }
  | { type: "connection.changed"; connection: Connection }
  | { type: "known_robots.changed"; known_robots: KnownRobot[] }
  | { type: "autostart.changed"; synced: boolean | null }
  | { type: "autostart.kept" }

export interface TimingRange {
  min: number
  max: number
  step?: number
}

export interface Capabilities {
  sensors: string[]
  motions: string[]
  voices: string[]
  battery: boolean
  timing_ranges: Partial<Record<TimingKey, TimingRange>>
}

export type TimingKey =
  | "listening_timeout_secs"
  | "context_reset_timeout_secs"
  | "thinking_timeout_secs"
  | "unmute_delay_secs"

export type ContentKind = "system_prompt" | "knowledge" | "local_context" | "personality"

export interface ContentItem {
  id: string
  kind: ContentKind
  name: string
  markdown: string
  updated_at: string | null
}

export type PresetKind =
  | "system_prompt"
  | "knowledge_bundle"
  | "local_context"
  | "personality"
  | "llm"
  | "voice"
  | "stt_vocabulary"
  | "tts_replacements"
  | "interaction_mappings"

export interface Preset {
  id: string
  kind: PresetKind
  name: string
  description: string
  payload: Record<string, unknown>
}

export interface SetupSlots {
  system_prompt: string | null
  knowledge_bundle: string | null
  local_context: string | null
  personality: string | null
  llm: string | null
  voice: string | null
  stt_vocabulary: string | null
  tts_replacements: string | null
  interaction_mappings: string | null
}

export interface Setup {
  id: string
  name: string
  description: string
  slots: SetupSlots
}

export type SecretSlotId = "openai" | "gladia"
export type SecretStatus = "missing" | "environment" | "console"

export interface SecretSlot {
  slot: SecretSlotId
  status: SecretStatus
}

export const CONVERSATION_LABELS: Record<ConversationState, string> = {
  idle: "Schläft",
  listening: "Hört zu",
  thinking: "Denkt",
  speaking: "Spricht",
}

export const TIMING_FIELDS: { key: TimingKey; label: string; help: string }[] = [
  {
    key: "listening_timeout_secs",
    label: "Zuhör-Timeout",
    help: "Ohne erkannte Sprache wechselt NAO zu Schläft.",
  },
  {
    key: "context_reset_timeout_secs",
    label: "Kontext zurücksetzen bei Inaktivität nach",
    help: "Nach dieser Zeit im Zustand Schläft werden Kontext und Transkript gelöscht.",
  },
  {
    key: "thinking_timeout_secs",
    label: "Max. LLM-Antwortzeit",
    help: "Längste Wartezeit auf eine Antwort des Modells.",
  },
  {
    key: "unmute_delay_secs",
    label: "Mikrofon-Reaktivierung nach TTS",
    help: "Pause nach der Sprachausgabe, bevor das Mikrofon wieder offen ist.",
  },
]

export const SETUP_SLOT_FIELDS: { key: keyof SetupSlots; label: string; kind: PresetKind }[] = [
  { key: "system_prompt", label: "System-Prompt", kind: "system_prompt" },
  { key: "knowledge_bundle", label: "Hintergrundwissen", kind: "knowledge_bundle" },
  { key: "local_context", label: "Örtlicher Kontext", kind: "local_context" },
  { key: "personality", label: "Persönlichkeit", kind: "personality" },
  { key: "llm", label: "LLM", kind: "llm" },
  { key: "voice", label: "Stimme und Audio", kind: "voice" },
  { key: "stt_vocabulary", label: "STT-Vokabular", kind: "stt_vocabulary" },
  { key: "tts_replacements", label: "TTS-Ersetzungen", kind: "tts_replacements" },
  { key: "interaction_mappings", label: "Interaktionen", kind: "interaction_mappings" },
]

export const SECRET_STATUS_LABELS: Record<SecretStatus, string> = {
  missing: "Fehlt",
  environment: "Aus der Umgebung",
  console: "In der NAO Fair App gesetzt",
}

export const NOTICE_EXTERNAL_APPLY =
  "Die Konfiguration wurde woanders übernommen. Ihre offenen Änderungen bleiben."
