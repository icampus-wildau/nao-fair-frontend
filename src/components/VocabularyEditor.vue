<script setup lang="ts">
import { computed, ref } from 'vue'
import { alphabetical } from '../model/operator'
import { useConsole } from '../stores/console'
import InfoTip from './InfoTip.vue'
const store = useConsole()
const term = ref('')
const search = ref('')
const onlyActive = ref(false)
const importOpen = ref(false)
const importText = ref('')
const frozenOrder = ref<number[] | null>(null)
const terms = computed(() => (frozenOrder.value ? (store.llmDraft?.stt_vocabulary ?? []).map((entry, index) => ({ ...entry, index })).sort((a, b) => frozenOrder.value!.indexOf(a.index) - frozenOrder.value!.indexOf(b.index)) : alphabetical((store.llmDraft?.stt_vocabulary ?? []).map((entry, index) => ({ ...entry, index })), row => row.term)).filter(row => (!onlyActive.value || row.enabled) && row.term.toLocaleLowerCase('de').includes(search.value.toLocaleLowerCase('de'))))
function focusIn() { if (!frozenOrder.value) frozenOrder.value = terms.value.map(row => row.index) }
function focusOut(event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) frozenOrder.value = null }
function patch(index: number, patch: Partial<{ term: string; enabled: boolean }>) { if (store.llmDraft) store.patchLlm({ stt_vocabulary: store.llmDraft.stt_vocabulary.map((row, i) => i === index ? { ...row, ...patch } : row) }) }
function remove(index: number) { if (store.llmDraft) store.patchLlm({ stt_vocabulary: store.llmDraft.stt_vocabulary.filter((_, i) => i !== index) }) }
function add() { const value = term.value.trim(); if (!value || !store.llmDraft) return; if (store.llmDraft.stt_vocabulary.some(row => row.term.toLocaleLowerCase('de') === value.toLocaleLowerCase('de'))) { store.feedback = { ok: false, text: `„${value}“ ist schon vorhanden.` }; return }; store.patchLlm({ stt_vocabulary: [...store.llmDraft.stt_vocabulary, { term: value, enabled: true }] }); term.value = '' }
const imported = computed(() => {
  const existing = new Set((store.llmDraft?.stt_vocabulary ?? []).map(row => row.term.toLocaleLowerCase('de')))
  const accepted: string[] = [], duplicates: string[] = []
  for (const value of importText.value.split(/[\n\r,;\t]+/u).map(value => value.trim().replace(/^"|"$/gu, '')).filter(Boolean)) {
    const key = value.toLocaleLowerCase('de'); if (existing.has(key)) duplicates.push(value); else { existing.add(key); accepted.push(value) }
  }
  return { accepted: alphabetical(accepted, value => value), duplicates }
})
function importTerms() { if (!store.llmDraft) return; store.patchLlm({ stt_vocabulary: [...store.llmDraft.stt_vocabulary, ...imported.value.accepted.map(term => ({ term, enabled: true }))] }); importOpen.value = false; importText.value = '' }
async function readFile(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (file) importText.value = await file.text() }
</script>
<template><div class="list-toolbar"><input v-model="search" type="search" class="search" aria-label="Vokabular suchen" placeholder="Begriffe suchen" /><label class="compact-check"><input v-model="onlyActive" type="checkbox" />Nur aktive</label><button type="button" class="btn" @click="importOpen = !importOpen">Begriffe importieren</button></div>
  <form class="term-form" @submit.prevent="add"><input v-model="term" class="inline-input" type="text" aria-label="Neuer Begriff" placeholder="Neuer Begriff" /><button type="submit" class="btn" :disabled="!term.trim()">Hinzufügen</button></form>
  <div v-if="importOpen" class="import-panel"><label class="field"><span>Begriffe einfügen</span><textarea v-model="importText" rows="5" placeholder="Ein Begriff pro Zeile, oder mit Komma/Semikolon getrennt"></textarea></label><input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" aria-label="Vokabulardatei" @change="readFile" /><p class="why">{{ imported.accepted.length }} neue Begriffe · {{ imported.duplicates.length }} Dubletten werden ausgelassen</p><InfoTip v-if="imported.duplicates.length" :text="imported.duplicates.join(', ')" label="Dubletten anzeigen" /><div class="actions"><button type="button" class="btn" @click="importOpen = false">Abbrechen</button><button type="button" class="btn-lime" :disabled="!imported.accepted.length" @click="importTerms">{{ imported.accepted.length }} Begriffe hinzufügen</button></div></div>
  <div class="studio-list" @focusin="focusIn" @focusout="focusOut"><div v-for="row in terms" :key="row.index" class="studio-list-row vocabulary-row"><input type="checkbox" :checked="row.enabled" :aria-label="`${row.term} aktiv`" @change="patch(row.index, { enabled: ($event.target as HTMLInputElement).checked })" /><input type="text" class="inline-input" :value="row.term" :aria-label="`Begriff ${row.index + 1}`" @change="patch(row.index, { term: ($event.target as HTMLInputElement).value })" /><button type="button" class="btn-danger" :aria-label="`${row.term} entfernen`" @click="remove(row.index)">Entfernen</button></div></div>
</template>
