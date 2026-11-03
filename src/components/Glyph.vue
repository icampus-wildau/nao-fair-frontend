<script setup lang="ts">
import type { IconifyIcon } from "@iconify/vue"

defineProps<{ icon: IconifyIcon }>()
</script>

<template>
  <!-- Remount when the glyph changes so setup draws the new path. -->
  <Icon :key="icon.body" :icon="icon" :ssr="true" width="18" height="18" aria-hidden="true" />
</template>
