import { get } from "svelte/store";
import { tasks, stickies, focusRecords, diaries, settings, categories, habits, countdowns, favorites, save, flushSaves, type StoreKey } from "./store";
import type { Task, Sticky, FocusRecord, DiaryMap, Settings, Category, Habit, Countdown, FavItem } from "./types";

const FORMAT = "tongyun-workbench-json-v1";
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const keys = ["tasks", "stickies", "focus", "diaries", "settings", "categories", "habits", "countdowns", "favorites"] as const;
export interface BackupData {
    tasks: Task[]; stickies: Sticky[]; focus: FocusRecord[]; diaries: DiaryMap;
    settings: Settings; categories: Category[]; habits: Habit[]; countdowns: Countdown[]; favorites: FavItem[];
}

export function snapshot(): BackupData {
    return { tasks: get(tasks), stickies: get(stickies), focus: get(focusRecords), diaries: get(diaries), settings: get(settings), categories: get(categories), habits: get(habits), countdowns: get(countdowns), favorites: get(favorites) };
}

export function exportBackup(includeKey = false): string {
    const data = snapshot();
    return JSON.stringify({ format: FORMAT, data: { ...data, settings: { ...data.settings, ai: { ...data.settings.ai, key: includeKey ? data.settings.ai.key : "" } } } }, null, 2);
}

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => v !== null && typeof v === "object" && !Array.isArray(v);
const fields = (v: unknown, spec: Record<string, string>): v is RecordValue => record(v) && Object.entries(spec).every(([k, t]) => typeof v[k] === t && (t !== "number" || Number.isFinite(v[k])));
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === "string");
const id = (v: RecordValue) => typeof v.id === "string" && v.id.trim().length > 0;
const list = (v: unknown, check: (x: RecordValue) => boolean) => Array.isArray(v) && v.every(x => record(x) && id(x) && check(x));
const basic = (spec: Record<string, string>) => (v: RecordValue) => fields(v, spec);

export function parseBackup(text: string): BackupData {
    if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("备份文件超过 20 MB");
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error("不是有效的 JSON 文件"); }
    if (!record(raw) || raw.format !== FORMAT || !record(raw.data)) throw new Error("备份格式或版本不受支持");
    const d = raw.data;
    const checks: Record<string, boolean> = {
        tasks: list(d.tasks, v => fields(v, { title: "string", note: "string", done: "boolean", important: "boolean", urgent: "boolean", created: "number", doneAt: "number", due: "string", start: "string", repeat: "string", url: "string", category: "string", reminder: "number" }) && ["none", "daily", "weekday", "weekly", "monthly"].includes(v.repeat as string) && strings(v.tags) && list(v.subtasks, basic({ title: "string", done: "boolean" }))),
        stickies: list(d.stickies, v => fields(v, { title: "string", text: "string", created: "number", color: "string", pinType: "string", rotate: "number" }) && ["pin", "tape", "clip", "heart", "smiley"].includes(v.pinType as string)),
        focus: list(d.focus, basic({ day: "string", at: "number", minutes: "number", taskId: "string" })),
        categories: list(d.categories, basic({ name: "string", color: "string" })),
        habits: list(d.habits, v => fields(v, { name: "string", emoji: "string", color: "string", target: "number", created: "number" }) && record(v.records) && Object.values(v.records).every(n => typeof n === "number" && Number.isFinite(n))),
        countdowns: list(d.countdowns, basic({ title: "string", date: "string", emoji: "string", created: "number" })),
        favorites: list(d.favorites, basic({ title: "string", url: "string", source: "string", note: "string", created: "number" })),
        diaries: record(d.diaries) && Object.entries(d.diaries).every(([day, v]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && fields(v, { content: "string", mood: "number", aiComment: "string", updatedAt: "number" }) && strings(v.tags)),
        settings: fields(d.settings, { focusMin: "number", breakMin: "number", longBreakMin: "number", longBreakEvery: "number", autoBreak: "boolean", dailyGoal: "number", weatherCity: "string", noiseVolume: "number", noiseType: "string", widgetOn: "boolean", accent: "string", dark: "boolean", soundOn: "boolean", randomBreak: "boolean", praiseOn: "boolean" }) && fields(d.settings.ai, { endpoint: "string", key: "string", model: "string" }) && fields(d.settings.widgetPos, { x: "number", y: "number" }) && list(d.settings.rssFeeds, basic({ name: "string", url: "string" }))
    };
    const invalid = keys.find(k => !checks[k]);
    if (invalid) throw new Error(`备份字段无效：${invalid}`);
    return d as unknown as BackupData;
}

function mergeList<T extends { id: string }>(current: T[], incoming: T[]): T[] {
    const ids = new Set(current.map(x => x.id));
    return [...current, ...incoming.filter(x => { if (ids.has(x.id)) return false; ids.add(x.id); return true; })];
}

export function mergeBackup(current: BackupData, incoming: BackupData): BackupData {
    const mergedDiaries = { ...current.diaries };
    for (const [day, entry] of Object.entries(incoming.diaries)) if (!(day in mergedDiaries)) mergedDiaries[day] = entry;
    const importedSettings = incoming.settings;
    const mergedSettings = {
        ...importedSettings,
        ai: { ...importedSettings.ai, key: importedSettings.ai.key || current.settings.ai.key }
    };
    return {
        tasks: mergeList(current.tasks, incoming.tasks), stickies: mergeList(current.stickies, incoming.stickies),
        focus: mergeList(current.focus, incoming.focus), diaries: mergedDiaries,
        settings: { ...mergedSettings, rssFeeds: mergeList(current.settings.rssFeeds, incoming.settings.rssFeeds) },
        categories: mergeList(current.categories, incoming.categories), habits: mergeList(current.habits, incoming.habits),
        countdowns: mergeList(current.countdowns, incoming.countdowns), favorites: mergeList(current.favorites, incoming.favorites)
    };
}

function apply(data: BackupData): void {
    tasks.set(data.tasks); stickies.set(data.stickies); focusRecords.set(data.focus); diaries.set(data.diaries);
    settings.set(data.settings); categories.set(data.categories); habits.set(data.habits); countdowns.set(data.countdowns); favorites.set(data.favorites);
}
function persist(): void { for (const key of keys) save(key as StoreKey, true); }

export async function importBackup(data: BackupData): Promise<void> {
    // Finish earlier writes before capturing the state to restore on failure.
    await flushSaves();
    const before = snapshot();
    const merged = mergeBackup(before, data);
    try {
        apply(merged);
        persist();
        await flushSaves();
    } catch (error) {
        apply(before);
        persist();
        try { await flushSaves(); } catch { throw new Error("导入保存失败，内存已恢复，但磁盘回滚失败；请检查存储并重新打开插件"); }
        throw new Error(`导入保存失败，已恢复原数据：${error instanceof Error ? error.message : String(error)}`);
    }
}
