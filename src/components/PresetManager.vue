<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { robotDraftFrom, llmDraftFrom, interactionsDraftFrom } from '../model/drafts'
import { PRESET_LABELS, alphabetical, presetPayload } from '../model/operator'
import type { PresetKind, Preset } from '../model/types'
import { useConsole } from '../stores/console'
import InfoTip from './InfoTip.vue'
import LibraryDeleteDialog from './LibraryDeleteDialog.vue'
const store = useConsole()
const router = useRouter()
const filter = ref('')
const kind = ref<PresetKind | ''>('')
const newKind = ref<PresetKind>('system_prompt')
const name = ref('')
const creating = ref(false)
const deleting = ref<Preset | null>(null)
const renaming = ref<Preset | null>(null)
const renameValue = ref('')
const renameDialog = ref<HTMLDialogElement | null>(null)
watch(renameDialog, dialog => dialog?.showModal(), { flush: 'post' })
const options = alphabetical(Object.entries(PRESET_LABELS) as [PresetKind, string][], row => row[1])
const visible = computed(() => store.presets.filter(item => (!kind.value || item.kind === kind.value) && `${item.name} ${PRESET_LABELS[item.kind]}`.toLocaleLowerCase('de').includes(filter.value.toLocaleLowerCase('de'))))
function payload(type: PresetKind) { return presetPayload(type, store.robotDraft, store.llmDraft, store.interactionDraft) }
function matches(preset: Preset, applied = false) {
  const base = store.screen.applied
  const current = applied && base ? presetPayload(preset.kind, robotDraftFrom(base), llmDraftFrom(base), interactionsDraftFrom(base)) : payload(preset.kind)
  if (!current) return false
  const aliases: Record<string, string> = { system_prompt_id: 'content_id', local_context_id: 'content_id', personality_id: 'content_id', knowledge_ids: 'content_ids', tts_replacements: 'replacements', entries: 'replacements', stt_vocabulary: 'terms' }
  const entries = Object.entries(preset.payload).filter(([key]) => Object.hasOwn(current, aliases[key] ?? key))
  return entries.length > 0 && entries.every(([key, value]) => JSON.stringify(current[aliases[key] ?? key]) === JSON.stringify(value))
}
const setupSlots = computed(() => {
  const slots = { ...store.emptySlots }
  for (const preset of store.presets) if (store.loadedPreset[preset.kind] === preset.id && matches(preset)) slots[preset.kind] = preset.id
  return slots
})
function combine() { store.queueSetup(setupSlots.value); void router.push('/setups') }
async function save() { const data = payload(newKind.value); if (data && await store.savePreset(newKind.value, name.value.trim(), data)) { name.value = ''; creating.value = false } }
async function update(preset: Preset) { const data = payload(preset.kind); if (data) await store.savePreset(preset.kind, preset.name, data, preset.id) }
function startRename(preset: Preset) { renaming.value = preset; renameValue.value = preset.name }
async function rename() { if (!renaming.value || !renameValue.value.trim()) return; if (await store.savePreset(renaming.value.kind, renameValue.value.trim(), renaming.value.payload, renaming.value.id)) renaming.value = null }
</script>
<template><div class="preset-manager">
  <div class="list-toolbar"><input v-model="filter" type="search" class="search" placeholder="Presets suchen" aria-label="Presets suchen" /><select v-model="kind" class="inline-select" aria-label="Preset-Art filtern"><option value="">Alle Arten</option><option v-for="[id, label] in options" :key="id" :value="id">{{ label }}</option></select><button type="button" class="btn" @click="creating = !creating">Neues Preset</button><button type="button" class="btn" :disabled="!Object.values(setupSlots).some(Boolean) || store.contentDirty" @click="combine">Als Setup kombinieren</button><InfoTip text="Presets speichern jeweils einen Bereich der aktuellen Auswahl. Ein Setup kombiniert mehrere Presets. Als Setup kombinieren verwendet geladene, seitdem unveränderte Presets. Laden füllt den Entwurf; Übernehmen aktiviert ihn. Lautstärke und Tempo gelten beim Laden eines Stimm-Presets direkt." label="Presets erklären" /></div>
  <form v-if="creating" class="preset-create" @submit.prevent="save"><label class="field"><span>Art</span><select v-model="newKind"><option v-for="[id, label] in options" :key="id" :value="id">{{ label }}</option></select></label><label class="field"><span>Neues Preset</span><input v-model="name" type="text" /></label><button type="submit" class="btn-lime" :disabled="!name.trim() || store.contentDirty">Preset speichern</button><InfoTip text="Speichert die aktuelle Auswahl dieses Bereichs. Offene Textänderungen zuerst übernehmen." label="Preset-Inhalt erklären" /></form>
  <p v-if="!visible.length" class="empty">Keine passenden Presets.</p>
  <div v-for="preset in visible" :key="preset.id" class="preset-row studio-list-row"><div class="preset-identity"><strong>{{ preset.name }}<span class="mobile-applied">{{ matches(preset, true) ? ' · übernommen' : matches(preset) ? ' · ausgewählt' : '' }}</span></strong><small class="help">{{ PRESET_LABELS[preset.kind] }}</small></div><span v-if="matches(preset, true)" class="applied-marker">Übernommen</span><span v-else-if="matches(preset)" class="applied-marker">Ausgewählt</span><button type="button" class="btn" :aria-label="`${preset.name} laden`" @click="store.applyPreset(preset)">Laden</button><UDropdownMenu :items="[{ label: 'Mit aktueller Auswahl aktualisieren', disabled: store.contentDirty, onSelect: () => update(preset) }, { label: 'Umbenennen', onSelect: () => startRename(preset) }, { label: 'Duplizieren', onSelect: () => store.duplicatePreset(preset.id) }, { label: 'Verwendung und Löschen', onSelect: () => deleting = preset }] "><button type="button" class="item-menu" :aria-label="`Menü für Preset ${preset.name}`">⋯</button></UDropdownMenu></div>
  <LibraryDeleteDialog v-if="deleting" category="presets" :item="deleting" @close="deleting = null" />
  <dialog v-if="renaming" ref="renameDialog" aria-label="Preset umbenennen" @cancel.prevent="renaming = null"><form @submit.prevent="rename"><label class="field"><span>Preset umbenennen</span><input v-model="renameValue" type="text" /></label><div class="actions"><button type="button" class="btn" @click="renaming = null">Abbrechen</button><button type="submit" class="btn-lime" :disabled="!renameValue.trim()">Speichern</button></div></form></dialog>
</div></template>
