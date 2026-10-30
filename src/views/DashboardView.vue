<script setup lang="ts">
import { computed, ref } from "vue"
import { useRouter } from "vue-router"
import SpeechComposer from "../components/SpeechComposer.vue"
import TranscriptPanel from "../components/TranscriptPanel.vue"
import SetupStatus from "../components/SetupStatus.vue"
import SetupActivate from "../components/SetupActivate.vue"
import AudioSliders from "../components/AudioSliders.vue"
import TriggerList from "../components/TriggerList.vue"
import { alphabetical } from "../model/operator"
import { formatStamp } from "../model/format"
import { MOTIONS } from "../model/triggers"
import type { SetupSlots } from "../model/types"
import { CONVERSATION_LABELS, type ConversationState } from "../model/types"
import { useConsole } from "../stores/console"

const store = useConsole()
const router = useRouter()
const setupChoice = ref("")
const sensorRows = computed(() => store.capabilities ? alphabetical(store.view.triggers.filter((row) => store.capabilities!.sensors.includes(row.id)), row => row.label) : [])

const states: ConversationState[] = ["idle", "listening", "thinking", "speaking"]
const lastPress = computed(() => {
  const rows = sensorRows.value.filter((row) => row.pressedAt)
  if (!rows.length) return null
  return rows.reduce((latest, row) => (row.pressNonce > latest.pressNonce ? row : latest))
})

const links: { label: string; to: string; slot: keyof SetupSlots }[] = [
  { label: "Persönlichkeit", to: "/llm?abschnitt=personality", slot: "personality" },
  { label: "System-Prompt", to: "/llm?abschnitt=system_prompt", slot: "system_prompt" },
  { label: "Hintergrundwissen", to: "/llm?abschnitt=knowledge", slot: "knowledge_bundle" },
  { label: "Stimme", to: "/roboter", slot: "voice" },
  { label: "LLM", to: "/llm?abschnitt=model", slot: "llm" },
]

function presetName(slot: keyof SetupSlots) {
  const id = store.activeSetup?.slots[slot]
  if (!id) return "—"
  return store.presets.find((preset) => preset.id === id)?.name ?? "—"
}

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
        <div class="panel-head" style="display: flex; justify-content: space-between; gap: 12px; align-items: start">
          <div>
            <h2>Aktives Setup <SetupStatus /></h2>
            <p v-if="store.activeSetup?.description">{{ store.activeSetup.description }}</p>
          </div>
          <button type="button" class="btn" @click="router.push('/setups')">Alle Setups</button>
        </div>
        <p style="font-size: 18px; font-weight: 600; margin-bottom: 12px">{{ store.activeSetup?.name || "Kein Setup aktiv" }}</p>
        <div class="actions">
          <select v-model="setupChoice" class="inline-select" aria-label="Setup wählen" style="flex: 1">
            <option value="">Setup wählen</option>
            <option v-for="setup in store.setups" :key="setup.id" :value="setup.id">{{ setup.name }}</option>
          </select>
          <SetupActivate :id="setupChoice" label="Aktivieren" />
        </div>
        <div class="chips">
          <RouterLink v-for="link in links" :key="link.label" class="chip" :to="link.to">
            {{ link.label }}
            <small>{{ presetName(link.slot) }}</small>
          </RouterLink>
        </div>
      </article>

    </div>
  </section>
</template>

