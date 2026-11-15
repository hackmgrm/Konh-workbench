import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
    entryPoints: [fileURLToPath(new URL("./taskCompletion.ts", import.meta.url))],
    bundle: true, platform: "node", format: "esm", write: false
});
const { toggleTask } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"));

const task = (repeat, due) => ({ id: "t", title: "Recurring", note: "", done: false, important: true, urgent: false, created: 1, doneAt: 0, due, start: "", repeat, url: "", category: "work", subtasks: [{ id: "s", title: "Step", done: true }], reminder: 0, tags: ["x"] });

test("completion creates one clean successor with the next due date", () => {
    for (const [rule, due, expected] of [["daily", "2026-05-01", "2026-05-02"], ["weekday", "2026-05-01", "2026-05-04"], ["weekly", "2026-05-01", "2026-05-08"], ["monthly", "2026-01-31", "2026-02-28"]]) {
        const result = toggleTask([task(rule, due)], "t", 100);
        assert.equal(result.length, 2);
        assert.equal(result[0].due, expected);
        assert.equal(result[0].done, false);
        assert.equal(result[0].subtasks[0].done, false);
        assert.equal(result[1].done, true);
        assert.equal(toggleTask(result, "t", 101, true).length, 2);
    }
});

test("undo removes only the untouched generated occurrence", () => {
    const original = task("daily", "2026-05-01");
    const completed = toggleTask([original], "t", 100);
    assert.equal(toggleTask(completed, "t").length, 1);
    const changed = completed.map((t) => t.id === "t::repeat" ? { ...t, title: "Edited" } : t);
    assert.equal(toggleTask(changed, "t").length, 2);
});
