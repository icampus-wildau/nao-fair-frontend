<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorHelp from './ErrorHelp.vue'
import ConnectionControls from './ConnectionControls.vue'
import Glyph from './Glyph.vue'
import { stopIcon, volumeIcon } from '../icons'
import { useConsole } from '../stores/console'

const store = useConsole()
const route = useRoute()
const router = useRouter()
function restore() { const path = store.restoreDrafts(); if (!path || path === route.path) store.recoveryNavigation = false; else void router.push(path) }
const menu = ref(false)
const menuClosing = ref(false)
let menuCloseTimer = 0
const navDialog = ref<HTMLDialogElement | null>(null)
watch(navDialog, (dialog) => dialog?.showModal(), { flush: 'post' })
const ttsTest = ref('')
const errorOpen = ref(false)
const errorDialog = ref<HTMLDialogElement | null>(null)
watch(errorDialog, (dialog) => dialog?.showModal(), { flush: 'post' })
const wide = window.matchMedia('(min-width: 761px)')
const nav = [
  { to: '/', label: 'Dashboard', title: 'Dashboard' },
  { to: '/llm', label: 'Studio', title: 'Studio' },
  { to: '/roboter', label: 'Roboter', title: 'Robotereinstellungen' },
  { to: '/system', label: 'System', title: 'System' },
]
const title = computed(() => nav.find((item) => item.to === route.path)?.title ?? 'NAO Fair')
const speaking = computed(() => store.view.conversationState === 'speaking')
const connected = computed(() => store.view.connectionState === 'connected')
const connectionError = computed(() => store.addressError || store.serverLine || store.shownFailure || (store.backendOutdated ? store.systemError || 'Backend-Version veraltet. Bitte den Server neu starten.' : null))
const dotClass = computed(() => connectionError.value ? 'is-bad' : store.pendingConnect || store.view.connectionState === 'connecting' ? 'is-wait' : connected.value ? 'is-on' : '')
let feedbackTimer = 0
watch(() => store.feedback, (value) => {
  window.clearTimeout(feedbackTimer)
  if (value?.ok) feedbackTimer = window.setTimeout(() => store.dismissFeedback(), 4000)
})
function finishCloseMenu() {
  window.clearTimeout(menuCloseTimer)
  navDialog.value?.close()
  menu.value = false
  menuClosing.value = false
}
function closeMenu() {
  if (menuClosing.value) return
  menuClosing.value = true
  menuCloseTimer = window.setTimeout(finishCloseMenu, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
}
function closeMenuOnBackdrop(event: MouseEvent) {
  const rect = navDialog.value?.getBoundingClientRect()
  if (rect && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeMenu()
}
function closeMenuOnWide() { if (wide.matches && menu.value) finishCloseMenu() }
onMounted(() => { store.start(); closeMenuOnWide(); wide.addEventListener('change', closeMenuOnWide) })
onUnmounted(() => { window.clearTimeout(feedbackTimer); window.clearTimeout(menuCloseTimer); wide.removeEventListener('change', closeMenuOnWide) })
async function speakTest() {
  if (speaking.value) {
    if (store.view.hardwareEnabled) await store.stopSpeech()
    return
  }
  const text = ttsTest.value.trim()
  if (!text || !store.view.hardwareEnabled) return
  await store.speak(text)
}
</script>
<template>
  <div class="shell">
    <header class="top">
      <div class="top-row">
        <div class="header-leading">
          <RouterLink class="brand" to="/">NAO Fair</RouterLink>
          <form class="header-tts" @submit.prevent="speakTest">
            <div class="input-action">
              <input v-model="ttsTest" type="text" aria-label="Text testen" placeholder="TTS testen" autocomplete="off" spellcheck="false" />
              <button type="button" class="input-icon" :data-hardware="speaking ? 'speak-stop' : 'speak'" :aria-label="speaking ? 'Stoppen' : 'Sprechen'" :title="speaking ? 'Stoppen' : 'Sprechen'" :disabled="speaking ? !store.view.hardwareEnabled : !store.view.hardwareEnabled || !ttsTest.trim()" @click="speakTest"><Glyph :icon="speaking ? stopIcon : volumeIcon" /></button>
            </div>
          </form>
        </div>
        <h1 class="header-title">{{ title }}</h1>
        <div class="connection-cluster">
          <ConnectionControls input-id="robot-address" />
          <div class="status">
            <span class="dot" :class="dotClass" aria-hidden="true"></span>
            <span>{{ store.statusLabel }}</span>
            <span v-if="store.view.robotName" class="robot-name">{{ store.view.robotName }}</span>
            <UTooltip v-if="connectionError" :text="connectionError" :delay-duration="600">
              <button type="button" class="connection-error" aria-label="Verbindungsfehler anzeigen" @click="errorOpen = true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5m0 3v1" /></svg></button>
            </UTooltip>
          </div>
        </div>
        <button type="button" class="menu-btn" aria-label="Menü öffnen" aria-haspopup="dialog" :aria-expanded="menu" @click="menu = true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
      </div>
      <nav class="tabs" aria-label="Bereiche">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :aria-current="route.path === item.to ? 'page' : undefined">{{ item.label }}</RouterLink>
      </nav>
    </header>
    <dialog v-if="menu" ref="navDialog" class="nav-sheet" :class="{ 'is-closing': menuClosing }" aria-label="Menü" @cancel.prevent="closeMenu" @click="closeMenuOnBackdrop">
      <div class="drawer-head"><strong>NAO Fair</strong><button type="button" class="drawer-close" aria-label="Menü schließen" @click="closeMenu"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
      <nav class="drawer-nav" aria-label="Bereiche">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :aria-current="route.path === item.to ? 'page' : undefined" @click="closeMenu">{{ item.label }}</RouterLink>
      </nav>
      <section class="drawer-connection" aria-labelledby="drawer-connection-title">
        <h2 id="drawer-connection-title">Roboterverbindung</h2>
        <p class="drawer-status"><span class="dot" :class="dotClass" aria-hidden="true"></span>{{ store.statusLabel }}<span v-if="store.view.robotName"> · {{ store.view.robotName }}</span></p>
        <ConnectionControls input-id="drawer-robot-address" />
      </section>
    </dialog>
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
