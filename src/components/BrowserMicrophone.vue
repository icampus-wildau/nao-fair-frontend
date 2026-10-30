<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue"
import { BrowserAudioClient } from "../api/browser-audio"
import { CONVERSATION_LABELS, type ConversationState, type TranscriptLine } from "../model/types"
import { useConsole } from "../stores/console"
import TranscriptPanel from "./TranscriptPanel.vue"

const store = useConsole()
const phase = ref<"starting" | "active" | "stopped">("stopped")
const state = ref<ConversationState>("idle")
const lines = ref<TranscriptLine[]>([])
const level = ref(0)
const message = ref("")
const failed = ref(false)
const states: ConversationState[] = ["idle", "listening", "thinking", "speaking"]
const client = new BrowserAudioClient({
  phase: value => { phase.value = value }, state: value => { state.value = value },
  line: line => { lines.value.push(line) }, level: value => { level.value = value },
  message: (text, error) => { message.value = text; failed.value = error },
})
function start() {
  lines.value = []
  message.value = ""
  failed.value = false
  void client.start()
}
onBeforeUnmount(() => client.stop())
</script>

<template>
  <div class="browser-microphone" data-browser-microphone>
    <p class="browser-microphone-description">Pipeline mit dem Browser-Mikrofon testen. Antworten werden hier angezeigt und im Browser vorgelesen. Verwendet die übernommenen Einstellungen sowie Gladia und OpenAI.</p>
    <div class="states" role="group" aria-label="Gesprächszustand im Browser">
      <div v-for="item in states" :key="item" class="state" :class="{ 'is-on': state === item }" :aria-current="state === item ? 'true' : undefined">{{ CONVERSATION_LABELS[item] }}</div>
    </div>
    <div class="actions">
      <button v-if="phase === 'stopped'" type="button" class="btn-charcoal" :disabled="store.view.hardwareEnabled || store.pendingConnect" @click="start">Mikrofontest starten</button>
      <template v-else>
        <button v-if="phase === 'active' && state === 'idle'" type="button" class="btn-charcoal" @click="client.listen()">Weiter zuhören</button>
        <button type="button" class="btn" @click="client.stop()">{{ phase === 'starting' ? 'Start abbrechen' : 'Test beenden' }}</button>
      </template>
      <span class="browser-microphone-status" role="status">{{ phase === 'starting' ? 'Mikrofon und Pipeline werden gestartet …' : phase === 'active' ? state === 'listening' ? 'Mikrofon aktiv' : 'Mikrofon pausiert' : 'Mikrofon aus' }}</span>
    </div>
    <p v-if="store.view.hardwareEnabled" class="why">Für den Browser-Test zuerst den Roboter trennen.</p>
    <div v-if="phase === 'active'" class="browser-microphone-level"><span>Eingangspegel</span><meter :value="level" min="0" max="1" aria-label="Mikrofonpegel" /></div>
    <p v-if="message" :role="failed ? 'alert' : 'status'" :class="failed ? 'field-error' : 'why'">{{ message }}</p>
    <TranscriptPanel :transcript="lines" fill />
  </div>
</template>

<style scoped>
.browser-microphone-description { color: var(--muted); margin-bottom: 16px; }
.browser-microphone-status { color: var(--muted); }
.browser-microphone-level { display: flex; align-items: center; gap: 12px; margin: 12px 0; color: var(--muted); }
.browser-microphone-level meter { flex: 1; min-width: 0; height: 12px; }
</style>
