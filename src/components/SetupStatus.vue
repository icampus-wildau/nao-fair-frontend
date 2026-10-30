<script setup lang="ts">
import { computed } from 'vue'
import InfoTip from './InfoTip.vue'
import { FIELD_LABELS, valueLabel } from '../model/operator'
import { useConsole } from '../stores/console'
const store = useConsole()
const details = computed(() => store.systemReport?.setup_error || store.systemReport?.setup_changes.map(row => `${FIELD_LABELS[row.key] ?? row.key}: ${valueLabel(row.before, store.content)} → ${valueLabel(row.after, store.content)}`).join('\n') || 'Entspricht den gespeicherten Presets.')
</script>
<template><span v-if="store.activeSetup" class="setup-status"><span class="badge">{{ store.systemReport?.setup_modified ? 'Angepasst' : 'Aktiv' }}</span><InfoTip :text="details" label="Setup-Abweichungen anzeigen" /></span></template>
