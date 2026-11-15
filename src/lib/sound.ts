/** 程序生成的轻量音效，不依赖音频文件 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
    enabled = on;
}

function ensure(): AudioContext | null {
    if (!enabled) return null;
    if (!ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0): void {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

/** 便签贴上：短促的纸感 */
export function sfxPaste(): void {
    tone(520, 0.09, "triangle", 0.06);
}

/** 改色 / 轻触：气泡 */
export function sfxBubble(): void {
    tone(880, 0.07, "sine", 0.05);
}

/** 翻纸 / 删除 */
export function sfxPaper(): void {
    tone(300, 0.12, "sawtooth", 0.035);
}

/** 完成任务：两声上行 */
export function sfxDone(): void {
    tone(660, 0.12, "sine", 0.08);
    tone(990, 0.18, "sine", 0.07, 0.1);
}

/** 全部清空：三个音上行 */
export function sfxAllDone(): void {
    tone(523, 0.14, "sine", 0.08);
    tone(659, 0.14, "sine", 0.08, 0.12);
    tone(784, 0.26, "sine", 0.08, 0.24);
}

/** 番茄完成 */
export function sfxBell(): void {
    tone(880, 0.5, "sine", 0.09);
    tone(1320, 0.4, "sine", 0.04, 0.02);
}
