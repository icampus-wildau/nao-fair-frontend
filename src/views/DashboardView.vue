<script setup lang="ts">
import { computed } from "vue"
import SpeechComposer from "../components/SpeechComposer.vue"
import TranscriptPanel from "../components/TranscriptPanel.vue"
import SetupStatus from "../components/SetupStatus.vue"
import AudioSliders from "../components/AudioSliders.vue"
import TriggerList from "../components/TriggerList.vue"
import { alphabetical } from "../model/operator"
import { formatStamp } from "../model/format"
import { MOTIONS } from "../model/triggers"
import { CONVERSATION_LABELS, type ConversationState } from "../model/types"
import { useConsole } from "../stores/console"

const store = useConsole()
const sensorRows = computed(() => store.capabilities ? alphabetical(store.view.triggers.filter((row) => store.capabilities!.sensors.includes(row.id)), row => row.label) : [])

const states: ConversationState[] = ["idle", "listening", "thinking", "speaking"]
const lastPress = computed(() => {
  const rows = sensorRows.value.filter((row) => row.pressedAt)
  if (!rows.length) return null
  return rows.reduce((latest, row) => (row.pressNonce > latest.pressNonce ? row : latest))
})

function contentName(id: string | null | undefined) {
  const item = store.content.find((entry) => entry.id === id)
  return (item && (store.textDrafts[item.id]?.name || item.name)) || "—"
}
const cards = computed(() => {
  const draft = store.llmDraft
  const knowledge = draft?.knowledge_ids.length ?? 0
  return [
    { label: "Persönlichkeit", to: "/llm?abschnitt=personality", name: contentName(draft?.personality_id) },
    { label: "Hintergrundwissen", to: "/llm?abschnitt=knowledge", name: knowledge === 1 ? "1 Baustein" : `${knowledge} Bausteine` },
    { label: "Örtlicher Kontext", to: "/llm?abschnitt=local_context", name: contentName(draft?.local_context_id) },
    { label: "System-Prompt", to: "/llm?abschnitt=system_prompt", name: contentName(draft?.system_prompt_id) },
    { label: "LLM", to: "/llm?abschnitt=model", name: draft?.llm_model || "—" },
  ]
})

</script>

<template>
  <section data-screen="dashboard" class="dashboard-view">
    <div class="dash">
      <article class="panel dashboard-conversation">
        <div class="panel-head">
          <h2>Live-Gespräch</h2>
        </div>
        <div class="states" role="group" aria-label="Gesprächszustand">
          <div
            v-for="state in states"
            :key="state"
            class="state"
            :class="{ 'is-on': store.view.conversationState === state }"
            :aria-current="store.view.conversationState === state ? 'true' : undefined"
          >
            {{ CONVERSATION_LABELS[state] }}
          </div>
        </div>
        <div class="actions">
          <button
            v-if="store.view.conversationState === 'idle'"
            type="button"
            class="btn-charcoal"
            data-hardware="conversation"
            :disabled="!store.view.hardwareEnabled"
            @click="store.view.hardwareEnabled && store.startConversation()"
          >
            Gespräch starten
          </button>
          <button
            v-else
            type="button"
            class="btn-charcoal"
            data-hardware="conversation"
            :disabled="!store.view.hardwareEnabled"
            @click="store.view.hardwareEnabled && store.stopConversation()"
          >
            Gespräch beenden
          </button>
        </div>
        <div v-if="!store.view.hardwareEnabled" class="dashboard-disconnected">
          <p class="why">Kein Roboter verbunden.</p>
          <RouterLink v-if="!store.pendingConnect && store.view.connectionState === 'disconnected'" class="btn" to="/system?abschnitt=tests">Gespräch ohne NAO testen</RouterLink>
        </div>
        <TranscriptPanel :searchable="false" fill />
      </article>

      <article class="panel">
        <div class="panel-head sensor-heading">
          <RouterLink class="sensor-edit" to="/interaktionen" aria-label="Sensoren und Zuordnungen bearbeiten" title="Sensoren und Zuordnungen bearbeiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></RouterLink>
          <h2>Robotersensoren</h2>
          <p>{{ lastPress ? `Letzte Berührung: ${lastPress.label}, ${formatStamp(lastPress.pressedAt || "")}` : store.view.hardwareEnabled ? "Noch keine Berührung." : "Getrennt. Keine Berührung." }}</p>
        </div>
        <TriggerList :rows="sensorRows" />
        <p v-if="!sensorRows.length" class="empty">Keine Sensoren gemeldet.</p>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>Schnellsteuerung</h2>
        </div>
        <div class="quick-section"><SpeechComposer compact /></div>
        <div class="quick-section"><AudioSliders /></div>
        <div class="motion-grid quick-section">
          <button
            v-for="motion in MOTIONS"
            :key="motion.id"
            type="button"
            class="btn"
            data-hardware="motion"
            :disabled="!store.motionAllowed(motion.id)"
            @click="store.motionAllowed(motion.id) && store.executeMotion(motion.id)"
          >
            {{ motion.label }}
          </button>
          <button type="button" class="btn-charcoal wide" data-hardware="motion-stop" :disabled="!store.view.hardwareEnabled" @click="store.view.hardwareEnabled && store.stopMotion()">
            Bewegung stoppen
          </button>
        </div>
      </article>

      <article class="panel span-2">
        <div class="panel-head sensor-heading">
          <RouterLink class="sensor-edit" to="/setups" aria-label="Setups bearbeiten" title="Setups bearbeiten"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></RouterLink>
          <h2>Aktives Setup <SetupStatus /></h2>
          <p class="setup-name">{{ store.activeSetup?.name || "Kein Setup aktiv" }}</p>
          <p v-if="store.activeSetup?.description">{{ store.activeSetup.description }}</p>
        </div>
        <div class="chips chips--compact">
          <RouterLink v-for="card in cards" :key="card.label" class="chip" :to="card.to">
            {{ card.label }}
            <small>{{ card.name }}</small>
          </RouterLink>
        </div>
      </article>

    </div>
  </section>
</template>

