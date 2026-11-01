<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import KeysView from "./KeysView.vue"
import SystemTestsView from "./SystemTestsView.vue"
import InfoTip from "../components/InfoTip.vue"
import { useConsole } from "../stores/console"

const store = useConsole()
const route = useRoute()
const section = computed(() => {
  const id = route.query.abschnitt
  return id === "tests" || id === "schluessel" ? id : "uebersicht"
})
const labels: Record<string, string> = { nao: "NAO", bridge: "Mikrofonbrücke", openai: "OpenAI", gladia: "Gladia" }
const states: Record<string, string> = { ready: "Bereit", missing: "Fehlt", disconnected: "Getrennt", blocked: "NAO nicht erreichbar", unknown: "Nicht geprüft", waiting: "Stream verbindet" }
const overviewSummary = computed(() => {
  const checks = store.systemReport?.checks
  if (!checks) return "Wird geprüft"
  if (store.systemReport?.conversation_ready) return "Gespräch bereit"
  const values = Object.values(checks)
  const ready = values.filter((check) => check.state === "ready").length
  return `${ready} von ${values.length} bereit`
})
const keySummary = computed(() => {
  const slots = store.secrets
  if (!slots?.length) return "—"
  const ready = slots.filter((slot) => slot.status !== "missing").length
  return ready === slots.length ? "Bereit" : `${ready} von ${slots.length} bereit`
})
const sections = computed(() => [
  { id: "uebersicht", label: "Übersicht", summary: overviewSummary.value, to: "/system" },
  { id: "schluessel", label: "Schlüssel", summary: keySummary.value, to: "/system?abschnitt=schluessel" },
  { id: "tests", label: "Tests", summary: "Browser-Gespräch", to: "/system?abschnitt=tests" },
])
onMounted(() => store.loadSystem())
</script>

<template>
  <section data-screen="system" class="studio-view system-page">
    <div class="studio">
      <nav class="subnav" aria-label="Systembereiche">
        <RouterLink v-for="item in sections" :key="item.id" v-slot="{ href, navigate }" custom :to="item.to">
          <a class="tile" :class="{ 'is-on': section === item.id }" :href="href" :aria-current="section === item.id ? 'page' : undefined" @click="navigate">
            <strong>{{ item.label }}</strong>
            <small>{{ item.summary }}</small>
          </a>
        </RouterLink>
      </nav>
      <SystemTestsView v-if="section === 'tests'" class="studio-main system-tests" />
      <div v-else-if="section === 'schluessel'" class="studio-main keys-host">
        <KeysView />
      </div>
      <article v-else class="panel studio-main">
        <div class="panel-head with-action">
          <h2>Betriebsbereitschaft</h2>
          <button type="button" class="btn" :disabled="store.systemLoading" @click="store.loadSystem(true)">{{ store.systemLoading ? "Wird geprüft …" : "Erneut prüfen" }}</button>
        </div>
        <p v-if="store.systemError" class="why" role="alert">{{ store.systemError }}</p>
        <div class="readiness-list">
          <div v-for="(check, key) in store.systemReport?.checks" :key="key" class="readiness-row">
            <strong>{{ labels[key] || key }}</strong>
            <span class="readiness-state" :data-ready="check.state === 'ready'">{{ states[check.state] || check.state }}</span>
            <InfoTip :text="check.detail" :label="`${labels[key]} Details`" />
            <button v-if="key === 'nao'" type="button" class="btn" @click="store.view.hardwareEnabled ? store.disconnect() : store.connect()">{{ store.view.hardwareEnabled ? "Trennen" : "Verbinden" }}</button>
            <RouterLink v-else-if="key === 'openai' || key === 'gladia'" v-slot="{ href, navigate }" custom to="/system?abschnitt=schluessel">
              <a class="linkish" :href="href" @click="navigate">Schlüssel prüfen</a>
            </RouterLink>
            <InfoTip v-else text="Falls NAO erreichbar ist, die Mikrofonbrücke auf dem Roboter starten und danach erneut prüfen." label="Mikrofonbrücke prüfen" />
          </div>
        </div>
        <p class="why">{{ store.systemReport?.conversation_ready ? "Lokale Voraussetzungen für ein Gespräch erfüllt." : "Für ein Gespräch müssen NAO, Mikrofonbrücke und die benötigten Schlüssel bereit sein." }}</p>
        <div class="subsection-heading"><h2>Arbeitsumgebung</h2></div>
        <label class="switch-row">
          <span>Entwürfe lokal wiederherstellbar halten <InfoTip text="Offene Konfigurations- und Textentwürfe bleiben in diesem Browser gespeichert. Schlüsselwerte werden nie in dieser Sicherung abgelegt. Bewusstes Verwerfen entfernt die Sicherung." label="Entwurfssicherung erklären" /></span>
          <input v-model="store.draftBackupEnabled" type="checkbox" />
        </label>
        <p class="help">{{ store.systemReport ? `API-Version ${store.systemReport.api_version} · Serverstart ${new Date(store.systemReport.started_at).toLocaleString("de-DE")}` : "Server-Version unbekannt" }}</p>
        <p v-if="store.backendOutdated" class="why">Backend-Version veraltet. Den NAO-Fair-Server neu starten.</p>
      </article>
    </div>
  </section>
</template>
