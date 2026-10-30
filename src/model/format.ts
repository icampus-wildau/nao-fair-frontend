import type { Speaker } from "./types"

export function formatStamp(timestamp: string): string {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return timestamp
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(parsed)
}

export function speakerLabel(speaker: Speaker): string {
  return speaker === "visitor" ? "Besucher" : "NAO"
}

export function clockLabel(date: Date): string {
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(date)
  const day = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" }).format(date)
  return `${time} · ${day}`
}
