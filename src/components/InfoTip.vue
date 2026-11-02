<script setup lang="ts">
import { ref, watch } from 'vue'
defineProps<{ text: string; label?: string }>()
const open = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
watch(dialog, (value) => value?.showModal(), { flush: 'post' })
function dismiss(event: MouseEvent) {
  const card = dialog.value
  if (!card) return
  const box = card.getBoundingClientRect()
  const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
  if (outside) open.value = false
}
</script>
<template>
  <UTooltip :text="text" :delay-duration="600" :content="{ side: 'top' }">
    <button type="button" class="info-button" :aria-label="label || 'Weitere Informationen'" @click.stop.prevent="open = true">ⓘ</button>
  </UTooltip>
  <Teleport to="body">
    <dialog v-if="open" ref="dialog" :aria-label="label || 'Weitere Informationen'" @cancel.prevent="open = false" @click="dismiss">
      <p class="info-content">{{ text }}</p>
      <div class="dialog-actions"><button type="button" class="btn" @click="open = false">Schließen</button></div>
    </dialog>
  </Teleport>
</template>
