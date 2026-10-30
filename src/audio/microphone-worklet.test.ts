import workletSource from "./microphone-worklet.js?raw"
import { describe, expect, it } from "vitest"

function encoder(rate: number) {
  const messages: { audio: ArrayBuffer; level: number }[] = []
  interface Processor {
    port: { onmessage: (event: { data: { enabled: boolean } }) => void }
    process: (inputs: Float32Array[][]) => boolean
  }
  let Registered!: new () => Processor
  const install = new Function("sampleRate", "AudioWorkletProcessor", "registerProcessor", workletSource)
  install(rate,
    class { port = { onmessage: null, postMessage: (message: { audio: ArrayBuffer; level: number }) => messages.push(message) } },
    (_name: string, processor: new () => Processor) => { Registered = processor },
  )
  return { processor: new Registered(), messages }
}

describe("browser microphone PCM wire format", () => {
  it.each([16000, 44100, 48000])("encodes one second at %i Hz as 50 little-endian 20 ms packets", (rate) => {
    const { processor, messages } = encoder(rate)
    processor.port.onmessage({ data: { enabled: true } })
    for (let offset = 0; offset < rate; offset += 128) processor.process([[new Float32Array(Math.min(128, rate - offset)).fill(.25)]])
    expect(messages).toHaveLength(50)
    expect(messages.every(message => message.audio.byteLength === 640)).toBe(true)
    expect(new DataView(messages[0]!.audio).getInt16(0, true)).toBe(8192)
    expect(messages[0]!.level).toBeCloseTo(.25)
  })

  it("downmixes stereo and discards partial audio when muted", () => {
    const { processor, messages } = encoder(16000)
    processor.port.onmessage({ data: { enabled: true } })
    processor.process([[new Float32Array(160).fill(1)]])
    processor.port.onmessage({ data: { enabled: false } })
    processor.process([[new Float32Array(320).fill(1)]])
    expect(messages).toHaveLength(0)
    processor.port.onmessage({ data: { enabled: true } })
    processor.process([[new Float32Array(320).fill(1), new Float32Array(320).fill(-1)]])
    expect(messages).toHaveLength(1)
    expect(new DataView(messages[0]!.audio).getInt16(0, true)).toBe(0)
    expect(messages[0]!.level).toBe(0)
  })
})
