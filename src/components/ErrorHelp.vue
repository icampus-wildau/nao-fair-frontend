<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConsole } from '../stores/console'
const props = defineProps<{ error: string }>()
const emit = defineEmits<{ navigate: [] }>()
const router = useRouter()
const store = useConsole()
const action = computed(() => /schlüssel|key|gladia|openai/i.test(props.error) ? 'Schlüssel prüfen' : /adresse|ipv4|ip-adresse/i.test(props.error) ? 'Adresse prüfen' : 'Systemdiagnose öffnen')
async function go() { emit('navigate'); if (action.value === 'Adresse prüfen') document.getElementById('robot-address')?.focus(); else { await router.push('/system'); await nextTick(); if (action.value === 'Schlüssel prüfen') document.getElementById('system-keys')?.scrollIntoView({ block: 'start' }) } }
async function copy() { try { await navigator.clipboard.writeText(props.error); store.feedback = { ok: true, text: 'Fehlerdetails kopiert.' } } catch { store.feedback = { ok: false, text: 'Kopieren ist im Browser nicht verfügbar.' } } }
</script>
<template><div class="error-actions"><button type="button" class="btn" @click="go">{{ action }}</button><button type="button" class="btn" @click="store.loadSystem(true)">Erneut prüfen</button><button type="button" class="btn" @click="copy">Details kopieren</button></div></template>
