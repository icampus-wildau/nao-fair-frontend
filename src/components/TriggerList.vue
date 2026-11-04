<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { bindingLabel, compareTriggerIds, type GestureId, type TriggerId } from '../model/triggers'
import type { GestureRowView, TriggerRowView } from '../model/screen'
import type { TriggerBinding } from '../model/types'
import { useConsole } from '../stores/console'
const props = defineProps<{ rows: TriggerRowView[]; selectable?: boolean; selected?: { id: TriggerId; gesture: GestureId } | null; bindings?: Partial<Record<TriggerId, TriggerBinding>>; dashboard?: boolean }>()
const store = useConsole()
const router = useRouter()
const sortedRows = computed(() => [...props.rows].sort((a, b) => compareTriggerIds(a.id, b.id)))
const emit = defineEmits<{ select: [{ id: TriggerId; gesture: GestureId }]; enable: [TriggerId, GestureId, boolean] }>()
function chosen(row: TriggerRowView, gesture: GestureId) {
  return props.selected?.id === row.id && props.selected.gesture === gesture
}

function gestures(row: TriggerRowView): GestureRowView[] {
  const source = props.bindings?.[row.id]
  const rows = source
    ? row.gestures.map((gesture) => ({ ...gesture, action: source[gesture.id]?.action ?? null, motion: source[gesture.id]?.motion ?? null, enabled: source[gesture.id]?.enabled !== false, phrase: source[gesture.id]?.phrase ?? "" }))
    : row.gestures
  return props.dashboard ? rows.filter((gesture) => gesture.enabled && gesture.action) : rows
}
const PHRASE_EMPTY = 'Kein Text eingetragen.'
function spokenPhrase(gesture: GestureRowView) {
  return gesture.phrase.trim()
}
function spokenText(gesture: GestureRowView) {
  return spokenPhrase(gesture) || PHRASE_EMPTY
}
function spokenPreview(gesture: GestureRowView) {
  const phrase = spokenPhrase(gesture)
  return phrase ? `„${phrase}"` : PHRASE_EMPTY
}
function selectGesture(row: TriggerRowView, gesture: GestureId) {
  if (!props.selectable) return
  emit('select', { id: row.id, gesture })
}
function onGestureKeydown(event: KeyboardEvent, row: TriggerRowView, gesture: GestureId) {
  if (!props.selectable || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  selectGesture(row, gesture)
}
function openAssignment(row: TriggerRowView, gesture: GestureId) {
  if (!props.dashboard) return
  void router.push({ path: '/llm', query: { abschnitt: 'interactions', sensor: row.id, geste: gesture } })
}
function playGesture(row: TriggerRowView, gesture: GestureRowView) {
  if (!store.view.hardwareEnabled || !gesture.action) return
  void store.testGesture(row.id, gesture.id, { action: gesture.action, motion: gesture.motion, phrase: gesture.phrase })
}
</script>
<template>
  <div class="trigger-list" :class="{ 'is-overview': dashboard }">
    <div v-for="row in sortedRows" :key="row.id" class="sensor sensor-group" :data-trigger="row.id" :data-pressed="row.pressed ? 'true' : 'false'">
      <span v-if="row.pressed" :key="row.pressNonce" class="sensor-flash" aria-hidden="true"></span>
      <div class="sensor-body">
        <span class="sensor-head">{{ row.label }}</span>
        <div
          v-for="gesture in gestures(row)"
          :key="gesture.id"
          class="gesture"
          :class="{ 'is-selected': selectable && chosen(row, gesture.id) }"
          :data-gesture="gesture.id"
          :role="selectable ? 'button' : undefined"
          :tabindex="selectable ? 0 : undefined"
          :aria-pressed="selectable ? chosen(row, gesture.id) : undefined"
          @click="selectGesture(row, gesture.id)"
          @keydown="onGestureKeydown($event, row, gesture.id)"
        >
          <label v-if="bindings" class="toggle" @click.stop>
            <input type="checkbox" :checked="gesture.enabled" :aria-label="`${row.label} ${gesture.label} aktiv`" @change="emit('enable', row.id, gesture.id, ($event.target as HTMLInputElement).checked)" />
            <span class="toggle-ui" aria-hidden="true"></span>
          </label>
          <div v-if="selectable" class="sensor-choice">
            <span class="sensor-name">{{ gesture.label }}</span>
            <span v-if="gesture.action !== 'speak'" class="sensor-action">{{ bindingLabel(gesture.action, gesture.motion) }}</span>
          </div>
          <template v-else>
            <span class="sensor-name">{{ gesture.label }}</span>
            <span v-if="gesture.action !== 'speak'" class="sensor-action" :title="dashboard ? 'Zuordnung in Interaktionen bearbeiten' : undefined" @dblclick.stop="openAssignment(row, gesture.id)">{{ bindingLabel(gesture.action, gesture.motion) }}</span>
          </template>
          <UTooltip v-if="gesture.action === 'speak'" :text="spokenText(gesture)" :delay-duration="600" :content="{ side: 'top' }">
            <span class="sensor-phrase" :class="{ 'has-phrase': !!spokenPhrase(gesture) }" :aria-label="`Wortlaut für ${row.label}`" :title="dashboard ? 'Zuordnung in Interaktionen bearbeiten' : undefined" @dblclick.stop="openAssignment(row, gesture.id)">{{ spokenPreview(gesture) }}</span>
          </UTooltip>
          <button v-if="gesture.action" type="button" class="gesture-play" data-hardware="test" :aria-label="`${row.label}, ${gesture.label} abspielen`" :title="store.view.hardwareEnabled ? `${gesture.label} abspielen` : 'Kein Roboter verbunden.'" :disabled="!store.view.hardwareEnabled" @click.stop="playGesture(row, gesture)" @keydown.stop>
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
