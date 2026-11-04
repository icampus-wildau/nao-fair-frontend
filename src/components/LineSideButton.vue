<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{ index: number; speaker?: "nao" | "human" }>()
const emit = defineEmits<{ change: [speaker: "nao" | "human"] }>()

const human = computed(() => props.speaker === "human")
const current = computed(() => human.value ? "Mensch" : "NAO")
const other = computed(() => human.value ? "NAO" : "Mensch")
const next = computed<"nao" | "human">(() => human.value ? "nao" : "human")
</script>

<template>
  <button type="button" class="dialog-speaker" :aria-label="`Zeile ${index}, ${current}. Zu ${other} wechseln.`" :title="`${current}. Zu ${other} wechseln.`" @click="emit('change', next)">{{ current }}</button>
</template>
