<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, errorText } from '../api/client'
import { FIELD_LABELS, valueLabel, type Change } from '../model/operator'
import { useConsole } from '../stores/console'
import InfoTip from './InfoTip.vue'
const props = defineProps<{ id: string; disabled?: boolean; label?: string }>()
const store = useConsole()
const changes = ref<Change[]>([])
const problem = ref('')
const confirm = ref(false)
const busy = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
watch(dialog, value => value?.showModal(), { flush: 'post' })
watch(() => [props.id, store.screen.applied?.revision, store.presets], async () => { changes.value = []; problem.value = ''; if (!props.id) return; try { changes.value = (await api.setupPreview(props.id)).changes } catch (err) { problem.value = errorText(err) } }, { immediate: true })
const details = computed(() => problem.value || changes.value.map(row => `${FIELD_LABELS[row.key] ?? row.key}: ${valueLabel(row.before, store.content)} → ${valueLabel(row.after, store.content)}`).join('\n') || 'Keine Abweichung zur laufenden Konfiguration.')
async function activate() { busy.value = true; await store.activateSetup(props.id); busy.value = false; confirm.value = false }
function ask() { if (store.view.hardwareEnabled && store.view.conversationState !== 'idle') confirm.value = true; else void activate() }
</script>
<template><div class="setup-activate"><button type="button" class="btn-charcoal" :disabled="disabled || !id || busy || Boolean(problem)" @click="ask">{{ busy ? 'Wird aktiviert …' : label || 'Setup aktivieren' }}</button><InfoTip v-if="id" :text="details" label="Setup-Vergleich anzeigen" /></div>
  <Teleport to="body"><dialog v-if="confirm" ref="dialog" aria-label="Laufendes Gespräch beenden" @cancel.prevent="confirm = false"><h2>Setup aktivieren?</h2><p class="why">Das laufende Gespräch endet. Die Gesprächspipeline wird neu aufgebaut und der Modellkontext verworfen.</p><InfoTip :text="details" label="Setup-Vergleich anzeigen" /><div class="dialog-actions"><button type="button" class="btn" @click="confirm = false">Abbrechen</button><button type="button" class="btn-lime" :disabled="busy" @click="activate">Aktivieren</button></div></dialog></Teleport>
</template>
