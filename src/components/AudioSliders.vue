<script setup lang="ts">
import { useConsole } from '../stores/console'

const store = useConsole()
const fields = [
  { key: 'volume', label: 'Lautstärke', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'speech_speed', label: 'Sprechtempo', min: 50, max: 200, step: 1, unit: '%' },
] as const

// Writing the value back while the pointer is down ends the drag. The browser
// keeps the thumb; the number beside it still follows the draft.
const vSliderValue = {
  mounted(el: HTMLInputElement, binding: { value: number }) {
    el.value = String(binding.value)
  },
  updated(el: HTMLInputElement, binding: { value: number }) {
    if (el.dataset.holding === '1') return
    const next = String(binding.value)
    if (el.value !== next) el.value = next
  },
}

function hold(event: Event) {
  (event.currentTarget as HTMLInputElement).dataset.holding = '1'
}

function release(event: Event) {
  delete (event.currentTarget as HTMLInputElement).dataset.holding
}
</script>
<template>
  <template v-for="field in fields" :key="field.key">
    <div v-if="store.robotDraft" class="slider">
      <span class="slider-top">
        <span>{{ field.label }}</span>
        <span class="audio-value">
          <span
            class="audio-state"
            :data-state="store.audioState[field.key]"
            :aria-label="store.audioState[field.key] === 'saving' ? 'Wird gespeichert' : store.audioState[field.key] === 'saved' ? 'Gespeichert' : store.audioState[field.key] === 'error' ? 'Speichern fehlgeschlagen' : undefined"
          >
            <svg v-if="store.audioState[field.key] === 'saved'" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 10 4 4 8-9" /></svg>
            <template v-else>{{ store.audioState[field.key] === 'saving' ? '…' : store.audioState[field.key] === 'error' ? '!' : '' }}</template>
          </span>
          <span class="num">{{ store.robotDraft[field.key] }} {{ field.unit }}</span>
        </span>
      </span>
      <input
        v-slider-value="store.robotDraft[field.key]"
        type="range"
        :aria-label="field.label"
        :disabled="store.applying"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        @pointerdown="hold"
        @pointerup="release"
        @pointercancel="release"
        @input="store.patchRobot({ [field.key]: Number(($event.target as HTMLInputElement).value) })"
        @change="store.commitAudio(field.key, Number(($event.target as HTMLInputElement).value))"
      />
    </div>
    <p v-else class="summary-row"><span>{{ field.label }}</span><strong>—</strong></p>
  </template>
</template>
