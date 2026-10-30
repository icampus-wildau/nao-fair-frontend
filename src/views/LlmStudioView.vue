<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApplyBar from '../components/ApplyBar.vue'
import InfoTip from '../components/InfoTip.vue'
import MarkdownPreview from '../components/MarkdownPreview.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import VocabularyEditor from '../components/VocabularyEditor.vue'
import ReplacementEditor from '../components/ReplacementEditor.vue'
import SpeechComposer from '../components/SpeechComposer.vue'
import LibraryDeleteDialog from '../components/LibraryDeleteDialog.vue'
import { alphabetical, textStats, searchExcerpt } from '../model/operator'
import { localRef } from '../model/local-state'
import { highlightReplacements, llmDraftFrom, previewReplacements, ttsOverlapNotes } from '../model/drafts'
import type { ContentItem, ContentKind } from '../model/types'
import { useConsole } from '../stores/console'

type SectionId = 'system_prompt' | 'knowledge' | 'local_context' | 'personality' | 'tts' | 'stt' | 'model'
const SECTIONS: { id: SectionId; label: string; kind: ContentKind | null }[] = [
  { id: 'system_prompt', label: 'System-Prompt', kind: 'system_prompt' },
  { id: 'knowledge', label: 'Hintergrundwissen', kind: 'knowledge' },
  { id: 'local_context', label: 'Örtlicher Kontext', kind: 'local_context' },
  { id: 'personality', label: 'Persönlichkeit', kind: 'personality' },
  { id: 'tts', label: 'TTS-Ersetzungen', kind: null },
  { id: 'stt', label: 'STT-Vokabular', kind: null },
  { id: 'model', label: 'Modell / Generierung', kind: null },
]
const store = useConsole()
const route = useRoute()
const router = useRouter()
const section = ref<SectionId>('system_prompt')
const editingId = ref<string | null>(null)
const editorOpen = ref(false)
const editorWidth = localRef('studio-editor-width', 440)
const editorMode = localRef('studio-editor-mode', 'source')
const lastSection = localRef<SectionId>('studio-last-section', 'system_prompt')
const views = localRef<Partial<Record<SectionId, { filter: string; sort: string; onlySelected: boolean; scroll: number; editingId: string | null; open: boolean }>>>('studio-views', {})
const main = ref<HTMLElement | null>(null)
function assignScroller(el: unknown, docked: boolean) { if ((section.value === 'tts') === docked) main.value = el instanceof HTMLElement ? el : null }
function rememberIfScroller(event: Event) { if (event.currentTarget === main.value) rememberView() }
function spokenReplacement(phrase: string) { return previewReplacements(phrase, store.llmDraft?.tts_replacements ?? []) }
function replacementParts(phrase: string) { return highlightReplacements(phrase, store.llmDraft?.tts_replacements ?? []) }
const replacementOverlaps = computed(() => ttsOverlapNotes(store.llmDraft?.tts_replacements ?? []))
const sorting = ref('name')
const onlySelected = ref(false)
const deleting = ref<ContentItem | null>(null)
const studio = ref<HTMLElement | null>(null)
const textDrafts = toRef(store, 'textDrafts')
const busy = ref(false)
const filter = ref('')
const baseline = computed(() => store.screen.applied ? llmDraftFrom(store.screen.applied) : null)
const current = computed(() => SECTIONS.find((item) => item.id === section.value)!)
const items = computed(() => store.content.filter((item) => item.kind === current.value.kind))
const visibleItems = computed(() => {
  const needle = filter.value.trim().toLocaleLowerCase('de')
  const rows = items.value.filter(item => (!onlySelected.value || selectedItem(item)) && `${textDrafts.value[item.id]?.name ?? item.name} ${textDrafts.value[item.id]?.markdown ?? item.markdown}`.toLocaleLowerCase('de').includes(needle))
  return sorting.value === 'updated' ? [...rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || a.name.localeCompare(b.name, 'de')) : alphabetical(rows, item => textDrafts.value[item.id]?.name ?? item.name)
})
const editing = computed(() => store.content.find((item) => item.id === editingId.value) ?? null)
const hasEditor = computed(() => Boolean(current.value.kind && editorOpen.value && editing.value))
const dirtyTexts = computed(() => Object.entries(textDrafts.value).filter(([id, draft]) => {
  const saved = store.content.find((item) => item.id === id)
  return saved && (saved.name !== draft.name || saved.markdown !== draft.markdown)
}))
watch(dirtyTexts, (entries) => { store.contentDirty = entries.length > 0 }, { immediate: true, flush: 'sync' })
function fieldValue(key: 'name' | 'markdown') { return editingId.value ? textDrafts.value[editingId.value]?.[key] ?? editing.value?.[key] ?? '' : '' }
function editField(key: 'name' | 'markdown', value: string) {
  if (!editing.value) return
  const id = editing.value.id
  if (!textDrafts.value[id]) textDrafts.value[id] = { name: editing.value.name, markdown: editing.value.markdown }
  textDrafts.value[id]![key] = value
}
const editName = computed({ get: () => fieldValue('name'), set: (value: string) => editField('name', value) })
const editMarkdown = computed({ get: () => fieldValue('markdown'), set: (value: string) => editField('markdown', value) })
function summary(id: SectionId): string {
  const draft = store.llmDraft
  if (!draft) return '—'
  if (id === 'model') return draft.llm_model
  if (id === 'knowledge') return `${draft.knowledge_ids.length} ausgewählt`
  if (id === 'tts') return draft.tts_replacements.length === 1 ? '1 Regel' : `${draft.tts_replacements.length} Regeln`
  if (id === 'stt') return draft.stt_vocabulary.length === 1 ? '1 Begriff' : `${draft.stt_vocabulary.length} Begriffe`
  const selected = id === 'system_prompt' ? draft.system_prompt_id : id === 'local_context' ? draft.local_context_id : draft.personality_id
  const item = store.content.find((entry) => entry.id === selected)
  return (item && (textDrafts.value[item.id]?.name || item.name)) || 'Keine Auswahl'
}
function selectedItem(item: ContentItem) {
  const draft = store.llmDraft
  return section.value === 'system_prompt' ? draft?.system_prompt_id === item.id : section.value === 'local_context' ? draft?.local_context_id === item.id : section.value === 'personality' ? draft?.personality_id === item.id : draft?.knowledge_ids.includes(item.id) ?? false
}
function preferredItem(id: SectionId): ContentItem | null {
  const draft = store.llmDraft
  const selected = id === 'system_prompt' ? draft?.system_prompt_id : id === 'local_context' ? draft?.local_context_id : id === 'personality' ? draft?.personality_id : id === 'knowledge' ? draft?.knowledge_ids[0] : null
  return store.content.find((item) => item.id === selected) ?? null
}
function rememberView() {
  views.value[section.value] = { filter: filter.value, sort: sorting.value, onlySelected: onlySelected.value, scroll: main.value?.scrollTop ?? 0, editingId: editingId.value, open: editorOpen.value }
}
function showSection(id: SectionId) {
  rememberView()
  section.value = id
  lastSection.value = id
  const state = views.value[id]
  filter.value = state?.filter ?? ''
  sorting.value = state?.sort ?? 'name'
  onlySelected.value = state?.onlySelected ?? false
  editingId.value = state?.editingId ?? preferredItem(id)?.id ?? null
  editorOpen.value = state?.open ?? false
  void nextTick(() => { if (main.value) main.value.scrollTop = state?.scroll ?? 0 })
}
function chooseSection(id: SectionId) { if (id !== section.value) showSection(id); void router.replace({ query: { abschnitt: id } }) }
watch(() => route.query.abschnitt, id => { if (typeof id === 'string' && SECTIONS.some(item => item.id === id) && id !== section.value) showSection(id as SectionId) })
onMounted(() => {
  const asked = route.query.abschnitt
  const id = typeof asked === 'string' && SECTIONS.some(item => item.id === asked) ? asked as SectionId : SECTIONS.some(item => item.id === lastSection.value) ? lastSection.value : 'system_prompt'
  // Load remembered state before recording any new state for this visit.
  section.value = id
  const state = views.value[id]
  filter.value = state?.filter ?? ''
  sorting.value = state?.sort ?? 'name'
  onlySelected.value = state?.onlySelected ?? false
  editingId.value = state?.editingId ?? preferredItem(id)?.id ?? null
  editorOpen.value = state?.open ?? false
  void nextTick(() => { if (main.value) main.value.scrollTop = state?.scroll ?? 0 })
  window.addEventListener('keydown', shortcuts)
})
function shortcuts(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); main.value?.querySelector<HTMLInputElement>('input[type=search]')?.focus() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void applyStudio() }
  if (event.altKey && event.key.toLowerCase() === 'e' && editing.value) { event.preventDefault(); openEditor(editing.value) }
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) editorOpen.value = false
}
watch([filter, sorting, onlySelected, editingId, editorOpen], rememberView)
function toggleKnowledge(id: string, checked: boolean) {
  const draft = store.llmDraft
  if (!draft) return
  store.patchLlm({ knowledge_ids: checked ? [...new Set([...draft.knowledge_ids, id])] : draft.knowledge_ids.filter((item) => item !== id) })
}
function selectSingle(id: string) {
  if (section.value === 'system_prompt') store.patchLlm({ system_prompt_id: id })
  if (section.value === 'local_context') store.patchLlm({ local_context_id: id })
  if (section.value === 'personality') store.patchLlm({ personality_id: id })
}
function chooseItem(item: ContentItem) {
  editingId.value = item.id
  if (section.value === 'knowledge') toggleKnowledge(item.id, true)
  else selectSingle(item.id)
}
function openEditor(item: ContentItem) { editingId.value = item.id; editorOpen.value = true }
function stats(item: ContentItem) {
  const { words, tokens } = textStats(textDrafts.value[item.id]?.markdown ?? item.markdown)
  return `${words} ${words === 1 ? 'Wort' : 'Wörter'} · ca. ${tokens} Token`
}
function appliedItem(id: string) { const a = store.screen.applied; return Boolean(a && [a.system_prompt_id, a.local_context_id, a.personality_id, ...a.knowledge_ids].includes(id)) }
async function createItem() {
  if (!current.value.kind) return
  const created = await store.createContent({ kind: current.value.kind, name: 'Neu', markdown: '' })
  if (created) { filter.value = ''; onlySelected.value = false; chooseItem(created); openEditor(created) }
}
async function duplicateItem(item = editing.value) {
  if (!item) return
  const text = textDrafts.value[item.id] ?? item
  const created = await store.createContent({ kind: item.kind, name: `Kopie von ${text.name}`, markdown: text.markdown })
  if (created) openEditor(created)
}
function removeItem(item: ContentItem) { deleting.value = item }
function deletedItem(id: string) {
  delete textDrafts.value[id]
  if (editingId.value === id) { editingId.value = null; editorOpen.value = false }
  const draft = store.llmDraft
  if (!draft) return
  if (draft.knowledge_ids.includes(id)) toggleKnowledge(id, false)
  if (draft.system_prompt_id === id) store.patchLlm({ system_prompt_id: store.screen.applied?.system_prompt_id ?? null })
  if (draft.local_context_id === id) store.patchLlm({ local_context_id: store.screen.applied?.local_context_id ?? null })
  if (draft.personality_id === id) store.patchLlm({ personality_id: store.screen.applied?.personality_id ?? null })
}
const selectedStats = computed(() => {
  const draft = store.llmDraft
  if (!draft) return { words: 0, tokens: 0 }
  const ids = [draft.system_prompt_id, draft.local_context_id, draft.personality_id, ...draft.knowledge_ids]
  return textStats(store.content.filter(item => ids.includes(item.id)).map(item => textDrafts.value[item.id]?.markdown ?? item.markdown).join('\n\n'))
})
const textChanges = computed(() => dirtyTexts.value.map(([id]) => `Text: ${textDrafts.value[id]?.name || store.content.find(item => item.id === id)?.name}`))
async function applyStudio() {
  if (busy.value) return
  const problem = store.validate('llm')
  if (problem) { store.feedback = { ok: false, text: problem }; return }
  if (dirtyTexts.value.some(([, draft]) => !draft.name.trim())) { store.feedback = { ok: false, text: 'Jeder Baustein braucht einen Namen.' }; return }
  busy.value = true
  try {
    for (const [id, draft] of [...dirtyTexts.value]) {
      if (!(await store.saveContent(id, { name: draft.name.trim(), markdown: draft.markdown }))) return
      delete textDrafts.value[id]
    }
    await store.apply('llm')
  } finally { busy.value = false; store.contentDirty = dirtyTexts.value.length > 0 }
}
async function resetStudio() {
  if (busy.value) return
  busy.value = true
  try {
    if (!(await store.resetLlmContent())) return
    for (const id of Object.keys(textDrafts.value)) delete textDrafts.value[id]
    store.resetDraft('llm')
  } finally { busy.value = false }
}
function resize(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  const start = event.clientX
  const width = editorWidth.value
  target.onpointermove = (move) => { editorWidth.value = Math.min(Math.max(300, width + start - move.clientX), Math.max(300, (studio.value?.clientWidth ?? 1200) - 540)) }
  target.onpointerup = target.onpointercancel = () => { target.onpointermove = null }
}
onUnmounted(() => { rememberView(); window.removeEventListener('keydown', shortcuts) })
</script>
<template>
  <section class="studio-view" data-screen="llm">
    <ApplyBar :dirty="store.llmDirty || store.contentDirty || store.llmContentPending" :busy="busy" :can-apply="Boolean(store.screen.applied)" :current="store.llmDraft" :baseline="baseline" :extra-changes="textChanges" :message="store.llmContentPending ? 'Gespeicherte Texte sind noch nicht übernommen.' : undefined" @apply="applyStudio" @reset="resetStudio" />
    <div ref="studio" class="studio" :class="{ 'has-editor': hasEditor }" :style="{ '--editor-width': `${editorWidth}px` }">
      <nav class="subnav" aria-label="Inhalte">
        <button v-for="item in SECTIONS" :key="item.id" type="button" class="tile" :class="{ 'is-on': section === item.id }" :aria-current="section === item.id ? 'true' : undefined" @click="chooseSection(item.id)">
          <strong>{{ item.label }}</strong><small>{{ summary(item.id) }}</small>
        </button>
      </nav>
      <article v-if="!store.llmDraft" class="panel studio-main"><h2>{{ current.label }}</h2><p class="empty">Konfiguration wird geladen …</p></article>
      <article v-else :ref="(el) => assignScroller(el, false)" class="panel studio-main" :class="{ 'has-dock': section === 'tts' }" @scroll.passive="rememberIfScroller">
        <div v-if="section === 'tts'" class="tts-dock">
          <SpeechComposer :utterance="spokenReplacement">
            <template #preview="{ phrase }">
              <div class="replacement-preview">
                <div class="field-caption"><span>Vorschau</span><InfoTip v-if="replacementOverlaps.length" :text="replacementOverlaps.join('\n')" label="Überschneidende Regeln anzeigen" /></div>
                <p class="replacement-result" aria-live="polite"><template v-if="String(phrase).trim()"><template v-for="(part, index) in replacementParts(String(phrase))" :key="index"><mark v-if="part.highlight">{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></template><span v-else class="help">Der ersetzte Text erscheint hier.</span></p>
              </div>
            </template>
          </SpeechComposer>
        </div>
        <div :ref="(el) => assignScroller(el, true)" class="studio-body" @scroll.passive="rememberIfScroller">
        <div class="panel-head section-toolbar">
          <h2>{{ section === 'model' ? 'Modell und Generierung' : current.label }}</h2>
          <InfoTip v-if="section === 'system_prompt'" text="Ein System-Prompt ist immer aktiv. Auswahl und Textänderungen gelten nach Übernehmen." label="System-Prompt erklären" />
          <InfoTip v-if="section === 'knowledge'" text="Mehrere ausgewählte Bausteine werden gemeinsam als Hintergrundwissen verwendet." label="Hintergrundwissen erklären" />
          <InfoTip v-if="section === 'tts'" text="Ersetzt wörtliche Wörter, keine regulären Ausdrücke. Die Ausführungspriorität bleibt unabhängig von der Sortierung erhalten." label="Ersetzungen erklären" />
          <span v-if="current.kind" class="help num">{{ items.length }}</span>
          <div v-if="current.kind" class="toolbar-actions"><button type="button" class="btn" @click="createItem">Baustein hinzufügen</button><button v-if="!hasEditor && editing" type="button" class="btn" @click="openEditor(editing)">Editor öffnen</button></div>
          <InfoTip :text="'Strg/Cmd+K: Suche · Alt+E: Editor öffnen · Escape: einklappen · Strg/Cmd+Enter: übernehmen'" label="Tastaturkürzel anzeigen" />
        </div>
        <p v-if="store.libraryError" class="why" role="alert">{{ store.libraryError }}</p>
        <template v-if="current.kind">
          <div class="list-toolbar"><input v-model="filter" class="search" type="search" aria-label="Bausteine suchen" placeholder="Titel oder Text suchen" /><select v-model="sorting" class="inline-select" aria-label="Bausteine sortieren"><option value="name">Alphabetisch</option><option value="updated">Zuletzt geändert</option></select><label class="compact-check"><input v-model="onlySelected" type="checkbox" />Nur ausgewählte</label><InfoTip :text="`Ausgewählte Promptteile insgesamt: ${selectedStats.words} Wörter · ca. ${selectedStats.tokens} Token. Grobe Schätzung aus der Zeichenanzahl.`" label="Gesamte Promptgröße anzeigen" /></div>
          <p v-if="!visibleItems.length" class="empty">{{ items.length ? 'Keine passenden Bausteine.' : 'Noch kein Baustein.' }}</p>
          <div v-for="item in visibleItems" :key="item.id" class="content-row" :class="{ 'is-selected': selectedItem(item), 'is-editing': hasEditor && editingId === item.id }">
            <input v-if="section === 'knowledge'" type="checkbox" :checked="selectedItem(item)" :aria-label="`${item.name} verwenden`" @change="toggleKnowledge(item.id, ($event.target as HTMLInputElement).checked)" />
            <input v-else type="radio" :name="`content-${section}`" :checked="selectedItem(item)" :aria-label="item.name" @change="selectSingle(item.id)" />
            <button type="button" class="content-choice" :aria-label="textDrafts[item.id]?.name || item.name" :aria-describedby="`stats-${item.id}`" @click="chooseItem(item)" @dblclick="openEditor(item)"><strong>{{ textDrafts[item.id]?.name || item.name }}</strong><small :id="`stats-${item.id}`" class="help num">{{ stats(item) }}<span v-if="dirtyTexts.some(([id]) => id === item.id)"> · geändert</span><span v-if="appliedItem(item.id)" class="mobile-applied"> · übernommen</span></small><small v-if="filter.trim()" class="search-excerpt">{{ searchExcerpt(textDrafts[item.id]?.markdown ?? item.markdown, filter.trim()) }}</small></button>
            <span class="applied-marker" :aria-label="appliedItem(item.id) ? 'Aktuell übernommen' : undefined">{{ appliedItem(item.id) ? 'Übernommen' : '' }}</span>
            <time class="content-date help" :datetime="item.updated_at || undefined">{{ item.updated_at?.slice(0, 10) }}</time>
            <UDropdownMenu :items="[{ label: 'Bearbeiten', onSelect: () => openEditor(item) }, { label: 'Duplizieren', onSelect: () => duplicateItem(item) }, { label: 'Verwendung anzeigen', onSelect: () => removeItem(item) }, { label: appliedItem(item.id) ? 'Löschen (aktuell übernommen)' : 'Löschen', disabled: appliedItem(item.id), onSelect: () => removeItem(item) }]">
              <button type="button" class="item-menu" :aria-label="`Menü für ${item.name}`">⋯</button>
            </UDropdownMenu>
          </div>
        </template>
        <template v-else-if="section === 'model'">
          <div class="settings-form">
            <label class="field"><span>Modell</span><input :value="store.llmDraft.llm_model" type="text" @input="store.patchLlm({ llm_model: ($event.target as HTMLInputElement).value })" /></label>
            <div class="field-caption"><span>Temperatur</span><InfoTip text="Leer verwendet die Voreinstellung des Anbieters. Nicht jedes Modell unterstützt eine Temperatur." label="Temperatur erklären" /></div>
            <label class="field"><input :value="store.llmDraft.temperature ?? ''" aria-label="Temperatur" type="number" min="0" max="2" step="0.1" @input="store.patchLlm({ temperature: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })" /></label>
            <div class="field-caption"><span>Maximale Antwort (Token)</span><InfoTip text="Leer verwendet die Voreinstellung des Anbieters." label="Antwortlänge erklären" /></div>
            <label class="field"><input :value="store.llmDraft.max_tokens ?? ''" aria-label="Maximale Antwort" type="number" min="1" max="128000" step="1" @input="store.patchLlm({ max_tokens: ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value) })" /></label>
          </div>
        </template>
        <ReplacementEditor v-else-if="section === 'tts'" />
        <template v-else-if="section === 'stt'">
          <VocabularyEditor />
          <details class="studio-details"><summary>Gladia-Einstellungen</summary><div class="settings-form">
            <label class="field"><span>Region</span><input :value="store.llmDraft.gladia_region" type="text" @input="store.patchLlm({ gladia_region: ($event.target as HTMLInputElement).value })" /></label>
            <label class="field"><span>Sprache</span><input :value="store.llmDraft.gladia_language" type="text" @input="store.patchLlm({ gladia_language: ($event.target as HTMLInputElement).value })" /></label>
            <div class="field-caption"><span>Endpunktung (s)</span><InfoTip text="Pause, nach der eine Äußerung endet, in Sekunden." label="Endpunktung erklären" /></div>
            <label class="field"><input :value="store.llmDraft.gladia_endpointing" aria-label="Endpunktung" type="number" min="0" step="0.1" @input="store.patchLlm({ gladia_endpointing: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="field"><span>Maximale Äußerung (s)</span><input :value="store.llmDraft.gladia_max_utterance_secs" type="number" min="1" max="120" step="0.1" @input="store.patchLlm({ gladia_max_utterance_secs: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="switch-row"><span>Audioverbesserung</span><input type="checkbox" :checked="store.llmDraft.gladia_audio_enhancer" @change="store.patchLlm({ gladia_audio_enhancer: ($event.target as HTMLInputElement).checked })" /></label>
          </div></details>
        </template>
        </div>
      </article>
      <template v-if="hasEditor">
        <div class="editor-divider" role="separator" aria-label="Editorbreite" aria-orientation="vertical" tabindex="0" :aria-valuenow="editorWidth" aria-valuemin="300" :aria-valuemax="Math.max(300, (studio?.clientWidth ?? 1200) - 540)" @pointerdown.prevent="resize" @keydown.left.prevent="editorWidth = Math.min(editorWidth + 32, Math.max(300, (studio?.clientWidth ?? 1200) - 540))" @keydown.right.prevent="editorWidth = Math.max(300, editorWidth - 32)"></div>
        <aside class="panel studio-editor" aria-label="Baustein-Editor">
          <div class="panel-head section-toolbar"><h2>Editor</h2><button type="button" class="btn" aria-label="Editor einklappen" @click="editorOpen = false">Einklappen</button></div>
          <label class="field"><span>Name</span><input v-model="editName" type="text" :disabled="busy" /></label>
          <div class="editor-mode"><button type="button" class="btn" :aria-pressed="editorMode === 'source'" @click="editorMode = 'source'">Quelltext</button><button type="button" class="btn" :aria-pressed="editorMode === 'preview'" @click="editorMode = 'preview'">Vorschau</button></div>
          <MarkdownEditor v-if="editorMode === 'source'" :key="editingId!" v-model="editMarkdown" :disabled="busy" />
          <div v-else class="markdown-preview"><MarkdownPreview :text="editMarkdown" /></div>
          <div class="editor-meta"><span class="help">{{ editing ? stats(editing) : '' }}</span><InfoTip text="Tokenzahl grob aus der Zeichenanzahl geschätzt. Änderungen gelten nach Übernehmen." label="Token-Schätzung erklären" /></div>
        </aside>
      </template>
    </div>
    <LibraryDeleteDialog v-if="deleting" category="content" :item="deleting" @close="deleting = null" @deleted="deletedItem" />
  </section>
</template>
