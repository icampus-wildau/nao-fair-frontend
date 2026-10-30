<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorHelp from './ErrorHelp.vue'
import { useConsole } from '../stores/console'

const store = useConsole()
const route = useRoute()
const router = useRouter()
function restore() { const path = store.restoreDrafts(); if (!path || path === route.path) store.recoveryNavigation = false; else void router.push(path) }
const menu = ref(false)
const errorOpen = ref(false)
const errorDialog = ref<HTMLDialogElement | null>(null)
watch(errorDialog, (dialog) => dialog?.showModal(), { flush: 'post' })
const wide = window.matchMedia('(min-width: 761px)')
const nav = [
  { to: '/', label: 'Dashboard', title: 'Dashboard' },
  { to: '/roboter', label: 'Roboter', title: 'Robotereinstellungen' },
  { to: '/llm', label: 'LLM Studio', title: 'LLM Studio' },
  { to: '/interaktionen', label: 'Interaktionen', title: 'Interaktionen' },
  { to: '/setups', label: 'Setups', title: 'Setups' },
  { to: '/system', label: 'System', title: 'System' },
]
const title = computed(() => nav.find((item) => item.to === route.path)?.title ?? 'NAO Fair')
const connected = computed(() => store.view.connectionState === 'connected')
const buttonLabel = computed(() => connected.value || store.pendingConnect ? 'Trennen' : 'Verbinden')
const connectionError = computed(() => store.addressError || store.serverLine || store.shownFailure || (store.backendOutdated ? store.systemError || 'Backend-Version veraltet. Bitte den Server neu starten.' : null))
const dotClass = computed(() => connectionError.value ? 'is-bad' : store.pendingConnect || store.view.connectionState === 'connecting' ? 'is-wait' : connected.value ? 'is-on' : '')
let feedbackTimer = 0
watch(() => store.feedback, (value) => {
  window.clearTimeout(feedbackTimer)
  if (value?.ok) feedbackTimer = window.setTimeout(() => store.dismissFeedback(), 4000)
})
function closeMenuOnWide() { if (wide.matches) menu.value = false }
onMounted(() => { store.start(); closeMenuOnWide(); wide.addEventListener('change', closeMenuOnWide) })
onUnmounted(() => { window.clearTimeout(feedbackTimer); wide.removeEventListener('change', closeMenuOnWide) })
function onConnection() {
  if (connected.value || store.pendingConnect) store.disconnect()
  else store.connect()
}
</script>
<template>
  <div class="shell">
    <header class="top">
      <div class="top-row">
        <RouterLink class="brand" to="/">NAO Fair</RouterLink>
        <h1 class="header-title">{{ title }}</h1>
        <div class="connection-cluster">
          <form class="connect" @submit.prevent="!connected && !store.pendingConnect && store.connect()">
            <label for="robot-address">IP-Adresse</label>
            <input id="robot-address" :value="store.address.value" inputmode="decimal" autocomplete="off" spellcheck="false" :aria-invalid="store.addressError ? 'true' : undefined" @input="store.setAddress(($event.target as HTMLInputElement).value)" />
            <button class="btn" type="button" @click="onConnection">{{ buttonLabel }}</button>
          </form>
          <div class="status">
            <span class="dot" :class="dotClass" aria-hidden="true"></span>
            <span>{{ store.statusLabel }}</span>
            <span v-if="store.view.robotName" class="robot-name">{{ store.view.robotName }}</span>
            <UTooltip v-if="connectionError" :text="connectionError" :delay-duration="600">
              <button type="button" class="connection-error" aria-label="Verbindungsfehler anzeigen" @click="errorOpen = true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5m0 3v1" /></svg></button>
            </UTooltip>
          </div>
        </div>
        <button type="button" class="btn menu-btn" @click="menu = true">Menü</button>
      </div>
      <nav class="tabs" aria-label="Bereiche">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :aria-current="route.path === item.to ? 'page' : undefined">{{ item.label }}</RouterLink>
      </nav>
    </header>
    <div v-if="menu" class="nav-sheet" role="dialog" aria-label="Bereiche">
      <button type="button" @click="menu = false">Schließen</button>
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" @click="menu = false">{{ item.label }}</RouterLink>
    </div>
    <div class="floating-messages">
      <div v-if="store.notice" class="notice" role="status"><p>{{ store.notice }}</p><button type="button" class="btn" @click="store.dismissNotice()">Schließen</button></div>
      <div v-if="store.feedback" class="feedback" :role="store.feedback.ok ? 'status' : 'alert'" :data-ok="store.feedback.ok"><div><p>{{ store.feedback.text }}</p><ErrorHelp v-if="!store.feedback.ok && /Server|erreichbar|Verbindung|Mikrofonbrücke|Schlüssel/.test(store.feedback.text)" :error="store.feedback.text" @navigate="store.dismissFeedback()" /></div><button type="button" class="dismiss-message" aria-label="Meldung schließen" @click="store.dismissFeedback()">×</button></div>
    </div>
    <div v-if="store.recovery" class="recovery-banner" role="region" aria-label="Entwurf wiederherstellen"><span>Lokaler Entwurf gefunden.</span><button type="button" class="btn" @click="restore">Wiederherstellen</button><button type="button" class="btn" @click="store.dismissRecovery()">Verwerfen</button></div>
    <div id="changes-footer"></div>
    <main class="canvas"><slot /></main>
    <dialog v-if="errorOpen" ref="errorDialog" aria-label="Verbindungsfehler" @cancel.prevent="errorOpen = false">
      <h2>Verbindungsfehler</h2><p class="info-content">{{ connectionError || 'Der Fehler ist inzwischen behoben.' }}</p><ErrorHelp v-if="connectionError" :error="connectionError" @navigate="errorOpen = false" />
      <div class="dialog-actions"><button type="button" class="btn" @click="errorOpen = false">Schließen</button></div>
    </dialog>
  </div>
</template>
