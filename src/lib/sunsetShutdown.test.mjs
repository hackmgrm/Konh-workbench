import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
    entryPoints: [fileURLToPath(new URL("./sunsetShutdown.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false
});
const { calculateSunsetStats, getTomorrowString, shouldPromptSunsetShutdown } = await import(
    "data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64")
);

const task = (id, due, done = false, doneAt = 0) => ({
    id, title: id, note: "", done, important: false, urgent: false, created: 1, doneAt,
    due, start: "", repeat: "none", url: "", category: "none", subtasks: [], reminder: 0, tags: []
});

test("汇总今日完成、番茄和逾期未完成任务", () => {
    const today = "2026-11-15";
    const start = new Date(`${today}T09:00:00`).getTime();
    const stats = calculateSunsetStats(
        [task("done", today, true, start), task("overdue", "2026-11-14"), task("future", "2026-11-16")],
        [{ id: "p1", day: today, at: start, minutes: 25, taskId: "done" }, { id: "p2", day: today, at: start, minutes: 15, taskId: "" }],
        today
    );
    assert.equal(stats.completedCount, 1);
    assert.equal(stats.totalFocusMinutes, 40);
    assert.equal(stats.pomodoroCount, 2);
    assert.deepEqual(stats.uncompletedTasks.map((item) => item.id), ["overdue"]);
});

test("日落流程每天只提示一次并正确计算明日", () => {
    const evening = new Date("2026-11-15T18:00:00");
    assert.equal(shouldPromptSunsetShutdown(evening, null, 18), true);
    assert.equal(shouldPromptSunsetShutdown(evening, "2026-11-15", 18), false);
    assert.equal(shouldPromptSunsetShutdown(new Date("2026-11-15T17:59:00"), null, 18), false);
    assert.equal(getTomorrowString(evening), "2026-11-16");
});
