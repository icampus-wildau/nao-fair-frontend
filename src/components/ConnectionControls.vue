<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Glyph from './Glyph.vue'
import { plugIcon, unplugIcon } from '../icons'
import { knownRobotsMatching } from '../model/drafts'
import { useConsole } from '../stores/console'

const props = defineProps<{ inputId: string }>()
const store = useConsole()
const open = ref(false)
const typed = ref(false)
const navigated = ref(false)
const active = ref(0)
const connected = computed(() => store.view.connectionState === 'connected')
const disconnecting = computed(() => connected.value || store.pendingConnect)
const buttonLabel = computed(() => disconnecting.value ? 'Trennen' : 'Verbinden')
const suggestions = computed(() => knownRobotsMatching(store.knownRobots, typed.value ? store.address.value : ''))
const highlighted = computed(() => suggestions.value.length === 0 ? 0 : Math.min(active.value, suggestions.value.length - 1))
const listOpen = computed(() => open.value && suggestions.value.length > 0)
const listId = computed(() => `${props.inputId}-suggestions`)
let closeTimer = 0

function reveal() {
  open.value = store.knownRobots.length > 0
}

function onFocusIn() {
  window.clearTimeout(closeTimer)
  typed.value = false
  navigated.value = false
  active.value = 0
  reveal()
}

watch(() => store.knownRobots.length, (count) => {
  const field = document.getElementById(props.inputId)
  if (count > 0 && field !== null && document.activeElement === field) open.value = true
})

function onInput(value: string) {
  typed.value = true
  navigated.value = false
  active.value = 0
  store.setAddress(value)
  open.value = true
}
function choose(address: string) {
  store.setAddress(address)
  typed.value = false
  navigated.value = false
  open.value = false
}
function remove(address: string) {
  void store.forgetKnownRobot(address)
}
function onFocusOut(event: FocusEvent) {
  const current = event.currentTarget
  if (!(current instanceof HTMLElement)) return
  const next = event.relatedTarget
  if (next instanceof Node && current.contains(next)) return
  window.clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    if (current.contains(document.activeElement)) return
    open.value = false
  }, 0)
}

onBeforeUnmount(() => window.clearTimeout(closeTimer))
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
    return
  }
  if (!listOpen.value) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    navigated.value = true
    const count = suggestions.value.length
    const step = event.key === 'ArrowDown' ? 1 : -1
    active.value = (highlighted.value + step + count) % count
    return
  }
  if (event.key === 'Enter' && (typed.value || navigated.value)) {
    event.preventDefault()
    const robot = suggestions.value[highlighted.value]
    if (robot) choose(robot.address)
  }
}
function onConnection() {
  if (disconnecting.value) store.disconnect()
  else store.connect()
}
</script>
<template>
  <form class="connect" @submit.prevent="onConnection">
    <label :for="inputId">IP-Adresse</label>
    <div class="input-action">
      <div class="address-field" @focusin="onFocusIn" @focusout="onFocusOut">
        <input :id="inputId" role="combobox" :value="store.address.value" inputmode="text" autocomplete="off" spellcheck="false" aria-autocomplete="list" :aria-expanded="listOpen" :aria-controls="listId" :aria-activedescendant="listOpen && (typed || navigated) ? `${inputId}-option-${highlighted}` : undefined" :aria-invalid="store.addressError ? 'true' : undefined" @mousedown="reveal" @focus="onFocusIn" @input="onInput(($event.target as HTMLInputElement).value)" @keydown="onKeydown" />
        <ul v-if="listOpen" :id="listId" class="known-robots" role="listbox" aria-label="Bekannte Roboter">
          <li v-for="(robot, index) in suggestions" :key="robot.address" role="presentation">
            <div :id="`${inputId}-option-${index}`" class="known-robot" role="option" :aria-selected="(typed || navigated) && index === highlighted" @mousedown.prevent @mouseenter="active = index; navigated = true" @click="choose(robot.address)">
              <span>{{ robot.address }} ({{ robot.name }})</span>
              <button type="button" :aria-label="`${robot.address} entfernen`" @mousedown.stop.prevent @click.stop="remove(robot.address)">×</button>
            </div>
          </li>
        </ul>
      </div>
      <button class="input-icon" type="button" :aria-label="buttonLabel" :title="buttonLabel" @click="onConnection"><Glyph :icon="disconnecting ? unplugIcon : plugIcon" /></button>
    </div>
  </form>
</template>
