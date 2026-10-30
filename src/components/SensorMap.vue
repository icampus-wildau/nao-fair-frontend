<script setup lang="ts">
import type { TriggerId } from '../model/triggers'
import type { TriggerRowView } from '../model/screen'
import robot from '../../assets/nao/NAO Sitzend (AI).png'
import head from '../../assets/nao/NAO-Robotkopf Draufsicht (AI).png'

defineProps<{ rows: TriggerRowView[]; selected?: TriggerId | null; selectable?: boolean }>()
const emit = defineEmits<{ select: [TriggerId] }>()
const positions: Record<TriggerId, { view: 'body' | 'head'; x: string; y: string }> = {
  front_head: { view: 'head', x: '50%', y: '61%' },
  middle_head: { view: 'head', x: '50%', y: '48%' },
  rear_head: { view: 'head', x: '50%', y: '24%' },
  left_hand: { view: 'body', x: '75%', y: '57%' },
  right_hand: { view: 'body', x: '25%', y: '57%' },
  left_bumper: { view: 'body', x: '75%', y: '87%' },
  right_bumper: { view: 'body', x: '25%', y: '87%' },
}
</script>

<template>
  <div class="sensor-map">
    <div v-for="view in (['body', 'head'] as const)" :key="view" class="sensor-picture" :class="`sensor-picture--${view}`">
      <img :src="view === 'body' ? robot : head" :alt="view === 'body' ? 'NAO von vorne' : 'NAO-Kopf von oben'" />
      <template v-for="row in rows" :key="row.id">
        <component
          :is="selectable ? 'button' : 'span'"
          v-if="positions[row.id]?.view === view"
          class="sensor-marker"
          :class="{ 'is-pressed': row.pressed, 'is-selected': selected === row.id }"
          :style="{ left: positions[row.id].x, top: positions[row.id].y }"
          :type="selectable ? 'button' : undefined"
          :aria-label="row.label"
          :title="row.label"
          :data-trigger="selectable ? undefined : row.id"
          :data-pressed="row.pressed ? 'true' : 'false'"
          @click="selectable && emit('select', row.id)"
        />
      </template>
      <span class="picture-caption">{{ view === 'body' ? 'Vorderansicht' : 'Kopf · Draufsicht' }}</span>
    </div>
  </div>
</template>
