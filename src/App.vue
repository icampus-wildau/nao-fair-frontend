<script setup lang="ts">
import AppShell from "./components/AppShell.vue"
</script>

<template>
  <UApp :tooltip="{ delayDuration: 600, skipDelayDuration: 0 }">
    <AppShell>
      <RouterView />
    </AppShell>
  </UApp>
</template>
