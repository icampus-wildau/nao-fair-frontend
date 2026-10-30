import { ref, watch, type Ref } from 'vue'
export function readLocal<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(`nao-fair.${key}`); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback } }
export function writeLocal(key: string, value: unknown) { try { if (value === null) localStorage.removeItem(`nao-fair.${key}`); else localStorage.setItem(`nao-fair.${key}`, JSON.stringify(value)) } catch { /* Storage can be disabled. */ } }
export function localRef<T>(key: string, fallback: T): Ref<T> { const value = ref(readLocal(key, fallback)) as Ref<T>; watch(value, next => writeLocal(key, next), { deep: true }); return value }
export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url) }
