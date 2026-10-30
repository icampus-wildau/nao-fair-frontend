<script setup lang="ts">
import { computed } from "vue"
import SpeechComposer from "../components/SpeechComposer.vue"
import AudioSliders from "../components/AudioSliders.vue"
import InfoTip from "../components/InfoTip.vue"
import ApplyBar from "../components/ApplyBar.vue"
import { robotDraftFrom } from "../model/drafts"
import { localRef } from "../model/local-state"
import { MOTIONS } from "../model/triggers"
import { TIMING_FIELDS } from "../model/types"
import { useConsole } from "../stores/console"

const store = useConsole()
const timingsOpen = localRef("robot-timings-open", false)
const audioOpen = localRef("robot-audio-open", false)
const baseline = computed(() => (store.screen.applied ? robotDraftFrom(store.screen.applied) : null))

const languages = computed(() => {
  const current = store.robotDraft?.tts_language
  const base = [
    { id: "de", label: "Deutsch" },
    { id: "en", label: "Englisch" },
    { id: "de-DE", label: "Deutsch (de-DE)" },
    { id: "en-US", label: "Englisch (en-US)" },
  ]
  if (current && !base.some((item) => item.id === current)) base.push({ id: current, label: current })
  return base.sort((a, b) => a.label.localeCompare(b.label, "de"))
})

const postures = computed(() => {
  const current = store.robotDraft?.posture
  const base = [
    { id: "Stand", label: "Stehen" },
    { id: "Sit", label: "Sitzen" },
  ]
  if (current && !base.some((item) => item.id === current)) base.push({ id: current, label: current })
  return base.sort((a, b) => a.label.localeCompare(b.label, "de"))
})

</script>

<template>
  <section class="robot-view" data-screen="roboter">
    <ApplyBar :dirty="store.robotDirty" :busy="store.applying" :can-apply="Boolean(store.screen.applied)" :current="store.robotDraft" :baseline="baseline" @apply="store.apply('robot')" @reset="store.resetDraft('robot')" />
    <p v-if="!store.robotDraft" class="why">Die Einstellungen erscheinen, sobald der Server eine Konfiguration schickt. Bewegungen bleiben bis dahin aus.</p>
    <div class="robot-grid">
      <article id="sprechen" class="panel full speech-panel">
        <h2>Text sprechen</h2>
        <SpeechComposer />
      </article>
      <article v-if="store.robotDraft" class="panel">
        <div class="panel-head">
          <h2>Sprache und Audio</h2>
        </div>
        <AudioSliders />
        <details class="advanced-settings" :open="audioOpen" @toggle="audioOpen = ($event.target as HTMLDetailsElement).open"><summary>Weitere Einstellungen</summary>
        <label class="field">
          <span>Sprache</span>
          <select aria-label="Sprache" :value="store.robotDraft.tts_language" @change="store.patchRobot({ tts_language: ($event.target as HTMLSelectElement).value })">
            <option v-for="language in languages" :key="language.id" :value="language.id">{{ language.label }}</option>
          </select>
        </label>
        <label class="field">
          <span>Haltung <InfoTip text="Die gewählte Haltung gilt nach Übernehmen. Die Bewegungsbuttons führen ihre Aktion sofort aus." label="Haltung erklären" /></span>
          <select aria-label="Haltung" :value="store.robotDraft.posture" @change="store.patchRobot({ posture: ($event.target as HTMLSelectElement).value })">
            <option v-for="posture in postures" :key="posture.id" :value="posture.id">{{ posture.label }}</option>
          </select>
        </label>
        <div class="subsection-heading"><h2>Mikrofon &amp; Erkennung</h2></div>
        <label class="switch-row">
          <span>Mikrofon</span>
          <input type="checkbox" :checked="store.robotDraft.microphone_enabled" @change="store.patchRobot({ microphone_enabled: ($event.target as HTMLInputElement).checked })" />
        </label>
        <label class="switch-row">
          <span>Spracherkennung</span>
          <input type="checkbox" :checked="store.robotDraft.stt_enabled" @change="store.patchRobot({ stt_enabled: ($event.target as HTMLInputElement).checked })" />
        </label>
        <label class="switch-row">
          <span>Modell im Gespräch</span>
          <input type="checkbox" :checked="store.robotDraft.llm_enabled" @change="store.patchRobot({ llm_enabled: ($event.target as HTMLInputElement).checked })" />
        </label>
        </details>
        <div class="subsection-heading"><h2>Gesprächssteuerung</h2></div>
        <details class="advanced-settings" :open="timingsOpen" @toggle="timingsOpen = ($event.target as HTMLDetailsElement).open"><summary>Gesprächszeiten</summary>
        <label v-for="field in TIMING_FIELDS" :key="field.key" class="timing">
          <span>
            <strong>{{ field.label }}</strong> <InfoTip :text="field.help" :label="`${field.label} erklären`" />
          </span>
          <input
            class="num"
            :aria-label="field.label"
            type="number"
            :min="store.rangeFor(field.key).min"
            :max="store.rangeFor(field.key).max"
            :step="store.rangeFor(field.key).step"
            :value="store.robotDraft[field.key]"
            @input="store.patchRobot({ [field.key]: Number(($event.target as HTMLInputElement).value) })"
          />
          <span>s</span>
        </label>
        </details>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>Bewegungen</h2>
        </div>
        <p v-if="!store.view.hardwareEnabled" class="why">Kein Roboter verbunden. Bewegungen bleiben aus.</p>
        <div class="motion-grid">
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
          <button type="button" class="btn-charcoal" data-hardware="motion-stop" :disabled="!store.view.hardwareEnabled" @click="store.view.hardwareEnabled && store.stopMotion()">
            Bewegung stoppen
          </button>
        </div>
        <RouterLink class="linkish" to="/llm?abschnitt=presets">Stimm-Presets verwalten</RouterLink>
      </article>


    </div>
  </section>
</template>
