import { interactionsDraftFrom, llmDraftFrom } from "./drafts"
import type { InteractionsDraft, LlmDraft } from "./drafts"
import type { Applied, Dialog, TriggerBinding } from "./types"

export interface Scenario extends LlmDraft {
  id: string
  name: string
  description: string
  triggers: Record<string, TriggerBinding>
  dialogs?: Dialog[]
  active_dialog_id?: string | null
  autostart_enabled?: boolean
}

export function combinationFrom(llm: LlmDraft, interactions: InteractionsDraft): Omit<Scenario, "id" | "name" | "description"> {
  return { ...llm, knowledge_ids: [...llm.knowledge_ids], tts_replacements: llm.tts_replacements.map((entry) => ({ ...entry })), stt_vocabulary: llm.stt_vocabulary.map((entry) => ({ ...entry })), triggers: cloneData(interactions.triggers), dialogs: cloneData(interactions.dialogs), active_dialog_id: interactions.active_dialog_id, autostart_enabled: interactions.autostart_enabled !== false }
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function combinationFromApplied(applied: Applied) {
  return combinationFrom(llmDraftFrom(applied), interactionsDraftFrom(applied))
}

export function sameCombination(left: object, right: object): boolean {
  return stable(left) === stable(right)
}

export function mappingCount(triggers: Record<string, TriggerBinding>): number {
  return Object.values(triggers).reduce((count, binding) => count + (["tap", "double_tap", "long_press"] as const).filter((name) => binding[name]?.action).length, 0)
}

export function scenarioBadges(selected: boolean, matchesScenario: boolean, matchesApplied: boolean): string[] {
  if (!selected) return matchesApplied ? [] : ["Nicht übernommen"]
  if (matchesScenario && matchesApplied) return ["Aktiv"]
  if (matchesScenario) return ["Nicht übernommen"]
  if (matchesApplied) return ["Angepasst"]
  return ["Angepasst", "Nicht übernommen"]
}

export function loadWouldLoseEdits(input: { selected: boolean; sectionsMatchSelection: boolean; sectionsMatchApplied: boolean; nameDirty: boolean }): boolean {
  if (input.selected) return !input.sectionsMatchSelection || input.nameDirty
  return !input.sectionsMatchApplied || input.nameDirty
}

function stable(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortKeys((value as Record<string, unknown>)[key])
      return acc
    }, {})
  }
  return value
}
