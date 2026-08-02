import type { Score, WasmCore } from "./wasmcore"


export class WasmSynth {
    startFrame = 0

    constructor(readonly wasm: WasmCore, readonly sampleRate: number) { }

    playMusic(score: Score, dur: number, startTime: number) {
        this.startFrame = Math.round(startTime * this.sampleRate)
        this.wasm.load_score(score, dur)
    }

    process(frame: number) {
        const sinceStart = frame - this.startFrame
        if (sinceStart < 0) return 0
        return this.wasm.next_sample(sinceStart)
    }

    createAudioBuffer = (cx: AudioContext, score: Score, dur: number) => {
        this.playMusic(score, dur, 0)
        let length = Math.round(this.wasm.getDurationSeconds() * this.sampleRate)
        let buffer = cx.createBuffer(1, length, this.sampleRate)
        let data = buffer.getChannelData(0)


        for (let n = 0; n < length; n++) {
            data[n] = this.process(n)
        }
        return buffer
    }

}