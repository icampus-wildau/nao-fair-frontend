<script setup lang="ts">
import { ref, watch } from 'vue'
defineProps<{ text: string; label?: string }>()
const open = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
watch(dialog, (value) => value?.showModal(), { flush: 'post' })
</script>
<template>
  <UTooltip :text="text" :delay-duration="600" :content="{ side: 'top' }">
    <button type="button" class="info-button" :aria-label="label || 'Weitere Informationen'" @click.stop.prevent="open = true">ⓘ</button>
  </UTooltip>
  <Teleport to="body">
    <dialog v-if="open" ref="dialog" :aria-label="label || 'Weitere Informationen'" @cancel.prevent="open = false" @click.stop>
      <p class="info-content">{{ text }}</p>
      <div class="dialog-actions"><button type="button" class="btn" @click="open = false">Schließen</button></div>
    </dialog>
  </Teleport>
</template>
