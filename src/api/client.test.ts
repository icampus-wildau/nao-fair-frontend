import { expect, it } from "vitest"
import { asScenarios } from "./client"

it("keeps saved scenarios with no local context available for loading", () => {
  const scenario = {
    id: "empty-context", name: "Ohne Kontext", llm_model: "test-model",
    system_prompt_id: "prompt", personality_id: "personality", local_context_id: null,
    knowledge_ids: [], tts_replacements: [], stt_vocabulary: [], triggers: {},
  }
  expect(asScenarios([scenario])).toEqual([{ ...scenario, description: "" }])
  expect(asScenarios([{ ...scenario, local_context_id: ["invalid"] }])).toEqual([])
})
