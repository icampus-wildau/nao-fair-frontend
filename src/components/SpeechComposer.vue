<script setup lang="ts">
import { computed, ref } from 'vue'
import { alphabetical } from '../model/operator'
import { localRef } from '../model/local-state'
import { useConsole } from '../stores/console'
const props = defineProps<{ compact?: boolean; utterance?: (phrase: string) => string }>()
const store = useConsole()
const phrase = ref('')
const history = localRef<{ text: string; pinned: boolean; used: number }[]>('speech-phrases', [])
const manage = ref(false)
const pinned = computed(() => alphabetical(history.value.filter(row => row.pinned), row => row.text))
const recent = computed(() => history.value.filter(row => !row.pinned).sort((a, b) => b.used - a.used).slice(0, 8))
async function speak() { const value = phrase.value.trim(); const spoken = (props.utterance?.(value) ?? value).trim(); if (!value || !spoken || !store.view.hardwareEnabled) return; const ok = await store.speak(spoken); if (ok) history.value = [{ text: value, pinned: history.value.find(row => row.text === value)?.pinned ?? false, used: Date.now() }, ...history.value.filter(row => row.text !== value)].slice(0, 50) }
function pin() { const value = phrase.value.trim(); if (!value) return; const existing = history.value.find(row => row.text === value); if (existing) existing.pinned = !existing.pinned; else history.value = [{ text: value, pinned: true, used: Date.now() }, ...history.value] }
</script>
<template><div class="speech-composer" :class="{ 'is-compact': compact }"><form class="speech-form" @submit.prevent="speak"><input v-model="phrase" class="inline-input" type="text" aria-label="Text" placeholder="Was soll NAO sagen?" /><button type="submit" class="btn-lime" data-hardware="speak" :disabled="!store.view.hardwareEnabled || !phrase.trim()">Sprechen</button><button type="button" class="btn-charcoal" data-hardware="speak-stop" :disabled="!store.view.hardwareEnabled" @click="store.stopSpeech()">Stoppen</button></form><slot name="preview" :phrase="phrase" /><div class="speech-tools"><button type="button" class="btn-quiet" :disabled="!phrase.trim()" @click="pin">{{ history.find(row => row.text === phrase.trim())?.pinned ? 'Lösen' : 'Anheften' }}</button><button type="button" class="btn-quiet" @click="manage = !manage">Schnellwahl</button></div><div v-if="pinned.length" class="chips speech-pins"><button v-for="row in pinned" :key="row.text" type="button" class="chip" @click="phrase = row.text">{{ row.text }}</button></div><div v-if="manage" class="speech-history"><p v-if="!history.length" class="empty">Noch keine gespeicherten Sätze.</p><div v-for="row in alphabetical([...pinned, ...recent], row => row.text)" :key="row.text" class="speech-history-row"><button type="button" class="phrase-choice" @click="phrase = row.text">{{ row.text }}</button><button type="button" class="btn" :aria-label="`${row.text} ${row.pinned ? 'lösen' : 'anheften'}`" @click="row.pinned = !row.pinned">{{ row.pinned ? 'Lösen' : 'Anheften' }}</button><button type="button" class="btn-danger" :aria-label="`${row.text} entfernen`" @click="history = history.filter(item => item.text !== row.text)">Entfernen</button></div></div></div></template>
