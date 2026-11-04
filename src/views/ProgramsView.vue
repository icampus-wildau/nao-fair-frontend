<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { api, errorText, type ProgramInstall, type ProgramReport, type RobotProgram } from "../api/client"
import { useConsole } from "../stores/console"

const store = useConsole()

const report = ref<ProgramReport | null>(null)
const error = ref<string | null>(null)
const password = ref("")
const pending = ref<RobotProgram | null>(null)
const busy = ref(false)
let timer = 0

const actions: Record<string, string> = { install: "Installieren", update: "Aktualisieren", reinstall: "Erneut installieren" }
const runningLabel = (program: RobotProgram) => program.running === true ? "Läuft" : program.running === false ? "Läuft nicht" : "Nicht geprüft"
const versionLabel = (program: RobotProgram) => program.reported_version || "unbekannt"
const active = computed(() => {
  const job = report.value?.install
  if (!job || job.state === "done" || job.state === "failed") return null
  return job
})
const confirming = computed(() => pending.value !== null && !active.value)

async function load() {
  try {
    report.value = await api.programs()
    error.value = null
  } catch (caught) {
    error.value = errorText(caught)
  }
}

function watchInstall(job: ProgramInstall | null) {
  window.clearInterval(timer)
  if (job && job.state !== "done" && job.state !== "failed") {
    timer = window.setInterval(() => void load().then(() => watchInstall(report.value?.install ?? null)), 1000)
  }
}

async function refresh() {
  await load()
  watchInstall(report.value?.install ?? null)
}

function ask(program: RobotProgram) {
  pending.value = program
  password.value = ""
  error.value = null
}

function cancelAsk() {
  pending.value = null
  password.value = ""
}

async function submitPassword() {
  const program = pending.value
  const job = active.value
  if (!password.value) return
  busy.value = true
  try {
    if (job?.state === "password") await api.retryProgramPassword(password.value)
    else if (program) await api.installProgram(program.id, password.value)
    password.value = ""
    pending.value = null
    await refresh()
  } catch (caught) {
    error.value = errorText(caught)
  } finally {
    busy.value = false
  }
}

async function decide(accept: boolean) {
  busy.value = true
  try {
    await api.acceptHostKey(accept)
    await refresh()
  } catch (caught) {
    error.value = errorText(caught)
  } finally {
    busy.value = false
  }
}

onMounted(() => void refresh())
watch(() => store.screen.connection.address, () => void refresh())
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <article class="panel">
    <div class="panel-head"><h2>Programme</h2></div>
    <p v-if="!report && !error" class="why">Wird geladen …</p>
    <p v-if="error" class="why" role="alert">{{ error }}</p>
    <p v-if="report?.releases_error" class="why" role="alert">{{ report.releases_error }}</p>
    <p v-else-if="report && !report.address" class="why">Keine Roboteradresse gespeichert. Zuerst eine NAO verbinden.</p>
    <div class="readiness-list">
      <div v-for="program in report?.programs ?? []" :key="program.id" class="program-row">
        <div>
          <strong>{{ program.label }}</strong>
          <p class="help"><span class="readiness-state" :data-ready="program.running === true">{{ runningLabel(program) }}</span> · {{ versionLabel(program) }}<template v-if="program.latest_version"> · aktuell {{ program.latest_version }}</template></p>
        </div>
        <button v-if="program.action" type="button" class="btn" :disabled="busy || !report?.address || Boolean(active)" @click="ask(program)">{{ actions[program.action] }}</button>
      </div>
    </div>
    <form v-if="confirming && pending" class="program-dialog" @submit.prevent="submitPassword">
      <p>{{ pending.label }} wird gestoppt und durch {{ pending.latest_version || "die neueste Veröffentlichung" }} ersetzt.</p>
      <label class="field">Passwort für nao
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <div class="row-actions">
        <button type="submit" class="btn btn-lime" :disabled="busy || !password">Installieren</button>
        <button type="button" class="btn" @click="cancelAsk">Abbrechen</button>
      </div>
    </form>
    <form v-else-if="active?.state === 'password'" class="program-dialog" @submit.prevent="submitPassword">
      <p class="why">{{ active.error }}</p>
      <label class="field">Passwort für nao
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <button type="submit" class="btn btn-lime" :disabled="busy || !password">Erneut versuchen</button>
    </form>
    <section v-else-if="active?.state === 'hostkey'" class="program-dialog" role="dialog" aria-label="SSH-Hostschlüssel">
      <p v-if="active.changed">Der Hostschlüssel für {{ report?.address }} hat sich geändert.</p>
      <p v-else>Neuer SSH-Hostschlüssel für {{ report?.address }}.</p>
      <p v-if="active.previous_fingerprint" class="help">Bisher {{ active.previous_fingerprint }}</p>
      <p class="help">Neu {{ active.fingerprint }}</p>
      <div class="row-actions">
        <button type="button" class="btn btn-lime" :disabled="busy" @click="decide(true)">Annehmen</button>
        <button type="button" class="btn" :disabled="busy" @click="decide(false)">Ablehnen</button>
      </div>
    </section>
    <p v-else-if="active?.state === 'downloading' || active?.state === 'installing'" class="why">Wird installiert …</p>
    <p v-else-if="report?.install?.state === 'failed'" class="why" role="alert">{{ report.install.error }}</p>
    <p v-else-if="report?.install?.state === 'done'" class="why">Die Installation ist abgeschlossen.</p>
  </article>
</template>
