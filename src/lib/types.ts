export type RepeatRule = "none" | "daily" | "weekday" | "weekly" | "monthly";

export const REPEAT_LABELS: { key: RepeatRule; label: string }[] = [
    { key: "none", label: "不重复" },
    { key: "daily", label: "每天" },
    { key: "weekday", label: "每个工作日" },
    { key: "weekly", label: "每周" },
    { key: "monthly", label: "每月" }
];

export interface Subtask {
    id: string;
    title: string;
    done: boolean;
}

export interface Category {
    id: string;
    name: string;
    color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
    { id: "none", name: "无分类", color: "#8a8f98" },
    { id: "work", name: "工作", color: "#4a7fd4" },
    { id: "study", name: "学习", color: "#8b5cf6" },
    { id: "life", name: "生活", color: "#3fa66a" }
];

export interface Task {
    id: string;
    title: string;
    note: string;
    done: boolean;
    important: boolean;
    urgent: boolean;
    created: number;
    doneAt: number;
    /** 截止日期 YYYY-MM-DD，空表示没有 */
    due: string;
    /** 开始日期 YYYY-MM-DD */
    start: string;
    /** 重复规则 */
    repeat: RepeatRule;
    /** 来源链接（资讯转待办时写入） */
    url: string;
    /** 项目名称，可为空 */
    project?: string;
    /** 分类 id */
    category: string;
    /** 子任务 */
    subtasks: Subtask[];
    /** 提醒：距截止提前多少分钟，0 表示不提醒 */
    reminder: number;
    /** 标签 */
    tags: string[];
    /** 可选显示与工作流标记，旧数据 hydrate 时补默认值 */
    isFavorite?: boolean;
    isPinned?: boolean;
    isEvening?: boolean;
    description?: string;
}

export interface Clip {
    id: string;
    title: string;
    url: string;
    text: string;
    created: number;
}

/** 习惯打卡 */
export interface Habit {
    id: string;
    name: string;
    emoji: string;
    color: string;
    target: number;
    /** 已打卡的日期集合：{ "2026-11-14": 次数 } */
    records: Record<string, number>;
    created: number;
}

/** 倒数日 */
export interface Countdown {
    id: string;
    title: string;
    date: string;
    emoji: string;
    created: number;
}

export const HABIT_COLORS = ["#4d7c5d", "#d99ab3", "#8badcf", "#d8bb7a", "#9b8ec4"];

/** 收藏的文章 / 链接 */
export interface FavItem {
    id: string;
    title: string;
    url: string;
    source: string;
    note: string;
    created: number;
}

export interface RssFeed {
    id: string;
    name: string;
    url: string;
}

export interface NewsItem {
    id: string;
    title: string;
    url: string;
    desc: string;
    date: string;
    source: string;
}

export type PinType = "pin" | "tape" | "clip" | "heart" | "smiley";

export interface Sticky {
    id: string;
    title: string;
    text: string;
    created: number;
    color: string;
    pinType: PinType;
    rotate: number;
}

export const PIN_LABELS: { key: PinType; label: string; char: string }[] = [
    { key: "pin", label: "图钉", char: "📌" },
    { key: "tape", label: "胶带", char: "🎗" },
    { key: "clip", label: "夹子", char: "📎" },
    { key: "heart", label: "爱心", char: "💗" },
    { key: "smiley", label: "笑脸", char: "🙂" }
];

export interface FocusRecord {
    id: string;
    day: string;
    at: number;
    minutes: number;
    taskId: string;
}

export interface AiConfig {
    endpoint: string;
    key: string;
    model: string;
}

export interface Settings {
    focusMin: number;
    breakMin: number;
    longBreakMin: number;
    longBreakEvery: number;
    autoBreak: boolean;
    dailyGoal: number;
    weatherCity: string;
    noiseVolume: number;
    noiseType: string;
    ai: AiConfig;
    widgetOn: boolean;
    widgetPos: { x: number; y: number };
    accent: string;
    dark: boolean;
    soundOn: boolean;
    randomBreak: boolean;
    praiseOn: boolean;
    /** Internal one-time migration marker for the default praise setting. */
    praiseDefaultMigrated?: boolean;
    rssFeeds: RssFeed[];
}

export interface JournalEntry {
    content: string;
    /** 0-4 五档心情，-1 表示未设置 */
    mood: number;
    tags: string[];
    aiComment: string;
    updatedAt: number;
}

export type DiaryMap = Record<string, JournalEntry>;

export const MOODS = ["😞", "😔", "😐", "😊", "😄"];
export const MOOD_LABELS = ["很差", "有点低", "一般", "不错", "很棒"];

/** 从正文提取 #标签 */
export function extractTags(text: string): string[] {
    const out: string[] = [];
    const re = /#([\p{L}\p{N}_-]{1,20})/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const t = m[1];
        if (!out.includes(t)) out.push(t);
    }
    return out;
}

export interface Quadrant {
    key: string;
    label: string;
    hint: string;
    row: 0 | 1;
    col: 0 | 1;
}

export const QUADRANTS: Quadrant[] = [
    { key: "q1", label: "重要且紧急", hint: "立刻做", row: 0, col: 0 },
    { key: "q2", label: "重要不紧急", hint: "计划做", row: 0, col: 1 },
    { key: "q3", label: "紧急不重要", hint: "委托做", row: 1, col: 0 },
    { key: "q4", label: "不重要不紧急", hint: "别做", row: 1, col: 1 }
];

export const STICKY_COLORS = [
    "#fff9c4", "#ffecb3", "#ffe0e0", "#e1f5fe",
    "#e8f5e9", "#f3e5f5", "#fce4ec", "#e0f2f1"
];

export function defaultSettings(): Settings {
    return {
        focusMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        longBreakEvery: 4,
        autoBreak: true,
        dailyGoal: 6,
        weatherCity: "",
        noiseVolume: 0.4,
        noiseType: "rain",
        ai: { endpoint: "", key: "", model: "" },
        widgetOn: false,
        widgetPos: { x: -1, y: -1 },
        accent: "",
        dark: false,
        soundOn: true,
        randomBreak: false,
        praiseOn: true,
        praiseDefaultMigrated: true,
        rssFeeds: []
    };
}

export function quadOf(t: Task): Quadrant {
    if (t.important && t.urgent) return QUADRANTS[0];
    if (t.important) return QUADRANTS[1];
    if (t.urgent) return QUADRANTS[2];
    return QUADRANTS[3];
}
