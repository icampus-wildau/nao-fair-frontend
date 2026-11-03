<script setup lang="ts">
import { computed } from 'vue'
import { useConsole } from '../stores/console'
defineProps<{ inputId: string }>()
const store = useConsole()
const connected = computed(() => store.view.connectionState === 'connected')
const buttonLabel = computed(() => connected.value || store.pendingConnect ? 'Trennen' : 'Verbinden')
function onConnection() {
  if (connected.value || store.pendingConnect) store.disconnect()
  else store.connect()
}
</script>
<template>
  <form class="connect" @submit.prevent="!connected && !store.pendingConnect && store.connect()">
    <label :for="inputId">IP-Adresse</label>
    <input :id="inputId" :value="store.address.value" inputmode="decimal" autocomplete="off" spellcheck="false" :aria-invalid="store.addressError ? 'true' : undefined" @input="store.setAddress(($event.target as HTMLInputElement).value)" />
    <button class="btn" type="button" @click="onConnection">{{ buttonLabel }}</button>
  </form>
</template>
