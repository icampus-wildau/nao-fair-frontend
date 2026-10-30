<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { alphabetical } from '../model/operator'
import { ttsErrors } from '../model/drafts'
import { useConsole } from '../stores/console'
import InfoTip from './InfoTip.vue'
const store = useConsole()
const search = ref('')
const order = ref('name')
const frozenOrder = ref<number[] | null>(null)
const rowIds = new WeakMap<object, number>()
let nextRowId = 0
function identity(row: object) { const key = toRaw(row); if (!rowIds.has(key)) rowIds.set(key, ++nextRowId); return rowIds.get(key)! }
const entries = computed(() => (store.llmDraft?.tts_replacements ?? []).map((row, index) => ({ ...row, index, uiId: identity(row) })))
const visible = computed(() => (frozenOrder.value ? [...entries.value].sort((a, b) => frozenOrder.value!.indexOf(a.uiId) - frozenOrder.value!.indexOf(b.uiId)) : order.value === 'name' ? alphabetical(entries.value, row => row.source) : entries.value).filter(row => `${row.source} ${row.replacement}`.toLocaleLowerCase('de').includes(search.value.toLocaleLowerCase('de'))))
function focusIn() { if (!frozenOrder.value) frozenOrder.value = visible.value.map(row => row.uiId) }
function focusOut(event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) frozenOrder.value = null }
const problem = computed(() => ttsErrors(store.llmDraft?.tts_replacements ?? []))
function patch(index: number, change: Partial<{ source: string; replacement: string; enabled: boolean }>) {
  if (!store.llmDraft) return
  store.patchLlm({ tts_replacements: store.llmDraft.tts_replacements.map((row, i) => {
    if (i !== index) return row
    const next = { ...row, ...change }
    rowIds.set(next, identity(row))
    return next
  }) })
}
function add() { if (store.llmDraft) store.patchLlm({ tts_replacements: [...store.llmDraft.tts_replacements, { source: '', replacement: '', enabled: true }] }) }
function remove(index: number) { if (store.llmDraft) store.patchLlm({ tts_replacements: store.llmDraft.tts_replacements.filter((_, i) => i !== index) }) }
function move(index: number, direction: number) { if (!store.llmDraft) return; const next = [...store.llmDraft.tts_replacements]; const target = Math.min(next.length - 1, Math.max(0, index + direction)); const [row] = next.splice(index, 1); if (row) next.splice(target, 0, row); store.patchLlm({ tts_replacements: next }) }
</script>
<template><div class="list-toolbar"><input v-model="search" class="search" type="search" aria-label="Ersetzungen suchen" placeholder="Ersetzungen suchen" /><select v-model="order" class="inline-select" aria-label="Regeln sortieren"><option value="name">Alphabetisch</option><option value="priority">Ausführungspriorität</option></select><button type="button" class="btn" @click="add">Zeile hinzufügen</button><InfoTip text="Die alphabetische Ansicht ändert die Ausführung nicht. Niedrige Prioritätsnummern werden zuerst ausgeführt. Mit den Pfeilen lässt sich die Priorität ändern." label="Regelpriorität erklären" /></div>
  <p v-if="problem" class="why" role="alert">{{ problem }}</p>
  <div class="tts-header help"><span>Priorität</span><span>Quelle</span><span>Ersetzung</span><span>Aktiv</span><span></span></div>
  <div class="studio-list" @focusin="focusIn" @focusout="focusOut"><div v-for="row in visible" :key="row.uiId" class="studio-list-row replacement-row"><span class="num">{{ row.index + 1 }}</span><input type="text" class="inline-input" :value="row.source" aria-label="Quelle" @change="patch(row.index, { source: ($event.target as HTMLInputElement).value })" /><input type="text" class="inline-input" :value="row.replacement" aria-label="Ersetzung" @change="patch(row.index, { replacement: ($event.target as HTMLInputElement).value })" /><input type="checkbox" :checked="row.enabled" aria-label="Aktiv" @change="patch(row.index, { enabled: ($event.target as HTMLInputElement).checked })" /><div class="row-actions"><button type="button" class="btn" :disabled="row.index === 0" aria-label="Regel nach oben" @click="move(row.index, -1)">↑</button><button type="button" class="btn" :disabled="row.index === entries.length - 1" aria-label="Regel nach unten" @click="move(row.index, 1)">↓</button><button type="button" class="btn-danger" @click="remove(row.index)">Löschen</button></div></div>
  </div>
</template>
