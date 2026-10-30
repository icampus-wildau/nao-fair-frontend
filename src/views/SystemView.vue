<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import KeysView from "./KeysView.vue"
import SystemTestsView from "./SystemTestsView.vue"
import InfoTip from "../components/InfoTip.vue"
import { useConsole } from "../stores/console"

const store = useConsole()
const route = useRoute()
const testsSelected = computed(() => route.query.abschnitt === "tests")
const labels: Record<string, string> = { nao: "NAO", bridge: "Mikrofonbrücke", openai: "OpenAI", gladia: "Gladia" }
const states: Record<string, string> = { ready: "Bereit", missing: "Fehlt", disconnected: "Getrennt", blocked: "NAO nicht erreichbar", unknown: "Nicht geprüft", waiting: "Stream verbindet" }
onMounted(() => store.loadSystem())
</script>

<template>
  <section data-screen="system" class="system-page">
    <nav class="system-tabs" aria-label="Systembereiche">
      <RouterLink to="/system" :aria-current="!testsSelected ? 'page' : 'false'">Übersicht</RouterLink>
      <RouterLink to="/system?abschnitt=tests" :aria-current="testsSelected ? 'page' : 'false'">Tests</RouterLink>
    </nav>
    <SystemTestsView v-if="testsSelected" />
    <div v-else class="system-view">
      <div class="system-left">
        <article class="panel">
          <div class="panel-head with-action">
            <h2>Betriebsbereitschaft</h2>
            <button type="button" class="btn" :disabled="store.systemLoading" @click="store.loadSystem(true)">{{ store.systemLoading ? 'Wird geprüft …' : 'Erneut prüfen' }}</button>
          </div>
          <p v-if="store.systemError" class="why" role="alert">{{ store.systemError }}</p>
          <div class="readiness-list">
            <div v-for="(check, key) in store.systemReport?.checks" :key="key" class="readiness-row">
              <strong>{{ labels[key] || key }}</strong>
              <span class="readiness-state" :data-ready="check.state === 'ready'">{{ states[check.state] || check.state }}</span>
              <InfoTip :text="check.detail" :label="`${labels[key]} Details`" />
              <button v-if="key === 'nao'" type="button" class="btn" @click="store.view.hardwareEnabled ? store.disconnect() : store.connect()">{{ store.view.hardwareEnabled ? 'Trennen' : 'Verbinden' }}</button>
              <a v-else-if="key === 'openai' || key === 'gladia'" class="linkish" href="#system-keys">Schlüssel prüfen</a>
              <InfoTip v-else text="Falls NAO erreichbar ist, die Mikrofonbrücke auf dem Roboter starten und danach erneut prüfen." label="Mikrofonbrücke prüfen" />
            </div>
          </div>
          <p class="why">{{ store.systemReport?.conversation_ready ? 'Lokale Voraussetzungen für ein Gespräch erfüllt.' : 'Für ein Gespräch müssen NAO, Mikrofonbrücke und die benötigten Schlüssel bereit sein.' }}</p>
        </article>
        <article class="panel">
          <h2>Arbeitsumgebung</h2>
          <label class="switch-row">
            <span>Entwürfe lokal wiederherstellbar halten <InfoTip text="Offene Konfigurations- und Textentwürfe bleiben in diesem Browser gespeichert. Schlüsselwerte werden nie in dieser Sicherung abgelegt. Bewusstes Verwerfen entfernt die Sicherung." label="Entwurfssicherung erklären" /></span>
            <input v-model="store.draftBackupEnabled" type="checkbox" />
          </label>
          <p class="help">{{ store.systemReport ? `API-Version ${store.systemReport.api_version} · Serverstart ${new Date(store.systemReport.started_at).toLocaleString('de-DE')}` : 'Server-Version unbekannt' }}</p>
          <p v-if="store.backendOutdated" class="why">Backend-Version veraltet. Den NAO-Fair-Server neu starten.</p>
        </article>
      </div>
      <div id="system-keys">
        <h2 class="system-section-title">Schlüssel</h2>
        <KeysView />
      </div>
    </div>
  </section>
</template>
