import { TRIGGER_IDS, TRIGGER_LABELS, isTriggerId, type TriggerId } from "./triggers"
import { bindingFrom } from "./drafts"
import {
  CONVERSATION_LABELS,
  type Applied,
  type Connection,
  type ConnectionState,
  type ConversationState,
  type Picture,
  type ServerMessage,
  type TranscriptLine,
  type TriggerBinding,
} from "./types"

export interface PressMark {
  at: string
  nonce: number
}

export const SENSOR_PRESS_FLASH_MS = 1600

export interface ScreenState {
  connection: Connection
  conversationState: ConversationState
  transcript: TranscriptLine[]
  applied: Applied | null
  activeSetupId: string | null
  presses: Partial<Record<TriggerId, PressMark>>
  activePresses: Partial<Record<TriggerId, true>>
  pressNonce: number
  lastAction: { action: string; ok: boolean; error: string | null } | null
}

export interface TriggerRowView {
  id: TriggerId
  label: string
  pressed: boolean
  pressedAt: string | null
  pressNonce: number
  action: string | null
  motion: string | null
}

export interface ViewState {
  hardwareEnabled: boolean
  conversationState: ConversationState
  conversationLabel: string
  transcript: TranscriptLine[]
  triggers: TriggerRowView[]
  robotName: string | null
  failure: string | null
  connectionState: ConnectionState
}

const EMPTY_CONNECTION: Connection = {
  state: "disconnected",
  address: null,
  name: null,
  failure: null,
}

export function initialScreen(): ScreenState {
  return {
    connection: { ...EMPTY_CONNECTION },
    conversationState: "idle",
    transcript: [],
    applied: null,
    activeSetupId: null,
    presses: {},
    activePresses: {},
    pressNonce: 0,
    lastAction: null,
  }
}

export function clearActivePress(state: ScreenState, sensorId: TriggerId): ScreenState {
  if (!state.activePresses[sensorId]) return state
  const activePresses = { ...state.activePresses }
  delete activePresses[sensorId]
  return { ...state, activePresses }
}

export function reduce(state: ScreenState, message: ServerMessage): ScreenState {
  switch (message.type) {
    case "picture":
      return applyPicture(state, message)
    case "connection.changed":
      return applyConnection(state, message.connection)
    case "conversation.state_changed":
      if (state.connection.state !== "connected") return state
      return { ...state, conversationState: message.state }
    case "transcript.replaced":
      return {
        ...state,
        transcript: message.lines.map((line) => ({
          id: line.id,
          speaker: line.speaker,
          text: line.text,
          timestamp: line.timestamp,
        })),
      }
    case "transcript.message":
      if (state.connection.state !== "connected") return state
      if (message.speaker !== "visitor" && message.speaker !== "nao") return state
      if (state.transcript.some((line) => line.id === message.id)) return state
      return {
        ...state,
        transcript: [
          ...state.transcript,
          {
            id: message.id,
            speaker: message.speaker,
            text: message.text,
            timestamp: message.timestamp,
          },
        ],
      }
    case "sensor.pressed":
      if (state.connection.state !== "connected") return state
      if (!isTriggerId(message.sensor_id)) return state
      return {
        ...state,
        pressNonce: state.pressNonce + 1,
        presses: {
          ...state.presses,
          [message.sensor_id]: { at: message.timestamp, nonce: state.pressNonce + 1 },
        },
        activePresses: { ...state.activePresses, [message.sensor_id]: true },
      }
    case "config.applied":
      return {
        ...state,
        applied: normalizeApplied(message.applied),
        activeSetupId: message.active_setup_id,
        conversationState: "idle",
      }
    case "action.completed":
      return { ...state, lastAction: { action: message.action, ok: true, error: null } }
    case "action.failed":
      return { ...state, lastAction: { action: message.action, ok: false, error: message.error } }
    default:
      return state
  }
}

export function viewOf(state: ScreenState): ViewState {
  const hardwareEnabled = state.connection.state === "connected"
  const conversationState: ConversationState = hardwareEnabled ? state.conversationState : "idle"
  return {
    hardwareEnabled,
    conversationState,
    conversationLabel: CONVERSATION_LABELS[conversationState],
    transcript: state.transcript,
    triggers: TRIGGER_IDS.map((id) => {
      const press = hardwareEnabled ? state.presses[id] : undefined
      return {
        id,
        label: TRIGGER_LABELS[id],
        pressed: hardwareEnabled ? Boolean(state.activePresses[id]) : false,
        pressedAt: press?.at ?? null,
        pressNonce: press?.nonce ?? 0,
        action: state.applied?.triggers?.[id]?.action ?? null,
        motion: state.applied?.triggers?.[id]?.motion ?? null,
      }
    }),
    robotName: hardwareEnabled ? state.connection.name : null,
    failure: state.connection.failure,
    connectionState: state.connection.state,
  }
}

export function connectionLabel(state: ConnectionState, pending: boolean, redialing = false): string {
  if (pending || state === "connecting") return "Verbindung wird hergestellt"
  if (state === "connected" && redialing) return "Verbindung wird wiederhergestellt"
  if (state === "connected") return "Verbunden"
  return "Getrennt"
}

function applyPicture(state: ScreenState, picture: Picture): ScreenState {
  const connection = normalizeConnection(picture.connection)
  const connected = connection.state === "connected"
  return {
    ...state,
    connection,
    conversationState: connected ? picture.conversation_state : "idle",
    transcript: picture.transcript.map((line) => ({ ...line })),
    applied: normalizeApplied(picture.applied),
    activeSetupId: picture.active_setup_id,
    presses: {},
    activePresses: {},
  }
}

function applyConnection(state: ScreenState, connection: Connection): ScreenState {
  const next = normalizeConnection(connection)
  if (next.state !== "connected") {
    return {
      ...state,
      connection: next,
      conversationState: "idle",
      transcript: [],
      presses: {},
      activePresses: {},
    }
  }
  return { ...state, connection: next }
}

function normalizeConnection(connection: Connection): Connection {
  const raw = connection as Connection & { battery?: unknown }
  const state = raw.state ?? "disconnected"
  return {
    state,
    address: raw.address ?? null,
    name: state === "connected" ? raw.name ?? null : null,
    failure: raw.failure ?? null,
    ...(raw.redialing ? { redialing: true } : {}),
  }
}

export function normalizeApplied(applied: Applied): Applied {
  const triggers = {} as Record<TriggerId, TriggerBinding>
  for (const id of TRIGGER_IDS) triggers[id] = bindingFrom(applied.triggers?.[id])
  return {
    ...applied,
    knowledge_ids: [...(applied.knowledge_ids ?? [])],
    tts_replacements: (applied.tts_replacements ?? []).map((entry) => ({ ...entry })),
    stt_vocabulary: (applied.stt_vocabulary ?? []).map((entry) => ({ ...entry })),
    triggers,
  }
}
