import { writable, get } from "svelte/store";
import { settings, focusRecords, tasks, save, uid } from "./store";
import { dayKey } from "./time";

export type TimerMode = "focus" | "break" | "longBreak";

export interface TimerState {
    running: boolean;
    mode: TimerMode;
    left: number;
    total: number;
    round: number;
    taskId: string;
    finishedPulse: number;
}

function initial(): TimerState {
    const min = get(settings).focusMin || 25;
    return {
        running: false,
        mode: "focus",
        left: min * 60,
        total: min * 60,
        round: 0,
        taskId: "",
        finishedPulse: 0
    };
}

export const timerState = writable<TimerState>(initial());

class Pomodoro {
    private id: number | null = null;
    private autoStartId: number | null = null;
    private deadline: number | null = null;
    private state: TimerState = initial();
    private listeners: Array<(e: { mode: TimerMode; minutes: number }) => void> = [];

    constructor() {
        timerState.subscribe((s) => {
            this.state = s;
        });
    }

    onChange(fn: (e: { mode: TimerMode; minutes: number }) => void): void {
        this.listeners.push(fn);
    }

    private duration(mode: TimerMode): number {
        const s = get(settings);
        if (mode === "focus") return Math.max(1, s.focusMin) * 60;
        if (mode === "longBreak") return Math.max(1, s.longBreakMin) * 60;
        return Math.max(1, s.breakMin) * 60;
    }

    reset(mode?: TimerMode): void {
        this.stopTick();
        this.clearAutoStart();
        const next = mode || "focus";
        timerState.update((s) => ({
            ...s,
            running: false,
            mode: next,
            left: this.duration(next),
            total: this.duration(next)
        }));
    }

    start(): void {
        this.clearAutoStart();
        if (this.state.running) return;
        this.stopTick();
        this.deadline = Date.now() + this.state.left * 1000;
        timerState.update((s) => ({ ...s, running: true }));
        this.id = window.setInterval(() => this.tick(), 1000);
    }

    pause(): void {
        this.clearAutoStart();
        if (this.state.running) this.tick();
        this.stopTick();
        this.clearAutoStart();
        timerState.update((s) => ({ ...s, running: false }));
    }

    toggle(): void {
        if (this.state.running) this.pause();
        else this.start();
    }

    private clearAutoStart(): void {
        if (this.autoStartId !== null) {
            window.clearTimeout(this.autoStartId);
            this.autoStartId = null;
        }
    }

    private stopTick(): void {
        this.deadline = null;
        if (this.id !== null) {
            window.clearInterval(this.id);
            this.id = null;
        }
    }

    destroy(): void {
        this.stopTick();
        this.clearAutoStart();
        timerState.update((s) => ({ ...s, running: false }));
        this.listeners = [];
    }

    /** Call once after the parent has completed store.hydrate(). */
    initializeAfterHydrate(): void {
        this.reset("focus");
    }

    private tick(): void {
        if (this.deadline === null) return;
        const left = Math.ceil((this.deadline - Date.now()) / 1000);
        if (left <= 0) {
            timerState.update((s) => ({ ...s, left: 0, running: false }));
            this.stopTick();
            this.complete();
            return;
        }
        timerState.update((s) => ({ ...s, left }));
    }

    private complete(): void {
        const mode = this.state.mode;
        const minutes = Math.round(this.state.total / 60);
        const s = get(settings);

        if (mode === "focus") {
            focusRecords.update((list) => [
                ...list,
                {
                    id: uid(),
                    day: dayKey(),
                    at: Date.now(),
                    minutes,
                    taskId: this.state.taskId || ""
                }
            ]);
            save("focus");

            const round = this.state.round + 1;
            const nextMode: TimerMode =
                !s.autoBreak ? "focus" : round % Math.max(1, s.longBreakEvery) === 0 ? "longBreak" : "break";

            timerState.update((st) => ({
                ...st,
                running: false,
                round,
                mode: nextMode,
                left: this.duration(nextMode),
                total: this.duration(nextMode),
                finishedPulse: st.finishedPulse + 1
            }));
            if (s.autoBreak) {
                // Schedule before notifying listeners so reset/pause/destroy can cancel it.
                this.autoStartId = window.setTimeout(() => {
                    this.autoStartId = null;
                    this.start();
                }, 800);
            }
            this.fire({ mode, minutes });
        } else {
            timerState.update((st) => ({
                ...st,
                running: false,
                mode: "focus",
                left: this.duration("focus"),
                total: this.duration("focus"),
                finishedPulse: st.finishedPulse + 1
            }));
            this.fire({ mode, minutes });
        }
    }

    private fire(e: { mode: TimerMode; minutes: number }): void {
        this.listeners.forEach((fn) => {
            try { fn(e); } catch { /* ignore */ }
        });
    }
}

export const pomodoro = new Pomodoro();

/** The parent must call this immediately after hydrate() to apply hydrated durations. */
export function initializeTimerAfterHydrate(): void {
    pomodoro.initializeAfterHydrate();
}

export function attachCurrentTask(taskId: string): void {
    timerState.update((s) => ({ ...s, taskId }));
}

export function focusTaskTitle(): string {
    if (!timerState || !get(timerState).taskId) return "";
    const id = get(timerState).taskId;
    const t = get(tasks).find((x) => x.id === id);
    return t ? t.title : "";
}
