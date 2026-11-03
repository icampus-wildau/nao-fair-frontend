<script setup lang="ts">
import { computed, ref } from 'vue'
import Glyph from './Glyph.vue'
import { stopIcon, volumeIcon } from '../icons'
import { alphabetical } from '../model/operator'
import { localRef } from '../model/local-state'
import { useConsole } from '../stores/console'
const props = withDefaults(defineProps<{ compact?: boolean; utterance?: (phrase: string) => string; library?: boolean }>(), { library: true })
const store = useConsole()
const phrase = ref('')
const history = localRef<{ text: string; pinned: boolean; used: number }[]>('speech-phrases', [])
const shortcutsOpen = localRef('speech-shortcuts-open', true)
const pinned = computed(() => alphabetical(history.value.filter(row => row.pinned), row => row.text))
const speaking = computed(() => store.view.conversationState === 'speaking')
async function speak() {
  if (speaking.value) {
    if (store.view.hardwareEnabled) await store.stopSpeech()
    return
  }
  const value = phrase.value.trim(); const spoken = (props.utterance?.(value) ?? value).trim(); if (!value || !spoken || !store.view.hardwareEnabled) return; const ok = await store.speak(spoken); if (ok) history.value = [{ text: value, pinned: history.value.find(row => row.text === value)?.pinned ?? false, used: Date.now() }, ...history.value.filter(row => row.text !== value)].slice(0, 50)
}
</script>
<template>
  <div class="speech-composer" :class="{ 'is-compact': compact }">
    <form class="speech-form" @submit.prevent="speak">
      <div class="input-action">
        <input v-model="phrase" class="inline-input" type="text" aria-label="Text" placeholder="Was soll NAO sagen?" />
        <button type="button" class="input-icon" :data-hardware="speaking ? 'speak-stop' : 'speak'" :aria-label="speaking ? 'Stoppen' : 'Sprechen'" :title="speaking ? 'Stoppen' : 'Sprechen'" :disabled="speaking ? !store.view.hardwareEnabled : !store.view.hardwareEnabled || !phrase.trim()" @click="speak"><Glyph :icon="speaking ? stopIcon : volumeIcon" /></button>
      </div>
    </form>
    <slot name="preview" :phrase="phrase" />
    <div v-if="library" class="speech-shortcuts">
      <button type="button" class="speech-expand" :aria-expanded="shortcutsOpen" aria-controls="speech-shortcuts" aria-label="Schnellauswahl" @click="shortcutsOpen = !shortcutsOpen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <RouterLink class="shortcut-edit" to="/roboter?abschnitt=texte">Schnellauswahl bearbeiten</RouterLink>
      <div v-show="shortcutsOpen" id="speech-shortcuts" class="chips speech-pins">
        <button v-for="row in pinned" :key="row.text" type="button" class="chip" @click="phrase = row.text">{{ row.text }}</button>
      </div>
    </div>
  </div>
</template>
