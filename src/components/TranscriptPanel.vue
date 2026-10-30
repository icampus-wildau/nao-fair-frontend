<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { useConsole } from "../stores/console"
import { localRef, downloadText } from "../model/local-state"
import { formatStamp, speakerLabel } from "../model/format"
import type { TranscriptLine } from "../model/types"

const props = withDefaults(defineProps<{ transcript?: TranscriptLine[]; searchable?: boolean; fill?: boolean }>(), { searchable: true, fill: false })
const store = useConsole()
const filter = ref("")
const message = ref("")
const sending = ref(false)
async function sendMessage() {
  const value = message.value.trim()
  if (!value || sending.value) return
  sending.value = true
  try { if (await store.sendMessage(value)) message.value = "" } finally { sending.value = false }
}
const scroller = ref<HTMLElement | null>(null)
const stick = ref(true)
const height = localRef("transcript-height", 240)
const transcript = computed(() => props.transcript ?? store.view.transcript)
const needle = computed(() => props.searchable ? filter.value.toLocaleLowerCase("de") : "")
const lines = computed(() => transcript.value.filter(line => line.text.toLocaleLowerCase("de").includes(needle.value)))
const text = computed(() => lines.value.map(line => `${formatStamp(line.timestamp)} ${speakerLabel(line.speaker)}: ${line.text}`).join("\n"))
function onScroll() {
  const el = scroller.value
  if (el) stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 32
}
watch(() => transcript.value.length, async () => {
  await nextTick()
  if (stick.value && scroller.value && !needle.value) scroller.value.scrollTop = scroller.value.scrollHeight
})
function jump() {
  stick.value = true
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    store.feedback = { ok: true, text: "Transkript kopiert." }
  } catch {
    store.feedback = { ok: false, text: "Kopieren ist im Browser nicht verfügbar." }
  }
}
function resized() {
  if (scroller.value && getComputedStyle(scroller.value).resize !== "none") height.value = scroller.value.offsetHeight
}
</script>

<template>
  <div class="transcript-panel" :class="{ 'is-fill': fill }" :style="{ '--transcript-height': `${height}px` }">
    <div class="transcript-tools">
      <input v-if="searchable" v-model="filter" type="search" class="search" placeholder="Transkript durchsuchen" aria-label="Transkript durchsuchen" />
      <h3 v-else class="transcript-title">Transkript</h3>
      <UDropdownMenu :items="[{ label: 'Sichtbare Zeilen kopieren', disabled: !lines.length, onSelect: copy }, { label: 'Sichtbare Zeilen als Text exportieren', disabled: !lines.length, onSelect: () => downloadText('nao-transkript.txt', text) }]">
        <button type="button" class="item-menu" aria-label="Transkript-Menü">⋯</button>
      </UDropdownMenu>
    </div>
    <div ref="scroller" class="transcript" data-transcript @scroll="onScroll" @pointerup="resized">
      <p v-if="!lines.length" class="empty">{{ needle ? 'Keine passenden Zeilen.' : 'Noch keine fertigen Zeilen.' }}</p>
      <article v-for="line in lines" :key="line.id" class="line" :class="{ 'is-nao': line.speaker === 'nao' }" :data-speaker="line.speaker">
        <time class="num" :datetime="line.timestamp">{{ formatStamp(line.timestamp) }}</time>
        <span class="who">{{ speakerLabel(line.speaker) }}</span>
        <p>{{ line.text }}</p>
      </article>
    </div>
    <form v-if="!searchable" class="message-form" @submit.prevent="sendMessage">
      <input v-model="message" class="inline-input" aria-label="Nachricht" placeholder="Nachricht eingeben" />
      <button type="submit" class="btn-charcoal" :disabled="!store.view.hardwareEnabled || !message.trim() || sending || ['thinking', 'speaking'].includes(store.view.conversationState)">Nachricht senden</button>
    </form>
    <button v-if="!stick && transcript.length" type="button" class="btn scroll-back" @click="jump">Neue Zeilen</button>
  </div>
</template>
