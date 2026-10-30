import { describe, expect, it } from "vitest"
import { presetSelectionLabel } from "./operator"
import type { Preset } from "./types"

const library = [{ id: "pirate", name: "Pirat" }, { id: "fair", name: "Messe" }]

function preset(kind: Preset["kind"], payload: Record<string, unknown>, name = "Standard"): Preset {
  return { id: "preset", kind, name, description: "", payload }
}

describe("presetSelectionLabel", () => {
  it("uses the content name a setup preview shows, not the preset title", () => {
    expect(presetSelectionLabel(preset("personality", { content_id: "pirate" }), library)).toBe("Pirat")
    expect(presetSelectionLabel(preset("local_context", { content_id: "fair" }), library)).toBe("Messe")
    expect(presetSelectionLabel(preset("knowledge_bundle", { content_ids: ["pirate", "fair"] }), library)).toBe("Pirat, Messe")
  })

  it("keeps a short caption for presets that are not a single text", () => {
    expect(presetSelectionLabel(preset("llm", { llm_model: "gpt-test" }), library)).toBe("gpt-test")
    expect(presetSelectionLabel(preset("voice", { tts_language: "de" }), library)).toBe("Standard")
    expect(presetSelectionLabel(preset("stt_vocabulary", { terms: ["NAO"] }), library)).toBe("1 Begriff")
    expect(presetSelectionLabel(null, library)).toBe("—")
  })
})
