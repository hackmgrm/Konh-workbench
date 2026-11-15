import { writable, get, type Writable } from "svelte/store";
import {
    defaultSettings, DEFAULT_CATEGORIES,
    type Task, type Sticky, type FocusRecord, type Settings, type DiaryMap,
    type Category, type Habit, type Countdown, type FavItem, type JournalEntry
} from "./types";

export const tasks = writable<Task[]>([]);
export const stickies = writable<Sticky[]>([]);
export const focusRecords = writable<FocusRecord[]>([]);
export const diaries = writable<DiaryMap>({});
export const settings = writable<Settings>(defaultSettings());
export const categories = writable<Category[]>(DEFAULT_CATEGORIES);
export const habits = writable<Habit[]>([]);
export const countdowns = writable<Countdown[]>([]);
export const favorites = writable<FavItem[]>([]);

/** 完成时的轻提示 */
export const celebration = writable<string>("");
let celebrateTimer: number | null = null;
export function celebrate(text: string): void {
    celebration.set(text);
    if (celebrateTimer) window.clearTimeout(celebrateTimer);
    celebrateTimer = window.setTimeout(() => celebration.set(""), 2400);
}

export type StoreKey =
    | "tasks" | "stickies" | "focus" | "diaries" | "settings" | "categories"
    | "habits" | "countdowns" | "favorites";

const registry: Record<StoreKey, Writable<unknown>> = {
    tasks: tasks as unknown as Writable<unknown>,
    stickies: stickies as unknown as Writable<unknown>,
    focus: focusRecords as unknown as Writable<unknown>,
    diaries: diaries as unknown as Writable<unknown>,
    settings: settings as unknown as Writable<unknown>,
    categories: categories as unknown as Writable<unknown>,
    habits: habits as unknown as Writable<unknown>,
    countdowns: countdowns as unknown as Writable<unknown>,
    favorites: favorites as unknown as Writable<unknown>
};

type Saver = (key: StoreKey, data: unknown) => void | Promise<void>;

let saver: Saver = async () => {};
const timers: Partial<Record<StoreKey, number>> = {};
const writes: Partial<Record<StoreKey, Promise<void>>> = {};

function enqueue(key: StoreKey): void {
    // Capture a snapshot now, not when an earlier asynchronous write completes.
    const data: unknown = JSON.parse(JSON.stringify(get(registry[key])));
    const write = (writes[key] || Promise.resolve()).catch(() => {}).then(() => saver(key, data));
    writes[key] = write;
    void write.catch((e) => console.error("[tongyun] save failed", key, e));
}

export async function flushSaves(): Promise<void> {
    for (const key of Object.keys(timers) as StoreKey[]) {
        window.clearTimeout(timers[key]);
        delete timers[key];
        enqueue(key);
    }
    const results = await Promise.allSettled(Object.values(writes));
    if (results.some((result) => result.status === "rejected")) {
        throw new Error("部分数据保存失败，请查看控制台");
    }
} 

export function bindSaver(fn: Saver): void {
    saver = fn;
}

export function save(key: StoreKey, immediate = false): void {
    if (timers[key] !== undefined) {
        window.clearTimeout(timers[key]);
        delete timers[key];
    }
    if (immediate) {
        enqueue(key);
        return;
    }
    timers[key] = window.setTimeout(() => {
        delete timers[key];
        enqueue(key);
    }, 160);
}

export function uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function hydrate(data: {
    tasks?: Task[] | null;
    stickies?: Sticky[] | null;
    focus?: FocusRecord[] | null;
    diaries?: DiaryMap | null;
    settings?: Partial<Settings> | null;
    categories?: Category[] | null;
    habits?: Habit[] | null;
    countdowns?: Countdown[] | null;
    favorites?: FavItem[] | null;
}): void {
    if (Array.isArray(data.tasks)) {
        tasks.set(
            data.tasks.map((t) => {
                // 兼容上游字段 dueDate；本插件内部统一使用 due。
                const raw = t as Task & { dueDate?: string };
                return {
                id: t.id || uid(),
                title: t.title || "",
                note: t.note || "",
                done: !!t.done,
                important: !!t.important,
                urgent: !!t.urgent,
                created: t.created || Date.now(),
                doneAt: t.doneAt || 0,
                due: t.due || raw.dueDate || "",
                start: t.start || "",
                repeat: t.repeat || "none",
                url: t.url || "",
                project: typeof t.project === "string" ? t.project : "",
                category: t.category || "none",
                subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
                reminder: typeof t.reminder === "number" ? t.reminder : 0,
                tags: Array.isArray(t.tags) ? t.tags : [],
                isFavorite: !!t.isFavorite,
                isPinned: !!t.isPinned,
                isEvening: !!t.isEvening,
                description: typeof t.description === "string" ? t.description : ""
                };
            })
        );
    }
    if (Array.isArray(data.stickies)) {
        stickies.set(
            data.stickies.map((s) => ({
                id: s.id || uid(),
                title: s.title || "",
                text: s.text || "",
                created: s.created || Date.now(),
                color: s.color || "#fff9c4",
                pinType: s.pinType || ("pin" as const),
                rotate: typeof s.rotate === "number" ? s.rotate : 0
            }))
        );
    }
    if (Array.isArray(data.focus)) focusRecords.set(data.focus);
    if (Array.isArray(data.categories)) categories.set(data.categories);
    if (Array.isArray(data.habits)) habits.set(data.habits);
    if (Array.isArray(data.countdowns)) countdowns.set(data.countdowns);
    if (Array.isArray(data.favorites)) favorites.set(data.favorites);
    if (data.diaries && typeof data.diaries === "object") {
        const fixed: DiaryMap = {};
        Object.keys(data.diaries).forEach((k) => {
            const v = (data.diaries as Record<string, unknown>)[k];
            if (typeof v === "string") {
                fixed[k] = { content: v, mood: -1, tags: [], aiComment: "", updatedAt: 0 };
            } else if (v && typeof v === "object") {
                const o = v as Partial<JournalEntry>;
                fixed[k] = {
                    content: o.content || "",
                    mood: typeof o.mood === "number" ? o.mood : -1,
                    tags: Array.isArray(o.tags) ? o.tags : [],
                    aiComment: o.aiComment || "",
                    updatedAt: o.updatedAt || 0
                };
            }
        });
        diaries.set(fixed);
    }

    const base = defaultSettings();
    if (data.settings && typeof data.settings === "object") {
        settings.set({
            ...base,
            ...data.settings,
            ai: { ...base.ai, ...(data.settings.ai || {}) },
            widgetPos: { ...base.widgetPos, ...(data.settings.widgetPos || {}) }
        });
    }
}
