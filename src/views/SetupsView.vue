<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue"
import SetupStatus from "../components/SetupStatus.vue"
import SetupActivate from "../components/SetupActivate.vue"
import ApplyBar from "../components/ApplyBar.vue"
import { SETUP_SLOT_FIELDS, type SetupSlots } from "../model/types"
import { useConsole } from "../stores/console"

const store = useConsole()
const query = ref("")
const selectedId = ref<string | null>(null)
const creating = ref(false)
const pendingId = ref<string | "new" | null>(null)
const deleteOpen = ref(false)
const switchDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
watch(switchDialog, (dialog) => dialog?.showModal(), { flush: "post" })
watch(deleteDialog, (dialog) => dialog?.showModal(), { flush: "post" })
const form = reactive({ name: "", description: "", slots: emptySlots() })
const snapshot = ref("")
const baseline = computed(() => snapshot.value ? JSON.parse(snapshot.value) : null)

const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase("de")
  if (!needle) return store.setups
  return store.setups.filter((setup) => `${setup.name} ${setup.description}`.toLocaleLowerCase("de").includes(needle))
})

const slotSummary = computed(() =>
  SETUP_SLOT_FIELDS.map((field) => ({
    label: field.label,
    name: store.presets.find((preset) => preset.id === form.slots[field.key])?.name ?? "—",
  })),
)

function emptySlots(): SetupSlots {
  return { ...store.emptySlots }
}

function capture() {
  snapshot.value = JSON.stringify({ name: form.name, description: form.description, slots: form.slots })
  store.setupDirty = false
  store.setupFormDraft = null
}

function load(id: string) {
  const setup = store.setups.find((item) => item.id === id)
  if (!setup) return
  creating.value = false
  selectedId.value = id
  form.name = setup.name
  form.description = setup.description
  form.slots = { ...setup.slots }
  capture()
}

function startNew(slots?: SetupSlots) {
  creating.value = true
  selectedId.value = null
  form.name = ""
  form.description = ""
  form.slots = { ...(slots ?? emptySlots()) }
  capture()
  store.setupDirty = Boolean(slots && Object.values(slots).some(Boolean))
}

function ask(id: string | "new") {
  if (store.setupDirty) {
    pendingId.value = id
    return
  }
  if (id === "new") startNew()
  else load(id)
}

async function saveAndSwitch() {
  const ok = await save()
  if (!ok) return
  const next = pendingId.value
  pendingId.value = null
  if (next === "new") startNew()
  else if (next) load(next)
}

function discardAndSwitch() {
  const next = pendingId.value
  pendingId.value = null
  store.setupDirty = false
  if (next === "new") startNew()
  else if (next) load(next)
}

snapshot.value = JSON.stringify(form)

watch(
  form,
  () => {
    store.setupDirty = JSON.stringify({ name: form.name, description: form.description, slots: form.slots }) !== snapshot.value
    store.setupFormDraft = store.setupDirty ? { selectedId: selectedId.value, creating: creating.value, form: JSON.parse(JSON.stringify(form)), snapshot: snapshot.value } : null
  },
  { deep: true },
)

async function save() {
  if (!form.name.trim()) {
    store.feedback = { ok: false, text: "Das Setup braucht einen Namen." }
    return false
  }
  const input = { name: form.name.trim(), description: form.description.trim(), slots: { ...form.slots } }
  const previousIds = new Set(store.setups.map((setup) => setup.id))
  const editingId = creating.value ? null : selectedId.value
  const ok = await store.saveSetup(editingId, input)
  if (!ok) return false
  creating.value = false
  const match = store.setups.find((setup) => editingId ? setup.id === editingId : !previousIds.has(setup.id))
  if (match) load(match.id)
  else capture()
  return true
}

function resetForm() {
  if (creating.value) startNew()
  else if (selectedId.value) load(selectedId.value)
}

function hydrateDraft() {
  const saved = store.setupFormDraft as { selectedId: string | null; creating: boolean; form: typeof form; snapshot: string } | null
  if (!saved?.form || !saved.snapshot) return false
  if (JSON.stringify(form) === JSON.stringify(saved.form) && selectedId.value === saved.selectedId) return true
  selectedId.value = saved.selectedId
  creating.value = saved.creating
  Object.assign(form, saved.form)
  snapshot.value = saved.snapshot
  store.setupDirty = true
  return true
}
watch(() => store.setupFormDraft, () => { if (store.setupDirty) hydrateDraft() })
onMounted(() => {
  if (hydrateDraft()) return
  const queued = store.takeQueuedSetup()
  if (queued) startNew(queued)
  else if (store.setups[0]) load(store.setups[0].id)
  else capture()
})

watch(
  () => store.setups.map((setup) => setup.id).join(),
  () => {
    if (!selectedId.value && !creating.value && !store.setupDirty && store.setups[0]) {
      load(store.setups[0].id)
    } else if (selectedId.value && !store.setups.some((setup) => setup.id === selectedId.value)) {
      if (store.setups[0]) load(store.setups[0].id)
      else startNew()
    }
  },
)

async function confirmDelete() {
  if (!selectedId.value) return
  const ok = await store.removeSetup(selectedId.value)
  deleteOpen.value = false
  if (!ok) return
  if (store.setups[0]) load(store.setups[0].id)
  else startNew()
}
</script>

<template>
  <section class="workspace-view" data-screen="setups">
    <ApplyBar :dirty="store.setupDirty" :can-apply="Boolean(form.name.trim())" :current="form" :baseline="baseline" :interrupts="false" label="Speichern" message="Setup noch nicht gespeichert" @apply="save" @reset="resetForm" />
    <p v-if="store.libraryError" class="why">{{ store.libraryError }}</p>
    <div class="setups">
      <article class="panel">
        <div class="panel-head with-action">
          <h2>Gespeicherte Setups</h2>
          <button type="button" class="btn" @click="ask('new')">Neues Setup</button>
        </div>
        <input v-model="query" class="search" type="search" aria-label="Setups suchen" placeholder="Setup suchen" />
        <p v-if="!filtered.length" class="empty">Kein Setup.</p>
        <button
          v-for="setup in filtered"
          :key="setup.id"
          type="button"
          class="setup-item"
          :class="{ 'is-on': setup.id === selectedId }"
          @click="ask(setup.id)"
        >
          <strong>{{ setup.name }}</strong>
          <span v-if="setup.id === store.screen.activeSetupId" class="badge"> Aktiv</span>
          <small v-if="setup.description" class="help" style="display: block">{{ setup.description }}</small>
        </button>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>{{ creating ? "Neues Setup" : "Setup bearbeiten" }}</h2>
        </div>
        <label class="field">
          <span>Name</span>
          <input v-model="form.name" type="text" />
        </label>
        <label class="field">
          <span>Beschreibung</span>
          <input v-model="form.description" type="text" />
        </label>
        <label v-for="field in SETUP_SLOT_FIELDS" :key="field.key" class="slot">
          <span>{{ field.label }}</span>
          <select v-model="form.slots[field.key]" :aria-label="field.label">
            <option :value="null">Keine Auswahl</option>
            <option v-for="preset in store.presets.filter((item) => item.kind === field.kind)" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
          </select>
        </label>
        <div class="actions">
          <button type="button" class="btn" :disabled="!selectedId || store.setupDirty" @click="selectedId && store.duplicateSetup(selectedId)">Duplizieren</button>
          <button type="button" class="btn-danger" :disabled="!selectedId || store.setupDirty" @click="deleteOpen = true">Löschen</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>Überblick</h2>
          <SetupStatus v-if="selectedId && selectedId === store.screen.activeSetupId" />
        </div>
        <div v-for="row in slotSummary" :key="row.label" class="summary-row">
          <span>{{ row.label }}</span>
          <strong>{{ row.name }}</strong>
        </div>
        <SetupActivate :id="selectedId || ''" :disabled="store.setupDirty" />
        <p v-if="store.setupDirty" class="help" style="margin-top: 8px">Änderungen zuerst speichern, um dieses Setup zu aktivieren.</p>
      </article>
    </div>

    <dialog v-if="pendingId" ref="switchDialog" aria-label="Ungespeicherte Änderungen" @cancel.prevent="pendingId = null">
      <p>Änderungen an diesem Setup sind noch nicht gespeichert.</p>
      <div class="dialog-actions">
        <button type="button" class="btn" @click="pendingId = null">Abbrechen</button>
        <button type="button" class="btn" @click="discardAndSwitch">Verwerfen</button>
        <button type="button" class="btn-lime" @click="saveAndSwitch">Speichern</button>
      </div>
    </dialog>
    <dialog v-if="deleteOpen" ref="deleteDialog" aria-label="Setup löschen" @cancel.prevent="deleteOpen = false">
      <p>Setup „{{ form.name }}“ löschen?</p>
      <div class="dialog-actions">
        <button type="button" class="btn" @click="deleteOpen = false">Abbrechen</button>
        <button type="button" class="btn-danger" @click="confirmDelete">Löschen</button>
      </div>
    </dialog>
  </section>
</template>
