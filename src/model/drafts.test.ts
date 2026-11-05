import { describe, expect, it } from "vitest"
import { acceptAppliedDraft, sameJson } from "./drafts"

const clientLine = { id: "x", text: "Erster Satz", speaker: "nao" as const, delivery: "plain" as const, motion: null }
const serverLine = { speaker: "nao" as const, id: "x", text: "Erster Satz", delivery: "plain" as const, motion: null }

describe("sameJson", () => {
  it("treats a saved dialog line as the same draft when only the field order differs", () => {
    expect(sameJson([clientLine], [serverLine])).toBe(true)
    expect(sameJson([clientLine], [{ ...serverLine, text: "Zweiter Satz" }])).toBe(false)
  })
})

describe("acceptAppliedDraft", () => {
  const sent = {
    dialogs: [{ id: "d", name: " Dialog 1 ", wrap: true, idle_reset_secs: null, lines: [clientLine] }],
    active_dialog_id: "d",
  }
  const applied = {
    dialogs: [{ id: "d", name: "Dialog 1", wrap: true, idle_reset_secs: null, lines: [serverLine] }],
    active_dialog_id: "d",
  }

  it("adopts the stored dialog, including a trimmed name and server field order", () => {
    expect(acceptAppliedDraft(sent, sent, applied)).toEqual(applied)
  })

  it("keeps a line edited while Übernehmen was still in flight", () => {
    const current = {
      ...sent,
      dialogs: [{ ...sent.dialogs[0]!, lines: [{ ...clientLine, text: "Noch neuer" }] }],
    }
    expect(acceptAppliedDraft(current, sent, applied).dialogs[0]?.lines[0]?.text).toBe("Noch neuer")
  })

  it("leaves the draft in place when the stored dialog is not the one that was sent", () => {
    const stale = {
      ...applied,
      dialogs: [{ ...applied.dialogs[0]!, lines: [{ ...serverLine, text: "Alt" }] }],
    }
    expect(acceptAppliedDraft(sent, sent, stale).dialogs).toEqual(sent.dialogs)
  })
})
