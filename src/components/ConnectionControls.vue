<script setup lang="ts">
import { computed } from 'vue'
import Glyph from './Glyph.vue'
import { plugIcon, unplugIcon } from '../icons'
import { useConsole } from '../stores/console'
defineProps<{ inputId: string }>()
const store = useConsole()
const connected = computed(() => store.view.connectionState === 'connected')
const disconnecting = computed(() => connected.value || store.pendingConnect)
const buttonLabel = computed(() => disconnecting.value ? 'Trennen' : 'Verbinden')
function onConnection() {
  if (disconnecting.value) store.disconnect()
  else store.connect()
}
</script>
<template>
  <form class="connect" @submit.prevent="onConnection">
    <label :for="inputId">IP-Adresse</label>
    <div class="input-action">
      <input :id="inputId" :value="store.address.value" inputmode="decimal" autocomplete="off" spellcheck="false" :aria-invalid="store.addressError ? 'true' : undefined" @input="store.setAddress(($event.target as HTMLInputElement).value)" />
      <button class="input-icon" type="button" :aria-label="buttonLabel" :title="buttonLabel" @click="onConnection"><Glyph :icon="disconnecting ? unplugIcon : plugIcon" /></button>
    </div>
  </form>
</template>
