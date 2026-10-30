import { describe, expect, it } from "vitest"
import { addressEdited, addressFromPicture, type AddressField } from "./drafts"
import { clearActivePress, initialScreen, reduce, viewOf, type ScreenState } from "./screen"
import { TRIGGER_IDS } from "./triggers"
import type { Applied, Picture, ServerMessage, TriggerBinding } from "./types"

function binding(action: string | null): TriggerBinding {
  return { action, phrase: "", voice: null, motion: null, enabled: true }
}

function applied(): Applied {
  return {
    revision: 3,
    volume: 60,
    speech_speed: 100,
    tts_language: "de-DE",
    posture: "Stand",
    microphone_enabled: true,
    stt_enabled: true,
    llm_enabled: true,
    listening_timeout_secs: 3,
    context_reset_timeout_secs: 30,
    thinking_timeout_secs: 20,
    unmute_delay_secs: 0.3,
    llm_model: "server-model",
    temperature: 0.2,
    max_tokens: 300,
    gladia_region: "eu-west",
    gladia_endpointing: 0.5,
    gladia_max_utterance_secs: 12,
    gladia_audio_enhancer: false,
    gladia_language: "de",
    system_prompt_id: "prompt-1",
    knowledge_ids: [],
    local_context_id: null,
    personality_id: null,
    tts_replacements: [],
    stt_vocabulary: [],
    triggers: {
      front_head: binding("toggle_conversation"),
      middle_head: binding(null),
      rear_head: binding("stop_and_clear"),
      left_hand: binding(null),
      right_hand: binding(null),
      left_bumper: binding("wave"),
      right_bumper: binding("wave"),
    },
  }
}

function picture(partial: Partial<Picture> & Pick<Picture, "connection" | "conversation_state" | "transcript">): Picture {
  return {
    type: "picture",
    sequence: partial.sequence ?? 1,
    applied: partial.applied ?? applied(),
    active_setup_id: partial.active_setup_id ?? null,
    ...partial,
  }
}

function feed(state: ScreenState, ...messages: ServerMessage[]): ScreenState {
  return messages.reduce(reduce, state)
}

describe("screen model", () => {
  it("starts from a disconnected picture at idle, with hardware off and no press", () => {
    const state = reduce(
      initialScreen(),
      picture({
        connection: { state: "disconnected", address: null, name: null, failure: null },
        conversation_state: "idle",
        transcript: [],
      }),
    )
    const view = viewOf(state)
    expect(view.conversationState).toBe("idle")
    expect(view.conversationLabel).toBe("Schläft")
    expect(view.transcript).toEqual([])
    expect(view.hardwareEnabled).toBe(false)
    expect(view.robotName).toBeNull()
    expect(view.triggers.map((row) => row.pressed)).toEqual(TRIGGER_IDS.map(() => false))
  })

  it("replaces the transcript, then shows four states, two finished lines, and one press", () => {
    let state = reduce(
      initialScreen(),
      picture({
        sequence: 1,
        connection: { state: "disconnected", address: "10.0.0.8", name: "should-hide", failure: "Port zu" },
        conversation_state: "speaking",
        transcript: [],
      }),
    )
    expect(viewOf(state).transcript).toEqual([])
    expect(viewOf(state).conversationLabel).toBe("Schläft")
    expect(viewOf(state).hardwareEnabled).toBe(false)

    state = reduce(
      state,
      picture({
        sequence: 2,
        connection: { state: "connected", address: "10.0.0.8", name: "NAO-Messe", failure: null },
        conversation_state: "idle",
        transcript: [{ id: "kept", speaker: "visitor", text: "schon da", timestamp: "2026-05-14T14:20:00" }],
      }),
    )
    expect(viewOf(state).transcript.map((line) => line.id)).toEqual(["kept"])
    expect(viewOf(state).hardwareEnabled).toBe(true)
    expect(viewOf(state).robotName).toBe("NAO-Messe")

    state = feed(
      state,
      { type: "conversation.state_changed", state: "idle" },
      { type: "conversation.state_changed", state: "listening" },
      { type: "conversation.state_changed", state: "thinking" },
      { type: "conversation.state_changed", state: "speaking" },
      {
        type: "transcript.message",
        id: "visitor-1",
        speaker: "visitor",
        text: "Welche Studiengänge gibt es?",
        timestamp: "2026-05-14T14:23:00",
      },
      {
        type: "transcript.message",
        id: "nao-1",
        speaker: "nao",
        text: "Wir stellen Telematik vor.",
        timestamp: "2026-05-14T14:23:20",
      },
      { type: "sensor.pressed", sensor_id: "front_head", timestamp: "2026-05-14T14:23:30" },
    )

    const view = viewOf(state)
    expect(view.hardwareEnabled).toBe(true)
    expect(view.conversationState).toBe("speaking")
    expect(view.conversationLabel).toBe("Spricht")
    expect(view.transcript.map((line) => line.id)).toEqual(["kept", "visitor-1", "nao-1"])
    expect(view.transcript.map((line) => line.speaker)).toEqual(["visitor", "visitor", "nao"])
    expect(view.triggers.find((row) => row.id === "front_head")?.pressed).toBe(true)
    expect(view.triggers.filter((row) => row.pressed).map((row) => row.id)).toEqual(["front_head"])

    const afterFlash = clearActivePress(state, "front_head")
    const faded = viewOf(afterFlash)
    expect(faded.triggers.find((row) => row.id === "front_head")?.pressed).toBe(false)
    expect(faded.triggers.find((row) => row.id === "front_head")?.pressedAt).toBe("2026-05-14T14:23:30")

    const replaced = reduce(
      state,
      picture({
        sequence: 3,
        connection: { state: "connected", address: "10.0.0.8", name: "NAO-Messe", failure: null },
        conversation_state: "speaking",
        transcript: [
          {
            id: "visitor-1",
            speaker: "visitor",
            text: "Welche Studiengänge gibt es?",
            timestamp: "2026-05-14T14:23:00",
          },
          { id: "nao-1", speaker: "nao", text: "Wir stellen Telematik vor.", timestamp: "2026-05-14T14:23:20" },
        ],
      }),
    )
    expect(viewOf(replaced).transcript.map((line) => line.id)).toEqual(["visitor-1", "nao-1"])
    expect(viewOf(replaced).triggers.every((row) => !row.pressed)).toBe(true)
  })

  it("replaces the transcript with an empty list after a visitor line and a NAO line", () => {
    let state = reduce(
      initialScreen(),
      picture({
        connection: { state: "connected", address: "10.0.0.8", name: "NAO-Messe", failure: null },
        conversation_state: "listening",
        transcript: [],
      }),
    )
    state = feed(
      state,
      {
        type: "transcript.message",
        id: "visitor-1",
        speaker: "visitor",
        text: "Welche Studiengänge gibt es?",
        timestamp: "2026-05-14T14:23:00",
      },
      {
        type: "transcript.message",
        id: "nao-1",
        speaker: "nao",
        text: "Wir stellen Telematik vor.",
        timestamp: "2026-05-14T14:23:20",
      },
    )
    expect(viewOf(state).transcript.map((line) => line.speaker)).toEqual(["visitor", "nao"])

    state = reduce(state, { type: "transcript.replaced", sequence: 8, lines: [] })
    expect(viewOf(state).transcript).toEqual([])
    expect(viewOf(state).hardwareEnabled).toBe(true)
  })

  it("returns to idle with an empty transcript and unpressed rows when speaking ends in a disconnect picture", () => {
    let state = reduce(
      initialScreen(),
      picture({
        connection: { state: "connected", address: "10.0.0.8", name: "NAO-Messe", failure: null },
        conversation_state: "speaking",
        transcript: [{ id: "nao-1", speaker: "nao", text: "Einen Moment.", timestamp: "2026-05-14T14:24:00" }],
      }),
    )
    state = reduce(state, { type: "sensor.pressed", sensor_id: "left_bumper", timestamp: "2026-05-14T14:24:01" })
    expect(viewOf(state).conversationState).toBe("speaking")
    expect(viewOf(state).hardwareEnabled).toBe(true)

    state = reduce(
      state,
      picture({
        connection: { state: "disconnected", address: "10.0.0.8", name: "NAO-Messe", failure: "NAOqi weg" },
        conversation_state: "speaking",
        transcript: [],
      }),
    )
    const view = viewOf(state)
    expect(view.conversationState).toBe("idle")
    expect(view.conversationLabel).toBe("Schläft")
    expect(view.transcript).toEqual([])
    expect(view.hardwareEnabled).toBe(false)
    expect(view.robotName).toBeNull()
    expect(view.failure).toBe("NAOqi weg")
    expect(view.triggers.every((row) => row.pressed === false)).toBe(true)
  })
})

describe("address field", () => {
  const remembered: AddressField = { value: "10.0.0.8", dirty: false, remembered: "10.0.0.8" }

  it("fills from the picture and remembers that address", () => {
    const next = addressFromPicture({ value: "", dirty: false, remembered: null }, "10.1.2.3")
    expect(next).toEqual({ value: "10.1.2.3", dirty: false, remembered: "10.1.2.3" })
  })

  it("keeps a typed draft until a picture still carrying an address replaces it", () => {
    const typed = addressEdited(remembered, "10.9.9.9")
    expect(typed.dirty).toBe(true)
    expect(typed.remembered).toBe("10.0.0.8")
    const kept = addressFromPicture(typed, null)
    expect(kept.value).toBe("10.9.9.9")
    const filled = addressFromPicture(typed, "10.0.0.8")
    expect(filled.value).toBe("10.0.0.8")
    expect(filled.dirty).toBe(false)
  })

  it("clears the remembered address when the field is cleared", () => {
    const cleared = addressEdited(remembered, "")
    expect(cleared).toEqual({ value: "", dirty: true, remembered: null })
    expect(addressFromPicture(cleared, null).value).toBe("")
  })
})
