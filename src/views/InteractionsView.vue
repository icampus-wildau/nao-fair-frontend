<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue"
import InfoTip from "../components/InfoTip.vue"
import TriggerList from "../components/TriggerList.vue"
import { ACTION_GROUPS, ACTION_NONE, AUTOSTART_INFO, GESTURE_IDS, GESTURE_LABELS, MOTIONS, actionLabel, autostartHint, type GestureId, type TriggerId } from "../model/triggers"
import type { GestureRowView, TriggerRowView } from "../model/screen"
import { useConsole } from "../stores/console"

const store = useConsole()
const selected = ref<{ id: TriggerId; gesture: GestureId }>({ id: "front_head", gesture: "tap" })
const menuOpen = ref(false)
const detailOpen = ref(false)
const picker = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuStyle = ref({ top: "0px", left: "0px", width: "240px", maxHeight: "320px", transform: "none" })
const rows = computed<TriggerRowView[]>(() =>
  (store.capabilities ? store.view.triggers.filter((row) => store.capabilities!.sensors.includes(row.id)) : []).map((row) => {
    const trigger = store.interactionDraft?.triggers[row.id]
    const gestures: GestureRowView[] = GESTURE_IDS.map((gesture) => ({
      id: gesture,
      label: GESTURE_LABELS[gesture],
      action: trigger?.[gesture]?.action ?? row.gestures.find((item) => item.id === gesture)?.action ?? null,
      motion: trigger?.[gesture]?.motion ?? null,
      enabled: trigger?.[gesture]?.enabled !== false,
      phrase: trigger?.[gesture]?.phrase ?? "",
    }))
    return { ...row, gestures, action: gestures[0]?.action ?? null, motion: gestures[0]?.motion ?? null }
  }),
)
watch(rows, (available) => {
  if (available.some((row) => row.id === selected.value.id && row.gestures.some((gesture) => gesture.id === selected.value.gesture))) return
  const first = available[0]?.gestures[0]
  if (available[0] && first) selected.value = { id: available[0].id, gesture: first.id }
}, { immediate: true })
const binding = computed(() => store.interactionDraft?.triggers[selected.value.id]?.[selected.value.gesture] ?? null)
const sensorLabel = computed(() => rows.value.find((row) => row.id === selected.value.id)?.label ?? "")
const gestureLabel = computed(() => GESTURE_LABELS[selected.value.gesture])

function placeMenu() {
  const rect = picker.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const openUp = below < 420 && above > below
  menuStyle.value = {
    top: `${openUp ? rect.top - 4 : rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(180, Math.floor(openUp ? above : below))}px`,
    transform: openUp ? "translateY(-100%)" : "none",
  }
}
function onDocPointer(event: Event) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (picker.value?.contains(target) || menu.value?.contains(target)) return
  menuOpen.value = false
}
function openMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) placeMenu()
}
watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener("pointerdown", onDocPointer)
    window.addEventListener("resize", placeMenu)
    document.addEventListener("scroll", placeMenu, true)
  } else {
    document.removeEventListener("pointerdown", onDocPointer)
    window.removeEventListener("resize", placeMenu)
    document.removeEventListener("scroll", placeMenu, true)
  }
})
onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointer)
  window.removeEventListener("resize", placeMenu)
  document.removeEventListener("scroll", placeMenu, true)
})
function chooseAction(action: string | null) {
  menuOpen.value = false
  store.patchGesture(selected.value.id, selected.value.gesture, { action })
}
</script>

<template>
  <div class="interactions-screen" data-screen="interaktionen">
    <p v-if="!store.interactionDraft" class="why">Die Zuordnungen erscheinen, sobald der Server eine Konfiguration schickt. Die verfügbaren Auslöser werden vom Server geladen.</p>
    <div v-else class="interact" :class="{ 'interaction-detail-open': detailOpen }">
      <section v-if="store.interactionDraft || store.view.hardwareEnabled" class="panel autostart-bar" aria-label="Autostart">
        <label v-if="store.interactionDraft" class="toggle autostart-toggle">
          <input type="checkbox" aria-label="Aktiviert im Autostart" :checked="store.interactionDraft.autostart_enabled" @change="store.patchAutostart(($event.target as HTMLInputElement).checked)" />
          <span class="toggle-ui" aria-hidden="true"></span>
          <span>Aktiviert im Autostart <InfoTip :text="AUTOSTART_INFO" label="Autostart erklären" /></span>
        </label>
        <p v-if="store.view.hardwareEnabled && store.view.autostartSynced === true" class="why">Der Roboter hat diesen Autostart übernommen.</p>
        <p v-else-if="store.view.hardwareEnabled && store.view.autostartSynced === false" class="why">Der Roboter hat diesen Autostart noch nicht übernommen.</p>
        <p v-if="store.view.hardwareEnabled" class="why">Solange die NAO Fair App verbunden ist, reagieren die Tasten in der App.</p>
      </section>
      <article class="panel interact-col interaction-list">
        <div class="panel-head">
          <h2>Auslöser</h2>
        </div>
        <div class="interact-scroll">
          <TriggerList :rows="rows" selectable :selected="selected" :bindings="store.interactionDraft?.triggers" @select="selected = $event; menuOpen = false; detailOpen = true" @enable="(id, gesture, enabled) => store.patchGesture(id, gesture, { enabled })" />
          <p v-if="!rows.length" class="empty">Keine Sensoren gemeldet.</p>
        </div>
      </article>
      <article class="panel interact-col interaction-detail">
        <button type="button" class="btn interaction-back" @click="detailOpen = false">Zurück zu Auslösern</button>
        <div class="panel-head">
          <h2>Aktion zuordnen</h2>
          <p v-if="sensorLabel">{{ sensorLabel }} · {{ gestureLabel }}</p>
        </div>
        <div class="interact-scroll">
          <section v-if="binding" class="gesture-form" :aria-label="gestureLabel">
            <div class="field">
              <span>Aktion</span>
              <div ref="picker" class="action-picker">
                <button type="button" class="action-picker-button" aria-haspopup="listbox" :aria-expanded="menuOpen" :aria-label="`Aktion ${gestureLabel}`" @click="openMenu">
                  {{ actionLabel(binding.action) }}
                </button>
              </div>
            </div>
            <p v-if="autostartHint(binding.action)" class="action-hint"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/></svg><span>{{ autostartHint(binding.action) }}</span></p>
            <label v-if="binding.action === 'speak'" class="field">
              <span>Wortlaut</span>
              <textarea :value="binding.phrase" :aria-label="`Wortlaut ${gestureLabel}`" @input="store.patchGesture(selected.id, selected.gesture, { phrase: ($event.target as HTMLTextAreaElement).value })"></textarea>
            </label>
            <label v-if="binding.action === 'motion'" class="field">
              <span>Bewegung</span>
              <select :aria-label="`Bewegung ${gestureLabel}`" :value="binding.motion || 'wave_left'" @change="store.patchGesture(selected.id, selected.gesture, { motion: ($event.target as HTMLSelectElement).value })">
                <option v-for="motion in MOTIONS" :key="motion.id" :value="motion.id">{{ motion.label }}</option>
              </select>
            </label>
            <button type="button" class="btn-charcoal" data-hardware="test" :disabled="!store.view.hardwareEnabled || !binding.action" @click="store.view.hardwareEnabled && store.testGesture(selected.id, selected.gesture)">
              {{ gestureLabel }} testen
            </button>
          </section>
          <p v-else class="why">Noch keine Konfiguration geladen.</p>
          <p v-if="binding && !store.view.hardwareEnabled" class="why">Kein Roboter verbunden.</p>
        </div>
      </article>
    </div>
    <Teleport to="body">
      <div v-if="menuOpen && binding" ref="menu" class="action-menu" role="listbox" :aria-label="`Aktion ${gestureLabel}`" :style="menuStyle" @keydown.escape.stop="menuOpen = false">
        <button type="button" role="option" class="action-option" :aria-selected="!binding.action" @click="chooseAction(null)">{{ ACTION_NONE.label }}</button>
        <div v-for="group in ACTION_GROUPS" :key="group.label" class="action-group" role="group" :aria-label="group.label">
          <div class="action-group-label">{{ group.label }}</div>
          <button v-for="option in group.options" :key="option.id" type="button" role="option" class="action-option" :aria-selected="binding.action === option.id" @click="chooseAction(option.id)">{{ option.label }}</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
