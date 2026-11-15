import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const timers = new Map();
let nextId = 1;
globalThis.window = {
    setInterval(fn) { const id = nextId++; timers.set(id, { fn, repeat: true }); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout(fn, delay) { const id = nextId++; timers.set(id, { fn, repeat: false, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
};

const result = await build({
    stdin: { contents: 'export * from "./timer.ts"; export { settings, hydrate } from "./store.ts"; export { get } from "svelte/store";', resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false
});
const timer = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"));
const { get, settings } = timer;

let now = 1_000_000;
Date.now = () => now;

function runIntervals() {
    [...timers.values()].filter((x) => x.repeat).forEach((x) => x.fn());
}
function pendingAutoStarts() {
    return [...timers.values()].filter((x) => !x.repeat && x.delay === 800).length;
}
function configure(values) {
    timers.clear();
    now += 10_000;
    settings.set({ focusMin: 1, breakMin: 1, longBreakMin: 2, longBreakEvery: 4, autoBreak: true, ...values });
    timer.initializeTimerAfterHydrate();
}

test("uses wall-clock deadline when the interval is delayed", () => {
    configure({});
    timer.pomodoro.start();
    now += 65_000;
    runIntervals();
    assert.equal(get(timer.timerState).mode, "break");
    assert.equal(get(timer.timerState).finishedPulse, 1);
    timer.pomodoro.destroy();
});

test("reset, pause, and destroy cancel pending automatic starts", () => {
    configure({});
    timer.pomodoro.start();
    now += 60_000;
    runIntervals();
    assert.equal(pendingAutoStarts(), 1);
    timer.pomodoro.reset();
    assert.equal(pendingAutoStarts(), 0);

    timer.pomodoro.start();
    now += 60_000;
    timer.pomodoro.pause();
    assert.equal(pendingAutoStarts(), 0);

    timer.pomodoro.reset();
    timer.pomodoro.start();
    now += 60_000;
    runIntervals();
    timer.pomodoro.destroy();
    assert.equal(pendingAutoStarts(), 0);
});

test("autoBreak false does not schedule a long break", () => {
    configure({ autoBreak: false, longBreakEvery: 1 });
    timer.pomodoro.start();
    now += 60_000;
    runIntervals();
    const state = get(timer.timerState);
    assert.equal(state.mode, "focus");
    assert.equal(state.running, false);
    assert.equal(pendingAutoStarts(), 0);
    timer.pomodoro.destroy();
});

test("initialization after hydrate applies hydrated focus duration", () => {
    timer.hydrate({ settings: { focusMin: 37 } });
    timer.initializeTimerAfterHydrate();
    const state = get(timer.timerState);
    assert.equal(state.mode, "focus");
    assert.equal(state.left, 37 * 60);
    assert.equal(state.total, 37 * 60);
    timer.pomodoro.destroy();
});
