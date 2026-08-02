export type Score = string

export const NullMidiChar = ' '
const MIDI_MIN = 24; // C2
const CHAR_BASE = 33; // '!'
const MIDI_MAX = 90

export function decodeCharToMidi(char: string) {
    return char.charCodeAt(0) - CHAR_BASE + MIDI_MIN;
}

export function encodeMidiToChar(midi: number) {
    return String.fromCharCode(midi - MIDI_MIN + CHAR_BASE);
}

export function isInvalidMidiRange(midi?: number) {
    return !midi || midi < MIDI_MIN || midi > MIDI_MIN + MIDI_MAX
}

interface Note {
    freq: number
    startSample: number
    endSample: number
}


const ENVELOPE_RATE = 240; // Hz, matches NES frame sequencer clock

function envelopeLevel(sinceStartSample: number, sampleRate: number, period: number, loop: boolean): number {
    // how many 240Hz envelope clocks have elapsed since note start
    const envClocks = Math.floor((sinceStartSample / sampleRate) * ENVELOPE_RATE);

    // decay steps once every (period + 1) envelope clocks
    const decaySteps = Math.floor(envClocks / (period + 1));

    if (loop) {
        return 15 - (decaySteps % 16); // wraps 15,14,...,0,15,14,...
    }
    return Math.max(0, 15 - decaySteps); // holds at 0 once fully decayed
}

function distort(x: number, amount: number): number {
    // amount: 0 = clean, higher = crunchier. tanh-style soft clip
    return Math.tanh(x * (1 + amount * 5));
}

// hard clip variant — harsher, more "digital crunch"
function hardClip(x: number, drive: number): number {
    return Math.max(-1, Math.min(1, x * drive));
}
function pulseAt(freq: number, t: number, duty: number): number {
    const phase = (freq * t) % 1;
    return phase < duty ? 1 : -1;
}
function pseudoNoise(sampleIndex: number): number {
    // cheap deterministic "noise" from a hash — stays stateless (same trick as your phase calc)
    const x = Math.sin(sampleIndex * 12.9898) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
}
function bitcrush(x: number, bits: number): number {
    const levels = Math.pow(2, bits);
    return Math.round(x * levels) / levels;
}

function midiToHz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export class WasmCore {

    private notes: Note[] = []
    private durationSeconds = 0;


    getDurationSeconds() {
        return this.durationSeconds
    }

    constructor(private sampleRate: number) { }

    load_score(score: string, dur: number) {
        this.notes = []
        let maxEnd = 0

        let start: number = 0
        for (let i = 0; i < score.length; i++) {
            if (score[i] !== NullMidiChar) {
                let midi = decodeCharToMidi(score[i])
                const freq = midiToHz(midi)
                const startSample = Math.round(start * this.sampleRate)
                const endSample = Math.round((start + dur) * this.sampleRate)
                this.notes.push({ freq, startSample, endSample })
            }
            maxEnd = Math.max(maxEnd, start + dur)
            start += dur
        }
        this.durationSeconds = maxEnd
    }


    next_sample(sinceStart: number): number {
        let sample = 0;
        let activeCount = 0;

        for (const note of this.notes) {
            if (sinceStart >= note.startSample && sinceStart < note.endSample) {
                const t = sinceStart / this.sampleRate;

                const duty = 0.3;

                const detuneCents = 4
                const detuneRatio = Math.pow(2, detuneCents / 1200)

                const voice1 = pulseAt(note.freq, t, duty)
                const voice2 = pulseAt(note.freq * detuneRatio, t, duty)
                const voice3 = pulseAt(note.freq / detuneRatio, t, duty)

                let voice = (voice1 + voice2 + voice3) / 3

                const sub = pulseAt(note.freq / 2, t, 0.5) * 0.4
                voice = voice * 0.7 + sub * 0.2

                const sinceNoteStart = sinceStart - note.startSample

                const envPeriod = 8
                const envLoop = false
                const level = envelopeLevel(sinceNoteStart, this.sampleRate, envPeriod, envLoop)
                voice *= level / 15

                let drive = 0.01
                voice = distort(voice, drive)
                let noiseMix = 0.001
                voice += pseudoNoise(sinceStart) * noiseMix

                sample += voice;
                activeCount++;
            }
        }

        let out = activeCount > 0 ? sample / activeCount : 0;

        let bitdepth = 4
        out = bitcrush(out, bitdepth)

        return hardClip(out, 0.98)
    }

    static init = async (sampleRate: number) => {
        return new WasmCore(sampleRate)
    }

}