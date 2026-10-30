<script setup lang="ts">
import { computed, ref, watch } from "vue"
import ApplyBar from "../components/ApplyBar.vue"
import TriggerList from "../components/TriggerList.vue"
import { interactionsDraftFrom } from "../model/drafts"
import { ACTION_OPTIONS, MOTIONS, type TriggerId } from "../model/triggers"
import type { TriggerRowView } from "../model/screen"
import { useConsole } from "../stores/console"

const store = useConsole()
const selected = ref<TriggerId>("front_head")
const identifySensor = ref(false)
watch(() => store.view.triggers.map(row => row.pressNonce).join(), () => { if (!identifySensor.value) return; const touched = [...store.view.triggers].sort((a, b) => b.pressNonce - a.pressNonce)[0]; if (touched?.pressed) { selected.value = touched.id; identifySensor.value = false } })
const baseline = computed(() => (store.screen.applied ? interactionsDraftFrom(store.screen.applied) : null))
const rows = computed<TriggerRowView[]>(() =>
  (store.capabilities ? store.view.triggers.filter((row) => store.capabilities!.sensors.includes(row.id)) : []).map((row) => ({
    ...row,
    action: store.interactionDraft ? store.interactionDraft.triggers[row.id]?.action ?? null : row.action,
    motion: store.interactionDraft?.triggers[row.id]?.motion ?? row.motion,
  })),
)
watch(rows, (available) => {
  if (available.length && !available.some((row) => row.id === selected.value)) selected.value = available[0]!.id
}, { immediate: true })
const binding = computed(() => rows.value.some((row) => row.id === selected.value) ? store.interactionDraft?.triggers[selected.value] ?? null : null)
</script>

<template>
  <section class="workspace-view" data-screen="interaktionen">
      <ApplyBar
        :dirty="store.interactionDirty"
        :interrupts="false"
        :busy="store.applying"
        :can-apply="Boolean(store.screen.applied)"
        :current="store.interactionDraft"
        :baseline="baseline"
        @apply="store.apply('interactions')"
        @reset="store.resetDraft('interactions')"
      />
    <p v-if="!store.interactionDraft" class="why">Die Zuordnungen erscheinen, sobald der Server eine Konfiguration schickt. Die verfügbaren Auslöser werden vom Server geladen.</p>
    <div class="interact">
      <article class="panel">
        <div class="panel-head">
          <h2>Auslöser</h2>
          <label class="compact-check sensor-identify"><input v-model="identifySensor" type="checkbox" />Sensor erkennen</label>
        </div>
        <TriggerList :rows="rows" selectable :selected="selected" :bindings="store.interactionDraft?.triggers" @select="selected = $event" @enable="(id, enabled) => store.patchTrigger(id, { enabled })" />
        <p v-if="!rows.length" class="empty">Keine Sensoren gemeldet.</p>
      </article>
      <article class="panel">
        <div class="panel-head">
          <h2>Aktion zuordnen</h2><RouterLink class="linkish" to="/llm?abschnitt=presets">Presets verwalten</RouterLink>
          <p>{{ rows.find((row) => row.id === selected)?.label }}</p>
        </div>
        <template v-if="binding">
          <label class="field">
            <span>Aktion</span>
            <select aria-label="Aktion" :value="binding.action ?? ''" @change="store.patchTrigger(selected, { action: ($event.target as HTMLSelectElement).value || null })">
              <option v-for="option in ACTION_OPTIONS" :key="option.label" :value="option.id ?? ''">{{ option.label }}</option>
            </select>
          </label>
          <label v-if="binding.action === 'speak'" class="field">
            <span>Wortlaut</span>
            <textarea :value="binding.phrase" @input="store.patchTrigger(selected, { phrase: ($event.target as HTMLTextAreaElement).value })"></textarea>
          </label>
          <label v-if="binding.action === 'speak' && store.capabilities?.voices.length" class="field">
            <span>Stimme</span>
            <select aria-label="Stimme" :value="binding.voice ?? ''" @change="store.patchTrigger(selected, { voice: ($event.target as HTMLSelectElement).value || null })">
              <option value="">Standard</option>
              <option v-for="voice in store.capabilities.voices" :key="voice" :value="voice">{{ voice }}</option>
            </select>
          </label>
          <label v-if="binding.action === 'wave'" class="field">
            <span>Seite</span>
            <select aria-label="Seite" :value="binding.motion || 'wave_left'" @change="store.patchTrigger(selected, { motion: ($event.target as HTMLSelectElement).value })">
              <option value="wave_left">Winken links</option>
              <option value="wave_right">Winken rechts</option>
            </select>
          </label>
          <label v-else-if="binding.action === 'motion'" class="field">
            <span>Bewegung</span>
            <select aria-label="Bewegung" :value="binding.motion || 'wave_left'" @change="store.patchTrigger(selected, { motion: ($event.target as HTMLSelectElement).value })">
              <option v-for="motion in MOTIONS" :key="motion.id" :value="motion.id">{{ motion.label }}</option>
            </select>
          </label>
          <label class="switch-row">
            <span>Aktiv</span>
            <input type="checkbox" :checked="binding.enabled" @change="store.patchTrigger(selected, { enabled: ($event.target as HTMLInputElement).checked })" />
          </label>
          <button type="button" class="btn-charcoal" data-hardware="test" :disabled="!store.view.hardwareEnabled || !binding.action" @click="store.view.hardwareEnabled && store.testTrigger(selected)">
            Aktion testen
          </button>
          <p v-if="!store.view.hardwareEnabled" class="why">Kein Roboter verbunden.</p>
        </template>
        <p v-else class="why">Noch keine Konfiguration geladen.</p>
      </article>

    </div>
  </section>
</template>
