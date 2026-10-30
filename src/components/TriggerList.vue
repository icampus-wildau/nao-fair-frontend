<script setup lang="ts">
import { computed } from 'vue'
import { alphabetical } from '../model/operator'
import { bindingLabel, type TriggerId } from '../model/triggers'
import type { TriggerRowView } from '../model/screen'
import type { TriggerBinding } from '../model/types'
import InfoTip from './InfoTip.vue'
const props = defineProps<{ rows: TriggerRowView[]; selectable?: boolean; selected?: TriggerId | null; bindings?: Partial<Record<TriggerId, TriggerBinding>> }>()
const sortedRows = computed(() => alphabetical(props.rows, row => row.label))
const emit = defineEmits<{ select: [TriggerId]; enable: [TriggerId, boolean] }>()
</script>
<template>
  <div class="trigger-list">
    <div v-for="row in sortedRows" :key="row.id" class="sensor" :class="{ 'is-selected': selectable && selected === row.id }" :data-trigger="row.id" :data-pressed="row.pressed ? 'true' : 'false'">
      <span v-if="row.pressed" :key="row.pressNonce" class="sensor-flash" aria-hidden="true"></span>
      <button v-if="selectable" type="button" class="sensor-choice" :aria-pressed="selected === row.id" @click="emit('select', row.id)"><span class="sensor-name">{{ row.label }}</span><span class="sensor-action">{{ bindingLabel(row.action, row.motion) }}</span></button>
      <template v-else><span class="sensor-name">{{ row.label }}</span><span class="sensor-action">{{ bindingLabel(row.action, row.motion) }}</span></template>
      <InfoTip v-if="row.action === 'speak' && bindings" :text="bindings[row.id]?.phrase || 'Kein Text eingetragen.'" :label="`Wortlaut für ${row.label}`" />
      <input v-if="bindings" type="checkbox" :checked="bindings[row.id]?.enabled !== false" :aria-label="`${row.label} aktiv`" @change="emit('enable', row.id, ($event.target as HTMLInputElement).checked)" />
    </div>
  </div>
</template>
