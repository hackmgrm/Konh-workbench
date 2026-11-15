import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
    entryPoints: [fileURLToPath(new URL("./time.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false
});
const { extractDateMention } = await import(
    "data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64")
);

test("从任务文字识别中文日期和日期区间", () => {
    assert.equal(extractDateMention("活动将于2027年3月15日至16日在上海世贸展览馆举办"), "03/15–03/16");
    assert.equal(extractDateMention("会议安排在2027年11月2日"), "11/02");
    assert.equal(extractDateMention("2027年3月15日至2027年4月2日"), "03/15–04/02");
    assert.equal(extractDateMention("没有明确日期的描述"), "");
});

test("拒绝无效的中文日期", () => {
    assert.equal(extractDateMention("活动时间：2027年2月30日"), "");
    assert.equal(extractDateMention("活动时间：2027年3月15日至2月30日"), "03/15");
});
