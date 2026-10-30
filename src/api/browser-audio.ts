import workletUrl from "../audio/microphone-worklet.js?url"
import type { ConversationState, TranscriptLine } from "../model/types"

interface BrowserAudioEvents {
  phase: (phase: "starting" | "active" | "stopped") => void
  state: (state: ConversationState) => void
  line: (line: TranscriptLine) => void
  level: (level: number) => void
  message: (message: string, error: boolean) => void
}

export function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "Mikrofonzugriff verweigert. Bitte die Mikrofonfreigabe für diese Seite in den Browser-Einstellungen erlauben."
  if (name === "NotFoundError") return "Kein Mikrofon gefunden. Bitte ein Mikrofon anschließen."
  if (name === "NotReadableError") return "Das Mikrofon ist belegt oder nicht verfügbar. Bitte andere Audio-Anwendungen prüfen."
  return error instanceof Error ? error.message : "Der Mikrofontest konnte nicht starten."
}

export class BrowserAudioClient {
  private generation = 0
  private socket: WebSocket | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private silent: GainNode | null = null
  private timer = 0
  private listening = false
  private utterance: SpeechSynthesisUtterance | null = null

  constructor(private events: BrowserAudioEvents) {}

  async start() {
    this.stop()
    const generation = this.generation
    this.events.phase("starting")
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Browser-Mikrofone benötigen HTTPS oder localhost. Bitte die Konsole lokal über http://127.0.0.1:8000 öffnen.")
      this.context = new AudioContext()
      await this.context.resume()
      if (generation !== this.generation) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false })
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      this.stream = stream
      stream.getAudioTracks().forEach(track => track.addEventListener("ended", () => {
        if (generation === this.generation) this.fail("Die Mikrofonverbindung wurde beendet. Bitte den Test erneut starten.")
      }))
      const context = this.context!
      if (!context.audioWorklet) throw new Error("Dieser Browser unterstützt die Mikrofonverarbeitung nicht. Bitte einen aktuellen Browser verwenden.")
      await context.audioWorklet.addModule(workletUrl)
      if (generation !== this.generation) return
      this.source = context.createMediaStreamSource(stream)
      this.worklet = new AudioWorkletNode(context, "nao-microphone")
      this.silent = context.createGain()
      this.silent.gain.value = 0
      this.source.connect(this.worklet).connect(this.silent).connect(context.destination)
      const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/browser-audio`)
      this.socket = socket
      this.worklet.port.onmessage = (event: MessageEvent<{ audio: ArrayBuffer; level: number }>) => {
        if (generation !== this.generation || !this.listening || socket.readyState !== WebSocket.OPEN) return
        if (socket.bufferedAmount > 64_000) {
          this.fail("Die Audioverbindung ist zu langsam. Bitte den Test erneut starten.")
          return
        }
        this.events.level(Math.min(1, event.data.level * 5))
        socket.send(event.data.audio)
      }
      this.timer = window.setTimeout(() => this.fail("Die Pipeline antwortet nicht. Bitte Server und Verbindung prüfen."), 75_000)
      socket.onmessage = (event) => {
        if (generation !== this.generation) return
        try { this.receive(JSON.parse(event.data)) }
        catch { this.fail("Der Server hat eine ungültige Audio-Nachricht gesendet.") }
      }
      socket.onerror = () => { if (generation === this.generation) this.fail("Die Audioverbindung zum Server konnte nicht hergestellt werden.") }
      socket.onclose = () => {
        if (generation === this.generation) this.fail("Die Audioverbindung wurde getrennt. Bitte den Test erneut starten.")
      }
    } catch (error) {
      if (generation === this.generation) this.fail(microphoneError(error))
    }
  }

  private receive(message: Record<string, unknown>) {
    if (message.type === "ready") {
      window.clearTimeout(this.timer)
      this.events.phase("active")
    } else if (message.type === "state") {
      const state = message.state
      if (state !== "idle" && state !== "listening" && state !== "thinking" && state !== "speaking") return
      this.listening = state === "listening"
      this.worklet?.port.postMessage({ enabled: this.listening })
      this.events.level(0)
      this.events.state(state)
    } else if (message.type === "transcript") {
      if ((message.speaker === "visitor" || message.speaker === "nao") && typeof message.id === "string" && typeof message.text === "string" && typeof message.timestamp === "string") {
        this.events.line({ id: message.id, text: message.text, speaker: message.speaker, timestamp: message.timestamp })
      }
    } else if (message.type === "speech") {
      this.speak(message)
    } else if (message.type === "speech.cancel") {
      this.cancelSpeech()
    } else if (message.type === "warning") {
      this.events.message(String(message.message), false)
    } else if (message.type === "error" || message.type === "closed") {
      this.stop()
      this.events.message(String(message.message), message.type === "error")
    }
  }

  listen() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "listen" }))
  }

  private speak(message: Record<string, unknown>) {
    this.listening = false
    this.worklet?.port.postMessage({ enabled: false })
    this.events.level(0)
    const generation = this.generation
    const acknowledge = (error = false) => {
      if (generation === this.generation && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "speech.finished", id: message.id, error }))
    }
    if (!("speechSynthesis" in window)) { acknowledge(true); return }
    const utterance = new SpeechSynthesisUtterance(String(message.text))
    this.utterance = utterance
    utterance.lang = String(message.language || "de")
    utterance.volume = Number(message.volume)
    utterance.rate = Number(message.rate)
    utterance.onend = () => { this.utterance = null; acknowledge() }
    utterance.onerror = () => { this.utterance = null; acknowledge(true) }
    try { window.speechSynthesis.speak(utterance) }
    catch { this.utterance = null; acknowledge(true) }
  }

  private cancelSpeech() {
    if (this.utterance && "speechSynthesis" in window) window.speechSynthesis.cancel()
    this.utterance = null
  }

  private fail(message: string) {
    this.stop()
    this.events.message(message, true)
  }

  stop() {
    this.generation++
    window.clearTimeout(this.timer)
    this.listening = false
    this.cancelSpeech()
    this.socket?.close()
    this.socket = null
    this.worklet?.port.close()
    this.source?.disconnect()
    this.worklet?.disconnect()
    this.silent?.disconnect()
    this.source = null
    this.worklet = null
    this.silent = null
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
    this.events.phase("stopped")
    this.events.state("idle")
    this.events.level(0)
  }
}
