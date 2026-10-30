// Streaming downmix and resampling to 20 ms of PCM16 at 16 kHz.
// The AudioContext may run at the device's native rate (often 44.1/48 kHz).
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ratio = sampleRate / 16000
    this.enabled = false
    this.port.onmessage = (event) => {
      this.enabled = event.data.enabled === true
      this.reset()
    }
    this.reset()
  }

  reset() {
    this.remaining = this.ratio
    this.sum = 0
    this.buffer = new ArrayBuffer(640)
    this.view = new DataView(this.buffer)
    this.offset = 0
    this.energy = 0
  }

  process(inputs) {
    const channels = inputs[0]
    if (!this.enabled || !channels?.length) return true
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0
      for (const channel of channels) value += channel[i] / channels.length
      let weight = 1
      while (weight > 1e-8) {
        const part = Math.min(weight, this.remaining)
        this.sum += value * part
        this.remaining -= part
        weight -= part
        if (this.remaining < 1e-8) {
          const sample = Math.max(-1, Math.min(1, this.sum / this.ratio))
          this.energy += sample * sample
          this.view.setInt16(this.offset * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
          this.offset++
          this.sum = 0
          this.remaining = this.ratio
          if (this.offset === 320) {
            this.port.postMessage({ audio: this.buffer, level: Math.sqrt(this.energy / 320) }, [this.buffer])
            this.buffer = new ArrayBuffer(640)
            this.view = new DataView(this.buffer)
            this.offset = 0
            this.energy = 0
          }
        }
      }
    }
    return true
  }
}

registerProcessor("nao-microphone", MicrophoneProcessor)
