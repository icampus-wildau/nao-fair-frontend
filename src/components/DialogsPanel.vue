<script setup lang="ts">
import { computed, ref } from "vue"
import { LINE_MOTIONS } from "../model/triggers"
import type { Dialog, DialogDelivery, DialogLine } from "../model/types"
import { useConsole } from "../stores/console"
import LineSideButton from "./LineSideButton.vue"

const store = useConsole()
const selected = ref<string | null>(null)
const listOpen = ref(false)
const dragged = ref<string | null>(null)
const dropTarget = ref<string | null>(null)
const dropAfter = ref(false)
const deleted = ref<{ dialogId: string; line: DialogLine; index: number } | null>(null)
const announcement = ref("")
const testingLine = ref<string | null>(null)
const draft = computed(() => store.interactionDraft)
const dialogs = computed(() => draft.value?.dialogs ?? [])
const activeId = computed(() => draft.value?.active_dialog_id ?? null)
const rows = computed(() => {
  const active = dialogs.value.find((dialog) => dialog.id === activeId.value)
  const rest = dialogs.value.filter((dialog) => dialog.id !== activeId.value)
  return active ? [active, ...rest] : dialogs.value
})
const current = computed(() => dialogs.value.find((dialog) => dialog.id === (selected.value ?? activeId.value ?? dialogs.value[0]?.id)) ?? null)

function replace(next: Dialog[]) {
  store.setDialogs(next, draft.value?.active_dialog_id ?? null)
}
function update(dialog: Dialog) {
  replace(dialogs.value.map((item) => item.id === dialog.id ? dialog : item))
}
function createDialog() {
  const names = new Set(dialogs.value.map((dialog) => dialog.name))
  let index = dialogs.value.length + 1
  let name = `Dialog ${index}`
  while (names.has(name)) name = `Dialog ${++index}`
  const dialog: Dialog = { id: crypto.randomUUID(), name, wrap: true, idle_reset_secs: null, lines: [] }
  const active = draft.value?.active_dialog_id ?? dialog.id
  store.setDialogs([...dialogs.value, dialog], active)
  selected.value = dialog.id
}
function rename(name: string) {
  if (!current.value) return
  update({ ...current.value, name })
}
function removeDialog(dialog: Dialog) {
  if (!draft.value || dialog.id === draft.value.active_dialog_id) return
  if (deleted.value?.dialogId === dialog.id) deleted.value = null
  const next = dialogs.value.filter((item) => item.id !== dialog.id)
  const showing = selected.value ?? draft.value.active_dialog_id ?? dialogs.value[0]?.id
  store.setDialogs(next, draft.value.active_dialog_id)
  if (showing === dialog.id) selected.value = next.find((item) => item.id === draft.value?.active_dialog_id)?.id ?? next[0]?.id ?? null
}
function activate(dialog: Dialog) {
  selected.value = dialog.id
  store.setDialogs(dialogs.value, dialog.id)
}
function clearActive() {
  store.setDialogs(dialogs.value, null)
}
function setLines(lines: DialogLine[]) {
  if (!current.value) return
  update({ ...current.value, lines })
}
function addLine(after?: string) {
  if (!current.value) return
  const line: DialogLine = { id: crypto.randomUUID(), text: "", speaker: "nao", delivery: "plain", motion: null }
  if (!after) {
    setLines([...current.value.lines, line])
    return
  }
  const index = current.value.lines.findIndex((item) => item.id === after)
  const lines = [...current.value.lines]
  lines.splice(index + 1, 0, line)
  setLines(lines)
}
function patchLine(id: string, patch: Partial<DialogLine>) {
  if (!current.value) return
  setLines(current.value.lines.map((line) => {
    if (line.id !== id) return line
    const next = { ...line, ...patch }
    if (patch.delivery && patch.delivery !== "motion") next.motion = null
    if (next.delivery === "motion" && !next.motion) next.motion = "nod"
    return next
  }))
}
function moveLine(id: string, direction: -1 | 1) {
  if (!current.value) return
  const lines = [...current.value.lines]
  const index = lines.findIndex((line) => line.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= lines.length) return
  const [line] = lines.splice(index, 1)
  lines.splice(target, 0, line!)
  setLines(lines)
  announcement.value = `Zeile an Position ${target + 1} verschoben.`
}
async function testLine(line: DialogLine) {
  if (!store.view.hardwareEnabled || !line.text.trim() || testingLine.value) return
  testingLine.value = line.id
  try {
    await store.speak(line.text)
  } finally {
    testingLine.value = null
  }
}
function removeLine(line: DialogLine, index: number) {
  if (!current.value) return
  deleted.value = { dialogId: current.value.id, line, index }
  setLines(current.value.lines.filter((item) => item.id !== line.id))
  announcement.value = `Zeile ${index + 1} gelöscht.`
}
function undoDelete() {
  const saved = deleted.value
  const dialog = dialogs.value.find((item) => item.id === saved?.dialogId)
  if (!saved || !dialog) return
  const lines = [...dialog.lines]
  lines.splice(Math.min(saved.index, lines.length), 0, saved.line)
  update({ ...dialog, lines })
  selected.value = dialog.id
  deleted.value = null
  announcement.value = "Zeile wiederhergestellt."
}
function dragStart(event: DragEvent, id: string) {
  dragged.value = id
  event.dataTransfer?.setData("text/plain", id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
}
function dragOver(event: DragEvent, id: string) {
  dropTarget.value = id
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropAfter.value = event.clientY >= rect.top + rect.height / 2
}
function dropLine(targetId: string) {
  if (!current.value || !dragged.value || dragged.value === targetId) return
  const lines = [...current.value.lines]
  const from = lines.findIndex((line) => line.id === dragged.value)
  const to = lines.findIndex((line) => line.id === targetId)
  if (from < 0 || to < 0) return
  const [line] = lines.splice(from, 1)
  const destination = to - (from < to ? 1 : 0) + (dropAfter.value ? 1 : 0)
  lines.splice(destination, 0, line!)
  setLines(lines)
  announcement.value = `Zeile an Position ${destination + 1} verschoben.`
  dragged.value = null
  dropTarget.value = null
}
function selectDialog(id: string) {
  selected.value = id
  listOpen.value = false
}
function minutes(dialog: Dialog) {
  return dialog.idle_reset_secs == null ? 5 : dialog.idle_reset_secs / 60
}
</script>

<template>
  <article class="panel studio-main dialog-list" :class="{ 'list-open': listOpen }">
    <p v-if="!draft" class="why">Die Dialoge erscheinen, sobald der Server eine Konfiguration schickt.</p>
    <template v-else>
      <div class="panel-head with-action">
        <h2>Dialoge</h2>
        <button v-if="current" type="button" class="btn dialog-list-toggle" @click="listOpen = false">Zurück zum Editor</button>
        <button type="button" class="btn" @click="createDialog(); listOpen = false">Neuer Dialog</button>
      </div>
      <p v-if="!dialogs.length" class="empty">Noch kein Dialog.</p>
      <div v-for="dialog in rows" :key="dialog.id" class="dialog-row" :class="{ 'is-selected': current?.id === dialog.id }">
        <button type="button" class="sensor-choice" :aria-pressed="current?.id === dialog.id" @click="selectDialog(dialog.id)">
          <span class="sensor-name">{{ dialog.name }}</span>
          <span v-if="dialog.id === activeId" class="dialog-active">Aktiv</span>
        </button>
      </div>
    </template>
  </article>
  <aside v-if="draft && current" class="panel studio-main dialog-config" aria-label="Dialog bearbeiten" :class="{ 'list-open': listOpen }">
    <button type="button" class="btn dialog-list-toggle" :aria-expanded="listOpen" @click="listOpen = !listOpen">{{ listOpen ? 'Dialogliste schließen' : 'Dialoge anzeigen' }}</button>
    <div class="dialog-config-head">
      <div class="dialog-config-title">
        <input class="dialog-name-input" :value="current.name" aria-label="Dialogname" placeholder="Dialog bearbeiten" @input="rename(($event.target as HTMLInputElement).value)" />
        <span v-if="current.id === activeId" class="dialog-active">Aktiv</span>
      </div>
      <button v-if="current.id !== activeId" type="button" class="btn" @click="activate(current)">Als aktiv setzen</button>
      <button v-else type="button" class="btn" @click="clearActive()">Aktivierung aufheben</button>
      <button type="button" class="btn-danger icon-btn" :disabled="current.id === activeId" :aria-label="`${current.name} löschen`" :title="current.id === activeId ? 'Aktiven Dialog zuerst ablösen' : 'Dialog löschen'" @click="removeDialog(current)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" /></svg>
      </button>
    </div>
    <details class="dialog-settings">
      <summary>Einstellungen <span class="help">{{ current.wrap ? 'Wiederholt' : 'Stoppt am Ende' }} · {{ current.idle_reset_secs == null ? 'Kein Reset' : `Reset nach ${minutes(current)} Min.` }}</span></summary>
      <label class="toggle setting-toggle"><input type="checkbox" :checked="current.wrap" @change="update({ ...current, wrap: ($event.target as HTMLInputElement).checked })" /><span class="toggle-ui" aria-hidden="true"></span><span>Am Ende von vorn</span></label>
      <label class="toggle setting-toggle"><input type="checkbox" :checked="current.idle_reset_secs != null" @change="update({ ...current, idle_reset_secs: ($event.target as HTMLInputElement).checked ? 300 : null })" /><span class="toggle-ui" aria-hidden="true"></span><span>Nach Inaktivität zurücksetzen</span></label>
      <label v-if="current.idle_reset_secs != null" class="field timeout-field"><span>Nach wie vielen Minuten?</span><input type="number" min="1" step="1" aria-label="Timeout" :value="minutes(current)" @input="update({ ...current, idle_reset_secs: Number(($event.target as HTMLInputElement).value) * 60 })" /></label>
    </details>
    <p class="dialog-speaker-help help">Menschliche Beiträge dienen der Planung und werden von NAO nicht gesprochen.</p>
    <div class="panel-head with-action dialog-lines-head"><h2>Zeilen <span class="help">{{ current.lines.length }}</span></h2><button type="button" class="btn" @click="addLine()">Zeile hinzufügen</button></div>
    <div v-if="deleted" class="dialog-undo" role="status">Zeile gelöscht. <button type="button" class="btn-quiet" @click="undoDelete">Rückgängig</button></div>
    <span class="sr-only" aria-live="polite">{{ announcement }}</span>
    <p v-if="!current.lines.length" class="empty">Noch keine Zeile. Fügen Sie die erste Zeile hinzu.</p>
    <div v-for="(line, index) in current.lines" :key="line.id" class="dialog-line" :class="{ 'is-human': line.speaker === 'human', 'is-nao': line.speaker !== 'human', 'is-drop-target': dropTarget === line.id && !dropAfter, 'is-drop-after': dropTarget === line.id && dropAfter, 'is-dragging': dragged === line.id }" @dragover.prevent="dragOver($event, line.id)" @dragleave="dropTarget = null" @drop.prevent="dropLine(line.id)">
      <span class="dialog-drag" draggable="true" title="Zeile ziehen, um sie zu verschieben" aria-hidden="true" @dragstart="dragStart($event, line.id)" @dragend="dragged = null; dropTarget = null">⠿</span>
      <span class="dialog-index">{{ index + 1 }}</span>
      <LineSideButton :index="index + 1" :speaker="line.speaker" @change="patchLine(line.id, { speaker: $event })" />
      <textarea class="dialog-text" rows="1" :value="line.text" :aria-label="`Zeile ${index + 1}`" placeholder="Text eingeben" @input="patchLine(line.id, { text: ($event.target as HTMLTextAreaElement).value })"></textarea>
      <div v-if="(line.speaker ?? 'nao') === 'nao'" class="dialog-delivery">
        <select class="inline-select" :aria-label="`Wiedergabe für Zeile ${index + 1}`" :value="line.delivery" @change="patchLine(line.id, { delivery: ($event.target as HTMLSelectElement).value as DialogDelivery })"><option value="plain">Nur sprechen</option><option value="motion">Mit Bewegung</option><option value="animated">Animiertes Sprechen</option></select>
        <select v-if="line.delivery === 'motion'" class="inline-select" :aria-label="`Bewegung für Zeile ${index + 1}`" :value="line.motion || 'nod'" @change="patchLine(line.id, { motion: ($event.target as HTMLSelectElement).value })"><option v-for="motion in LINE_MOTIONS" :key="motion.id" :value="motion.id">{{ motion.label }}</option></select>
      </div>
      <span v-else class="dialog-human-note">Nur zur Planung</span>
      <div class="dialog-line-actions">
        <button v-if="line.speaker !== 'human'" type="button" class="btn icon-btn" :aria-label="`Text von Zeile ${index + 1} testen`" :title="!store.view.hardwareEnabled ? 'Roboter verbinden, um den Text zu testen' : !line.text.trim() ? 'Zuerst Text eingeben' : 'Text sprechen (ohne Bewegung)'" :disabled="!store.view.hardwareEnabled || !line.text.trim() || testingLine !== null" @click="testLine(line)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg></button>
        <span v-else class="dialog-test-slot" aria-hidden="true"></span>
        <button type="button" class="btn icon-btn" :aria-label="`Zeile unter ${index + 1} einfügen`" title="Darunter einfügen" @click="addLine(line.id)">＋</button>
        <button type="button" class="btn-danger icon-btn" :aria-label="`Zeile ${index + 1} löschen`" title="Zeile löschen" @click="removeLine(line, index)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" /></svg></button>
        <details class="dialog-move"><summary :aria-label="`Zeile ${index + 1} verschieben`" title="Zeile verschieben">⋯</summary><div><button type="button" :disabled="index === 0" @click="moveLine(line.id, -1)">Nach oben</button><button type="button" :disabled="index === current.lines.length - 1" @click="moveLine(line.id, 1)">Nach unten</button></div></details>
      </div>
    </div>
  </aside>
</template>
