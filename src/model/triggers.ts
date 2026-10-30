export const TRIGGER_IDS = [
  "front_head",
  "middle_head",
  "rear_head",
  "left_hand",
  "right_hand",
  "left_bumper",
  "right_bumper",
] as const

export type TriggerId = (typeof TRIGGER_IDS)[number]

export const TRIGGER_LABELS: Record<TriggerId, string> = {
  front_head: "Kopf vorne",
  middle_head: "Kopf Mitte",
  rear_head: "Kopf hinten",
  left_hand: "Handrücken links",
  right_hand: "Handrücken rechts",
  left_bumper: "Fußtaster links",
  right_bumper: "Fußtaster rechts",
}

export const ACTION_LABELS: Record<string, string> = {
  toggle_conversation: "Gespräch umschalten",
  stop_and_clear: "Gespräch beenden und Kontext löschen",
  start_conversation: "Gespräch starten",
  stop_conversation: "Gespräch beenden",
  stop_speech: "Sprechen stoppen",
  speak: "Text sprechen",
  wave: "Winken",
  nod: "Nicken",
  shake: "Kopf schütteln",
  motion: "Bewegung",
  stop_motion: "Bewegung stoppen",
}

export const ACTION_OPTIONS: { id: string | null; label: string }[] = [
  { id: null, label: "Keine Aktion" },
  { id: "toggle_conversation", label: ACTION_LABELS.toggle_conversation },
  { id: "stop_and_clear", label: ACTION_LABELS.stop_and_clear },
  { id: "start_conversation", label: ACTION_LABELS.start_conversation },
  { id: "stop_conversation", label: ACTION_LABELS.stop_conversation },
  { id: "stop_speech", label: ACTION_LABELS.stop_speech },
  { id: "speak", label: ACTION_LABELS.speak },
  { id: "motion", label: ACTION_LABELS.motion },
  { id: "stop_motion", label: ACTION_LABELS.stop_motion },
]

export const MOTIONS: { id: string; label: string }[] = [
  { id: "wave_left", label: "Winken links" },
  { id: "wave_right", label: "Winken rechts" },
  { id: "nod", label: "Nicken" },
  { id: "shake", label: "Kopf schütteln" },
  { id: "sit", label: "Hinsetzen" },
  { id: "stand", label: "Aufstehen" },
]

ACTION_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, "de"))
MOTIONS.sort((a, b) => a.label.localeCompare(b.label, "de"))

export function isTriggerId(value: string): value is TriggerId {
  return (TRIGGER_IDS as readonly string[]).includes(value)
}

export function actionLabel(action: string | null | undefined): string {
  if (!action) return "Keine Aktion"
  return ACTION_LABELS[action] ?? action
}

export function bindingLabel(action: string | null | undefined, motion: string | null | undefined): string {
  if (action === "motion" || action === "wave") {
    return MOTIONS.find((item) => item.id === motion)?.label ?? actionLabel(action)
  }
  return actionLabel(action)
}
