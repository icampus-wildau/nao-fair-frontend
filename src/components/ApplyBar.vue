<script setup lang="ts">
import { computed } from 'vue'
import { changeLines } from '../model/operator'
import InfoTip from './InfoTip.vue'
import { useConsole } from '../stores/console'
const props = withDefaults(defineProps<{ dirty: boolean; canApply: boolean; current: object | null; baseline: object | null; label?: string; message?: string; busy?: boolean; extraChanges?: string[]; interrupts?: boolean }>(), { interrupts: true })
defineEmits<{ apply: []; reset: [] }>()
const store = useConsole()
const changes = computed(() => [...changeLines(props.baseline, props.current, [...store.content, ...store.presets]), ...(props.extraChanges ?? [])])
</script>
<template>
  <Teleport to="#changes-footer">
    <div v-if="dirty" class="apply-bar" role="region" aria-label="Offene Änderungen">
      <p class="dirty-note" role="status">{{ message || (changes.length ? `${changes.length} ${changes.length === 1 ? 'Änderung' : 'Änderungen'} offen` : 'Änderungen noch nicht übernommen') }}</p>
      <InfoTip :text="changes.join('\n') || 'Noch nicht übernommene Änderungen.'" label="Änderungen anzeigen" />
      <InfoTip v-if="interrupts && store.view.hardwareEnabled && store.view.conversationState !== 'idle'" text="Übernehmen startet die Gesprächspipeline neu. Die Unterhaltung endet und der Modellkontext wird verworfen. Das Transkript bleibt erhalten." label="Auswirkung auf das Gespräch" />
      <button type="button" class="btn" :disabled="busy" @click="$emit('reset')">Zurücksetzen</button>
      <button type="button" class="btn-lime" :disabled="!canApply || busy" @click="$emit('apply')">{{ busy ? 'Wird gespeichert …' : label || 'Übernehmen' }}</button>
    </div>
  </Teleport>
</template>
