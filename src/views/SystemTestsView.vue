<script setup lang="ts">
import { computed } from "vue"
import BrowserMicrophone from "../components/BrowserMicrophone.vue"
import SetupStatus from "../components/SetupStatus.vue"
import { useConsole } from "../stores/console"

const store = useConsole()
const applied = computed(() => store.screen.applied)
function contentName(id: string | null) {
  return store.content.find(item => item.id === id)?.name || "—"
}
</script>

<template>
  <div class="system-tests" data-screen="system-tests">
    <article class="panel test-conversation">
      <div class="panel-head">
        <h2>Browser-Gespräch testen</h2>
      </div>
      <BrowserMicrophone v-if="applied" />
      <p v-else class="empty" role="status">Die übernommene Konfiguration wird geladen.</p>
    </article>
    <article class="panel test-configuration" aria-labelledby="test-configuration-title">
      <div class="panel-head">
        <h2 id="test-configuration-title">Übernommene Konfiguration</h2>
        <p>Offene Entwürfe werden erst nach dem Übernehmen getestet.</p>
      </div>
      <dl v-if="applied" class="test-configuration-list">
        <div><dt>Setup</dt><dd>{{ store.activeSetup?.name || "Kein Setup aktiv" }} <SetupStatus /></dd></div>
        <div><dt>Konfigurationsstand</dt><dd class="num">Revision {{ applied.revision }}</dd></div>
        <div><dt>Sprachmodell</dt><dd>{{ applied.llm_enabled ? applied.llm_model : "Ausgeschaltet" }}</dd></div>
        <div><dt>Erkennungssprache</dt><dd>{{ applied.gladia_language }}</dd></div>
        <div><dt>System-Prompt</dt><dd>{{ contentName(applied.system_prompt_id) }}</dd></div>
        <div><dt>Persönlichkeit</dt><dd>{{ contentName(applied.personality_id) }}</dd></div>
        <div><dt>Hintergrundwissen</dt><dd>{{ applied.knowledge_ids.map(contentName).join(", ") || "Keines" }}</dd></div>
      </dl>
      <p class="why">Beim Verlassen der Tests werden Mikrofon und Gespräch beendet.</p>
      <RouterLink class="linkish" to="/system#system-keys">API-Schlüssel verwalten →</RouterLink>
    </article>
  </div>
</template>
