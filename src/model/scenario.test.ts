import { describe, expect, it } from "vitest"
import { loadWouldLoseEdits, mappingCount, scenarioBadges } from "./scenario"

describe("scenario badges", () => {
  it("names the relationship of the draft to the scenario and the applied configuration", () => {
    expect(scenarioBadges(true, true, true)).toEqual(["Aktiv"])
    expect(scenarioBadges(true, true, false)).toEqual(["Nicht übernommen"])
    expect(scenarioBadges(true, false, true)).toEqual(["Angepasst"])
    expect(scenarioBadges(true, false, false)).toEqual(["Angepasst", "Nicht übernommen"])
    expect(scenarioBadges(false, false, true)).toEqual([])
    expect(scenarioBadges(false, false, false)).toEqual(["Nicht übernommen"])
  })
})

describe("loading another scenario", () => {
  it("asks only when the combination or the scenario name would be lost", () => {
    expect(loadWouldLoseEdits({ selected: true, sectionsMatchSelection: true, sectionsMatchApplied: true, nameDirty: false })).toBe(false)
    expect(loadWouldLoseEdits({ selected: true, sectionsMatchSelection: false, sectionsMatchApplied: false, nameDirty: false })).toBe(true)
    expect(loadWouldLoseEdits({ selected: true, sectionsMatchSelection: true, sectionsMatchApplied: true, nameDirty: true })).toBe(true)
    expect(loadWouldLoseEdits({ selected: false, sectionsMatchSelection: true, sectionsMatchApplied: true, nameDirty: false })).toBe(false)
    expect(loadWouldLoseEdits({ selected: false, sectionsMatchSelection: false, sectionsMatchApplied: false, nameDirty: false })).toBe(true)
    expect(loadWouldLoseEdits({ selected: false, sectionsMatchSelection: false, sectionsMatchApplied: true, nameDirty: true })).toBe(true)
  })
})

describe("mapping count", () => {
  it("counts triggers that have an action", () => {
    const gesture = { phrase: "", voice: null, motion: null, enabled: true, delivery: "plain" as const, yield_next: true }
    expect(mappingCount({
      head: { tap: { ...gesture, action: "wave" }, double_tap: { ...gesture, action: null }, long_press: { ...gesture, action: "dialog_next" } },
      hand: { tap: { ...gesture, action: null }, double_tap: { ...gesture, action: null }, long_press: { ...gesture, action: null } },
    })).toBe(2)
  })
})
