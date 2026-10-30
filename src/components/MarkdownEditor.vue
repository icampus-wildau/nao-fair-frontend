<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"

const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ "update:modelValue": [string] }>()
const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null
const editable = new Compartment()

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        editable.of([EditorView.editable.of(!props.disabled), EditorState.readOnly.of(Boolean(props.disabled))]),
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit("update:modelValue", update.state.doc.toString())
        }),
      ],
    }),
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  },
)

watch(() => props.disabled, (disabled) => view?.dispatch({ effects: editable.reconfigure([EditorView.editable.of(!disabled), EditorState.readOnly.of(Boolean(disabled))]) }))

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="editor-host"></div>
</template>
