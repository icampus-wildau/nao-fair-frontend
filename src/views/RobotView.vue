<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import AudioSliders from "../components/AudioSliders.vue"
import Glyph from "../components/Glyph.vue"
import { stopIcon, volumeIcon } from "../icons"
import InfoTip from "../components/InfoTip.vue"
import ApplyBar from "../components/ApplyBar.vue"
import SubNavigation from "../components/SubNavigation.vue"
import { robotDraftFrom } from "../model/drafts"
import { localRef } from "../model/local-state"
import { MOTIONS } from "../model/triggers"
import { TIMING_FIELDS } from "../model/types"
import { useConsole } from "../stores/console"

type SectionId = "texte" | "sprache" | "bewegung"
type Phrase = { text: string; pinned: boolean; used: number }
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "sprache", label: "Sprache & Audio" },
  { id: "texte", label: "Vorgefertigte Texte" },
  { id: "bewegung", label: "Bewegung" },
]
const store = useConsole()
const route = useRoute()
const router = useRouter()
const section = ref<SectionId>("sprache")
const lastSection = localRef<SectionId>("robot-last-section", "sprache")
const wideLayout = ref(false)
let wideMedia: MediaQueryList | null = null
const showSpeechTextPair = computed(() => wideLayout.value && (section.value === "sprache" || section.value === "texte"))
const phrases = localRef<Phrase[]>("speech-phrases", [])
const phraseDraft = ref("")
const testPhrase = ref("")
const baseline = computed(() => (store.screen.applied ? robotDraftFrom(store.screen.applied) : null))
const orderedPhrases = computed(() => [...phrases.value].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.text.localeCompare(b.text, "de")))
const phraseSplit = computed(() => orderedPhrases.value.findIndex((row, index) => row.pinned && orderedPhrases.value[index + 1] && !orderedPhrases.value[index + 1]!.pinned))

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

function isSection(id: string): id is SectionId {
  return SECTIONS.some((item) => item.id === id)
}

function summary(id: SectionId): string {
  if (id === "texte") {
    const count = phrases.value.length
    return count === 1 ? "1 Text" : count ? `${count} Texte` : "Keine Texte"
  }
  if (id === "sprache") return languages.value.find((item) => item.id === store.robotDraft?.tts_language)?.label ?? "—"
  return postures.value.find((item) => item.id === store.robotDraft?.posture)?.label ?? "—"
}

function showSection(id: SectionId) {
  section.value = id
  lastSection.value = id
}

function navActive(id: SectionId): boolean {
  if (showSpeechTextPair.value && (id === "sprache" || id === "texte")) return true
  return section.value === id
}

function syncWideLayout() {
  wideLayout.value = wideMedia?.matches ?? false
}

function chooseSection(id: SectionId) {
  showSection(id)
  void router.replace({ query: { abschnitt: id } })
}

watch(() => route.query.abschnitt, (id) => {
  if (typeof id === "string" && isSection(id) && id !== section.value) showSection(id)
})

onMounted(() => {
  wideMedia = window.matchMedia("(min-width: 1101px)")
  syncWideLayout()
  wideMedia.addEventListener("change", syncWideLayout)
  const asked = route.query.abschnitt
  const id = typeof asked === "string" && isSection(asked) ? asked : isSection(lastSection.value) ? lastSection.value : "sprache"
  showSection(id)
})

onUnmounted(() => {
  wideMedia?.removeEventListener("change", syncWideLayout)
})

function addPhrase() {
  const text = phraseDraft.value.trim()
  if (!text) return
  if (phrases.value.some((row) => row.text === text)) {
    store.feedback = { ok: false, text: "Dieser Text ist schon vorhanden." }
    return
  }
  phrases.value = [{ text, pinned: false, used: Date.now() }, ...phrases.value].slice(0, 50)
  phraseDraft.value = ""
}

function renamePhrase(row: Phrase, input: HTMLInputElement) {
  const text = input.value.trim()
  if (!text || text === row.text) {
    input.value = row.text
    return
  }
  if (phrases.value.some((item) => item !== row && item.text === text)) {
    input.value = row.text
    store.feedback = { ok: false, text: "Dieser Text ist schon vorhanden." }
    return
  }
  row.text = text
}

function removePhrase(row: Phrase) {
  phrases.value = phrases.value.filter((item) => item !== row)
}

async function speakRow(row: Phrase) {
  if (!store.view.hardwareEnabled) return
  const ok = await store.speak(row.text)
  if (ok) row.used = Date.now()
}

const speaking = computed(() => store.view.conversationState === "speaking")
async function testSpeech() {
  if (speaking.value) {
    if (store.view.hardwareEnabled) await store.stopSpeech()
    return
  }
  const text = testPhrase.value.trim()
  if (!text || !store.view.hardwareEnabled) return
  await store.speak(text)
}
</script>

<template>
  <section class="studio-view robot-view" data-screen="roboter">
    <ApplyBar :dirty="store.robotDirty" :busy="store.applying" :can-apply="Boolean(store.screen.applied)" :current="store.robotDraft" :baseline="baseline" @apply="store.apply('robot')" @reset="store.resetDraft('robot')" />
    <div class="studio" :class="{ 'has-dual-speech': showSpeechTextPair }">
      <SubNavigation label="Roboterbereiche" :current="SECTIONS.find(item => item.id === section)?.label || 'Roboter'">
        <button v-for="item in SECTIONS" :key="item.id" type="button" class="tile" :class="{ 'is-on': navActive(item.id) }" :aria-current="navActive(item.id) ? 'true' : undefined" @click="chooseSection(item.id)">
          <strong>{{ item.label }}</strong>
          <small>{{ summary(item.id) }}</small>
        </button>
      </SubNavigation>

      <article v-show="section === 'sprache' || showSpeechTextPair" class="panel studio-main robot-pane-sprache">
        <div class="panel-head">
          <h2>Sprache &amp; Audio</h2>
        </div>
        <div class="subsection-heading is-first"><h2>TTS testen</h2></div>
        <form class="speech-form" @submit.prevent="testSpeech">
          <div class="input-action">
            <input v-model="testPhrase" class="inline-input" type="text" aria-label="Text testen" placeholder="Text zum Testen der Stimme" />
            <button type="button" class="input-icon" :data-hardware="speaking ? 'speak-stop' : 'speak'" :aria-label="speaking ? 'Stoppen' : 'Sprechen'" :title="speaking ? 'Stoppen' : 'Sprechen'" :disabled="speaking ? !store.view.hardwareEnabled : !store.view.hardwareEnabled || !testPhrase.trim()" @click="testSpeech"><Glyph :icon="speaking ? stopIcon : volumeIcon" /></button>
          </div>
        </form>
        <p v-if="!store.robotDraft" class="why">Die Einstellungen erscheinen, sobald der Server eine Konfiguration schickt.</p>
        <template v-else>
          <div class="subsection-heading"><h2>Lautstärke und Tempo</h2></div>
          <AudioSliders />
          <label class="field">
            <span>Sprache</span>
            <select aria-label="Sprache" :value="store.robotDraft.tts_language" @change="store.patchRobot({ tts_language: ($event.target as HTMLSelectElement).value })">
              <option v-for="language in languages" :key="language.id" :value="language.id">{{ language.label }}</option>
            </select>
          </label>
          <div class="subsection-heading"><h2>Gesprächseinstellungen</h2></div>
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
        </template>
      </article>

      <article v-show="section === 'texte' || showSpeechTextPair" class="panel studio-main robot-pane-texte">
        <div class="panel-head with-action">
          <h2>Vorgefertigte Texte</h2>
          <div class="toolbar-actions">
            <button type="button" class="btn-charcoal" data-hardware="speak-stop" :disabled="!store.view.hardwareEnabled" @click="store.view.hardwareEnabled && store.stopSpeech()">Stoppen</button>
          </div>
        </div>
        <form class="term-form" @submit.prevent="addPhrase">
          <input v-model="phraseDraft" class="inline-input" type="text" aria-label="Neuer Text" placeholder="Satz, den NAO sagen soll" />
          <button type="submit" class="btn" :disabled="!phraseDraft.trim()">Hinzufügen</button>
        </form>
        <p v-if="!store.view.hardwareEnabled" class="why">Kein Roboter verbunden. Sprechen bleibt aus.</p>
        <p v-if="!orderedPhrases.length" class="empty">Noch kein vorgefertigter Text.</p>
        <div v-for="(row, index) in orderedPhrases" :key="row.text" class="phrase-library-row" :class="{ 'is-split': index === phraseSplit }">
          <input :value="row.text" class="inline-input" type="text" :aria-label="`${row.text} bearbeiten`" @change="renamePhrase(row, $event.target as HTMLInputElement)" />
          <div class="phrase-actions">
            <button type="button" class="btn-lime" :aria-label="`${row.text} sprechen`" :disabled="!store.view.hardwareEnabled" @click="speakRow(row)">Sprechen</button>
            <button type="button" class="btn" :aria-label="`${row.text} ${row.pinned ? 'lösen' : 'anheften'}`" @click="row.pinned = !row.pinned">{{ row.pinned ? "Lösen" : "Anheften" }}</button>
            <button type="button" class="btn-danger" :aria-label="`${row.text} entfernen`" @click="removePhrase(row)">Entfernen</button>
          </div>
        </div>
      </article>

      <article v-show="section === 'bewegung'" class="panel studio-main robot-pane-motion">
        <div class="panel-head">
          <h2>Bewegung</h2>
        </div>
        <template v-if="store.robotDraft">
          <label class="field">
            <span>Haltung <InfoTip text="NAO nimmt diese Haltung beim Verbinden ein. Sitzt er bereits, bleibt er sitzen. Sonst wechselt er dorthin. Nach dem Hinsetzen werden die Gelenke gelöst, im Stehen bleiben sie steif. Übernehmen bewegt ihn nicht. Trennen lässt die Haltung unverändert." label="Haltung erklären" /></span>
            <select aria-label="Haltung" :value="store.robotDraft.posture" @change="store.patchRobot({ posture: ($event.target as HTMLSelectElement).value })">
              <option v-for="posture in postures" :key="posture.id" :value="posture.id">{{ posture.label }}</option>
            </select>
          </label>
          <p class="help">Startstellung der Verbindung. Die Tasten darunter führen ihre Bewegung sofort aus.</p>
        </template>
        <p v-else class="why">Die Haltung erscheint, sobald der Server eine Konfiguration schickt.</p>
        <div class="subsection-heading"><h2>Sofort ausführen</h2></div>
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
      </article>
    </div>
  </section>
</template>
