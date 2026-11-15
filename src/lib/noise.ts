export type NoiseType = "white" | "brown" | "rain" | "fan";

export const NOISE_LABELS: { key: NoiseType; label: string }[] = [
    { key: "rain", label: "雨声" },
    { key: "white", label: "白噪音" },
    { key: "brown", label: "棕噪音" },
    { key: "fan", label: "风扇" }
];

export class NoiseEngine {
    private ctx: AudioContext | null = null;
    private source: AudioBufferSourceNode | null = null;
    private gain: GainNode | null = null;
    private filter: BiquadFilterNode | null = null;

    playing = false;
    type: NoiseType = "rain";
    volume = 0.4;

    private ensureCtx(): AudioContext | null {
        if (!this.ctx) {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") void this.ctx.resume();
        return this.ctx;
    }

    private makeBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
        const len = Math.floor(ctx.sampleRate * 4);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === "brown") {
            let last = 0;
            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                last = (last + 0.02 * w) / 1.02;
                data[i] = last * 3.2;
            }
        } else if (type === "fan") {
            let last = 0;
            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                last = last * 0.94 + w * 0.06;
                data[i] = last * 5;
            }
        } else {
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }

        // 首尾交叉淡化，避免循环接缝爆音
        const fade = Math.min(2048, Math.floor(len / 8));
        for (let i = 0; i < fade; i++) {
            const k = i / fade;
            data[i] *= k;
            data[len - 1 - i] *= k;
        }
        return buffer;
    }

    play(type?: NoiseType, volume?: number): boolean {
        const ctx = this.ensureCtx();
        if (!ctx) return false;

        this.stop();

        this.type = type || this.type;
        if (typeof volume === "number") this.volume = volume;

        const src = ctx.createBufferSource();
        src.buffer = this.makeBuffer(ctx, this.type);
        src.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.35);

        let node: AudioNode = src;
        if (this.type === "rain") {
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 1900;
            const hp = ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.value = 380;
            src.connect(lp);
            lp.connect(hp);
            node = hp;
        } else if (this.type === "fan") {
            const lp = ctx.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 760;
            src.connect(lp);
            node = lp;
        }

        node.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);

        this.source = src;
        this.gain = gain;
        this.playing = true;
        return true;
    }

    setVolume(v: number): void {
        this.volume = v;
        if (this.gain && this.ctx) {
            this.gain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.08);
        }
    }

    fadeOut(): void {
        if (this.gain && this.ctx) {
            this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.25);
        }
        const src = this.source;
        window.setTimeout(() => {
            try { src?.stop(); } catch { /* ignore */ }
            try { src?.disconnect(); } catch { /* ignore */ }
        }, 300);
        this.source = null;
        this.gain = null;
        this.playing = false;
    }

    stop(): void {
        if (this.source) {
            try { this.source.stop(); } catch { /* ignore */ }
            try { this.source.disconnect(); } catch { /* ignore */ }
        }
        this.source = null;
        this.gain = null;
        this.playing = false;
    }
}
