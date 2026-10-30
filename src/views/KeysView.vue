<script setup lang="ts">
import { ref, watch } from "vue"
import { SECRET_STATUS_LABELS, type SecretSlotId } from "../model/types"
import { useConsole } from "../stores/console"

const store = useConsole()
const values = ref<Record<SecretSlotId, string>>({ openai: "", gladia: "" })
const confirmSlot = ref<SecretSlotId | null>(null)
const confirmDialog = ref<HTMLDialogElement | null>(null)
watch(confirmDialog, (dialog) => dialog?.showModal(), { flush: "post" })

const slots: { id: SecretSlotId; title: string; help: string }[] = [
  { id: "openai", title: "OpenAI", help: "Für das Sprachmodell." },
  { id: "gladia", title: "Gladia", help: "Für die Spracherkennung." },
]

function statusOf(id: SecretSlotId) {
  return store.secrets?.find((slot) => slot.slot === id)?.status ?? null
}

function submit(id: SecretSlotId) {
  const value = values.value[id]
  if (!value.trim()) return
  void store.putSecret(id, value).then((ok) => {
    if (ok) values.value[id] = ""
  })
}

function remove(id: SecretSlotId) {
  confirmSlot.value = null
  void store.removeSecret(id)
}
</script>

<template>
  <section data-screen="schluessel">
    <p v-if="store.secretsError" class="why">{{ store.secretsError }}</p>
    <div class="keys">
      <article v-for="slot in slots" :key="slot.id" class="panel">
        <h2>{{ slot.title }}</h2>
        <p class="secret-status">{{ statusOf(slot.id) ? SECRET_STATUS_LABELS[statusOf(slot.id)!] : "—" }}</p>
        <form @submit.prevent="submit(slot.id)">
          <label class="field">
            <span>Neuer Wert</span>
            <input v-model="values[slot.id]" type="password" autocomplete="new-password" spellcheck="false" />
          </label>
          <div class="actions">
            <button type="submit" class="btn-lime" :disabled="!values[slot.id].trim()">Setzen</button>
            <button v-if="statusOf(slot.id) && statusOf(slot.id) !== 'missing'" type="button" class="btn-danger" @click="confirmSlot = slot.id">Entfernen</button>
          </div>
        </form>
      </article>
    </div>
    <dialog v-if="confirmSlot" ref="confirmDialog" aria-label="Schlüssel entfernen" @cancel.prevent="confirmSlot = null">
      <p v-if="confirmSlot">Den gespeicherten {{ confirmSlot === "openai" ? "OpenAI" : "Gladia" }}-Schlüssel entfernen?</p>
      <div class="dialog-actions">
        <button type="button" class="btn" @click="confirmSlot = null">Abbrechen</button>
        <button v-if="confirmSlot" type="button" class="btn-danger" @click="remove(confirmSlot)">Entfernen</button>
      </div>
    </dialog>
  </section>
</template>
