<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorText } from '../api/client'
import type { ContentItem } from '../model/types'
import type { References } from '../model/operator'
import { useConsole } from '../stores/console'
const props = defineProps<{ item: ContentItem }>()
const emit = defineEmits<{ close: []; deleted: [string] }>()
const store = useConsole()
const dialog = ref<HTMLDialogElement | null>(null)
const references = ref<References | null>(null)
const replacement = ref('')
const error = ref('')
const busy = ref(false)
const choices = computed(() => store.content.filter(item => item.kind === props.item.kind && item.id !== props.item.id))
const needsReplacement = computed(() => Boolean(references.value?.scenarios.length))
onMounted(async () => { dialog.value?.showModal(); try { references.value = await api.references(props.item.id) } catch (err) { error.value = errorText(err) } })
async function remove() {
  busy.value = true
  const ok = await store.removeContent(props.item.id, replacement.value || undefined)
  busy.value = false
  if (ok) { emit('deleted', props.item.id); emit('close') }
  else error.value = store.feedback?.text ?? 'Löschen fehlgeschlagen.'
}
</script>
<template>
  <dialog ref="dialog" aria-label="Verwendung und Löschen" @cancel.prevent="!busy && emit('close')">
    <h2>„{{ item.name }}“ löschen</h2>
    <p v-if="references?.applied" class="why">Aktuell übernommen. Zuerst einen anderen Baustein auswählen und übernehmen.</p>
    <template v-if="references"><p class="why" v-if="needsReplacement">Verwendet in:</p><ul class="usage-list"><li v-for="scenario in references.scenarios" :key="scenario.id">Szenario: {{ scenario.name }}</li></ul>
      <label v-if="needsReplacement && !references.applied" class="field"><span>Ersatz</span><select v-model="replacement"><option value="">Ersatz wählen</option><option v-for="choice in choices" :key="choice.id" :value="choice.id">{{ choice.name }}</option></select></label>
      <p v-if="!needsReplacement && !references.applied" class="why">Dieser Baustein wird von keinem Szenario verwendet.</p>
    </template>
    <p v-if="error" role="alert" class="why">{{ error }}</p>
    <div class="dialog-actions"><button type="button" class="btn" :disabled="busy" @click="emit('close')">Abbrechen</button><button type="button" class="btn-danger" :disabled="busy || !references || references.applied || (needsReplacement && !replacement)" @click="remove">{{ busy ? 'Wird gelöscht …' : 'Löschen' }}</button></div>
  </dialog>
</template>
