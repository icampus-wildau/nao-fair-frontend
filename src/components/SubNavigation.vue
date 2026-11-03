<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ label: string; current: string }>()
const open = ref(false)
function closeOnBlur(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) open.value = false
}
function select(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('button, a')) open.value = false
}
</script>
<template>
  <nav class="subnav" :aria-label="label" @keydown.esc="open = false" @focusout="closeOnBlur">
    <button type="button" class="subnav-trigger" :aria-expanded="open" @click="open = !open">{{ current }} <span aria-hidden="true">▾</span></button>
    <div class="subnav-items" :class="{ 'is-open': open }" @click="select"><slot /></div>
  </nav>
</template>
