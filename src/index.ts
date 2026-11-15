import { Plugin, showMessage } from "siyuan";
import { mount, unmount } from "svelte";
import { get } from "svelte/store";
import App from "./App.svelte";
import Widget from "./views/Widget.svelte";
import {
    hydrate, bindSaver, flushSaves, save, tasks, stickies, focusRecords, diaries, settings,
    type StoreKey
} from "./lib/store";
import { pomodoro, timerState, initializeTimerAfterHydrate } from "./lib/timer";
import { NoiseEngine } from "./lib/noise";
import { startReminders } from "./lib/reminders";
import { fmtClock, dayKey } from "./lib/time";
import type {
    Task, Sticky, FocusRecord, Settings, DiaryMap, Category, Habit, Countdown, FavItem
} from "./lib/types";

const STORAGE: Record<StoreKey, string> = {
    tasks: "tongyun-tasks",
    stickies: "tongyun-stickies",
    focus: "tongyun-focus",
    diaries: "tongyun-diaries",
    settings: "tongyun-settings",
    categories: "tongyun-categories",
    habits: "tongyun-habits",
    countdowns: "tongyun-countdowns",
    favorites: "tongyun-favorites"
};

export default class TongYunWorkbench extends Plugin {
    // Svelte mount 的返回类型随版本变化，统一用 unknown 持有
    private winApp: unknown = null;
    private winEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;
    private noise = new NoiseEngine();
    private unsubTimer: (() => void) | null = null;
    private widgetEl: HTMLElement | null = null;
    private widgetApp: unknown = null;
    private cancelWindowDrag: (() => void) | null = null;
    private cancelWidgetDrag: (() => void) | null = null;
    private widgetResize: (() => void) | null = null;
    private stopReminders: (() => void) | null = null;
    private unloaded = false;

    async onload(): Promise<void> {
        try {
            const [t, s, f, d, cfg, cats, hb, cd, fv] = await Promise.all([
                this.loadData(STORAGE.tasks),
                this.loadData(STORAGE.stickies),
                this.loadData(STORAGE.focus),
                this.loadData(STORAGE.diaries),
                this.loadData(STORAGE.settings),
                this.loadData(STORAGE.categories),
                this.loadData(STORAGE.habits),
                this.loadData(STORAGE.countdowns),
                this.loadData(STORAGE.favorites)
            ]);

            if (this.unloaded) return;
            const persistedSettings = cfg as Partial<Settings> | null;
            const migratePraise = !!persistedSettings && !persistedSettings.praiseDefaultMigrated;
            const hydratedSettings = migratePraise
                ? { ...persistedSettings, praiseOn: true, praiseDefaultMigrated: true }
                : persistedSettings;
            hydrate({
                tasks: t as Task[] | null,
                stickies: s as Sticky[] | null,
                focus: f as FocusRecord[] | null,
                diaries: d as DiaryMap | null,
                settings: hydratedSettings,
                categories: cats as Category[] | null,
                habits: hb as Habit[] | null,
                countdowns: cd as Countdown[] | null,
                favorites: fv as FavItem[] | null
            });

            initializeTimerAfterHydrate();
            bindSaver((key, data) => this.saveData(STORAGE[key], data));
            if (migratePraise) save("settings");
            this.stopReminders = startReminders((message) => showMessage(message, 5000));

            this.registerStatusBar();
            this.registerTopBar();
            this.registerCommands();

            pomodoro.onChange(({ mode, minutes }) => {
                if (mode === "focus") {
                    showMessage(`专注完成 ${minutes} 分钟`, 4000);
                    this.noise.fadeOut();
                } else {
                    showMessage("休息结束", 3000);
                }
            });

            console.log("[tongyun] loaded");
        } catch (e) {
            console.error("[tongyun] onload failed", e);
            showMessage("空核工作台加载失败，已停止写入以保护数据；请检查思源存储后重新启用插件。", 8000);
        }
    }

    onLayoutReady(): void {
        this.syncStatusBar();
    }

    async onunload(): Promise<void> {
        this.unloaded = true;
        pomodoro.destroy();
        this.noise.stop();
        this.stopReminders?.();
        this.stopReminders = null;
        if (this.unsubTimer) this.unsubTimer();
        this.closeWindow();
        this.closeWidget();
        this.statusEl = null;
        try {
            await flushSaves();
        } catch (e) {
            console.error("[tongyun] flush failed", e);
            showMessage("空核工作台数据保存失败，请查看控制台", 5000);
        }
    }

    /* ---------------- 浮动窗口 ---------------- */
    private openWindow(): void {
        if (this.winEl) { return; }

        const win = document.createElement("div");
        win.className = "ty-win";

        const bar = document.createElement("div");
        bar.className = "ty-win-bar";

        const title = document.createElement("span");
        title.className = "ty-win-title";
        title.textContent = "空核工作台";

        const actions = document.createElement("div");
        actions.className = "ty-win-actions";

        const minBtn = document.createElement("button");
        minBtn.className = "ty-win-btn";
        minBtn.textContent = "−";
        minBtn.title = "最小化（收起窗口）";
        minBtn.addEventListener("click", () => this.closeWindow());

        const maxBtn = document.createElement("button");
        maxBtn.className = "ty-win-btn";
        maxBtn.textContent = "⤢";
        maxBtn.title = "最大化 / 还原";
        maxBtn.addEventListener("click", () => this.toggleMax(win, maxBtn));

        const close = document.createElement("button");
        close.className = "ty-win-btn close";
        close.textContent = "✕";
        close.title = "关闭";
        close.addEventListener("click", () => this.closeWindow());

        actions.appendChild(minBtn);
        actions.appendChild(maxBtn);
        actions.appendChild(close);

        bar.appendChild(title);
        bar.appendChild(actions);
        bar.addEventListener("mousedown", (e) => this.startDrag(e, win));

        const body = document.createElement("div");
        body.className = "ty-win-body";

        win.appendChild(bar);
        win.appendChild(body);
        document.body.appendChild(win);
        this.winEl = win;

        const pos = this.loadPos();
        if (pos.x >= 0) {
            win.style.left = pos.x + "px";
            win.style.top = pos.y + "px";
        } else {
            win.style.right = "28px";
            win.style.top = "72px";
        }

        this.winApp = mount(App, {
            target: body,
            props: {
                noise: this.noise,
                onToggleWidget: () => this.toggleWidget()
            }
        });
    }

    private closeWindow(): void {
        this.cancelWindowDrag?.();
        this.maximized = false;
        if (this.winApp) {
            unmount(this.winApp as Record<string, unknown>);
            this.winApp = null;
        }
        if (this.winEl && this.winEl.parentNode) {
            this.winEl.parentNode.removeChild(this.winEl);
        }
        this.winEl = null;
    }

    private toggleWindow(): void {
        if (this.winEl) { this.closeWindow(); } else { this.openWindow(); }
    }

    private maximized = false;
    private prevStyle = { left: "", top: "", right: "", width: "", height: "" };

    private toggleMax(win: HTMLElement, btn: HTMLButtonElement): void {
        if (!this.maximized) {
            this.prevStyle = {
                left: win.style.left,
                top: win.style.top,
                right: win.style.right,
                width: win.style.width,
                height: win.style.height
            };
            win.style.left = "14px";
            win.style.top = "14px";
            win.style.right = "auto";
            win.style.width = "calc(100vw - 28px)";
            win.style.height = "calc(100vh - 28px)";
            win.classList.add("maxed");
            btn.textContent = "❐";
            btn.title = "还原窗口";
            this.maximized = true;
        } else {
            win.style.left = this.prevStyle.left;
            win.style.top = this.prevStyle.top;
            win.style.right = this.prevStyle.right;
            win.style.width = this.prevStyle.width;
            win.style.height = this.prevStyle.height;
            win.classList.remove("maxed");
            btn.textContent = "⤢";
            btn.title = "最大化 / 还原";
            this.maximized = false;
        }
    }

    private startDrag(e: MouseEvent, win: HTMLElement): void {
        if ((e.target as HTMLElement).tagName === "BUTTON" || this.maximized) { return; }
        this.cancelWindowDrag?.();
        const rect = win.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        win.style.right = "auto";
        e.preventDefault();

        const move = (ev: MouseEvent) => {
            const x = Math.max(0, Math.min(window.innerWidth - 140, ev.clientX - offX));
            const y = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - offY));
            win.style.left = x + "px";
            win.style.top = y + "px";
        };
        const cleanup = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            this.cancelWindowDrag = null;
        };
        const up = () => {
            cleanup();
            this.savePos(parseInt(win.style.left, 10) || 0, parseInt(win.style.top, 10) || 0);
        };
        this.cancelWindowDrag = cleanup;
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
    }

    private loadPos(): { x: number; y: number } {
        try {
            const raw = window.localStorage.getItem("tongyun-win-pos");
            if (raw) {
                const p = JSON.parse(raw) as { x: number; y: number };
                if (typeof p.x === "number" && typeof p.y === "number") { return p; }
            }
        } catch { /* ignore */ }
        return { x: -1, y: -1 };
    }

    private savePos(x: number, y: number): void {
        try {
            window.localStorage.setItem("tongyun-win-pos", JSON.stringify({ x, y }));
        } catch { /* ignore */ }
    }

    /* ---------------- 状态栏 ---------------- */
    private registerStatusBar(): void {
        try {
            const el = document.createElement("div");
            el.className = "tongyun-status";
            el.title = "空核 · 点击开始/暂停";
            el.addEventListener("click", () => pomodoro.toggle());
            this.statusEl = el;
            this.addStatusBar({ element: el });

            let last = "";
            let lastRunning = false;
            this.unsubTimer = timerState.subscribe((s) => {
                const label = `${s.mode === "focus" ? "🍅" : "☕"} ${fmtClock(s.left)}`;
                if (label !== last) {
                    el.textContent = label;
                    last = label;
                }
                if (s.running !== lastRunning) {
                    el.classList.toggle("running", s.running);
                    lastRunning = s.running;
                }
            });
        } catch (e) {
            console.error("[tongyun] addStatusBar failed", e);
        }
    }

    private syncStatusBar(): void {
        // 状态栏由 timerState 的订阅驱动，这里保留钩子以便布局就绪后刷新一次
        if (!this.statusEl) return;
    }

    /* ---------------- 顶栏 ---------------- */
    private registerTopBar(): void {
        try {
            this.addTopBar({
                icon: "iconCalendar",
                title: "空核工作台（左键打开，右键更多）",
                position: "left",
                callback: () => this.toggleWindow(),
                contextMenu: (menu) => {
                    menu.addItem({
                        label: "打开工作台",
                        click: () => this.openWindow()
                    });
                    menu.addItem({
                        label: this.widgetEl ? "隐藏桌面挂件" : "显示桌面挂件",
                        click: () => this.toggleWidget()
                    });
                    menu.addItem({
                        label: "今日总结写入日记",
                        click: () => void this.exportToDailyNote()
                    });
                    menu.addItem({
                        label: get(timerState).running ? "暂停专注" : "开始专注",
                        click: () => pomodoro.toggle()
                    });
                }
            });
        } catch (e) {
            console.error("[tongyun] addTopBar failed", e);
        }
    }

    /* ---------------- 思源内悬浮挂件 ---------------- */
    private toggleWidget(): void {
        if (this.widgetEl) { this.closeWidget(); } else { this.openWidget(); }
    }

    private openWidget(): void {
        if (this.widgetEl) { return; }

        const w = document.createElement("div");
        // The component owns the visual styling; this host only positions it in SiYuan.
        w.style.cssText = "position:fixed;z-index:2147483000;width:min(340px, calc(100vw - 24px));pointer-events:auto;";

        document.body.appendChild(w);
        this.widgetEl = w;

        const pos = this.loadWidgetPos();
        if (pos.x >= 0) {
            w.style.left = pos.x + "px";
            w.style.top = pos.y + "px";
        } else {
            w.style.left = Math.max(12, window.innerWidth - 362) + "px";
            w.style.top = Math.max(12, window.innerHeight - 546) + "px";
        }

        try {
            this.widgetApp = mount(Widget, {
                target: w,
                props: { onClose: () => this.closeWidget(), onDrag: (e: MouseEvent) => this.dragWidget(e, w) }
            });
            this.widgetResize = () => {
                w.style.left = Math.max(0, Math.min(window.innerWidth - w.offsetWidth, parseFloat(w.style.left) || 0)) + "px";
                w.style.top = Math.max(0, Math.min(window.innerHeight - 48, parseFloat(w.style.top) || 0)) + "px";
            };
            this.widgetResize();
            window.addEventListener("resize", this.widgetResize);
            showMessage("桌面挂件已显示，可拖动标题栏（仅在思源窗口内）", 3000);
        } catch (e) {
            this.closeWidget();
            console.error("[tongyun] widget mount failed", e);
            showMessage("挂件加载失败，请查看控制台", 5000);
        }
    }

    private closeWidget(): void {
        this.cancelWidgetDrag?.();
        if (this.widgetResize) window.removeEventListener("resize", this.widgetResize);
        this.widgetResize = null;
        if (this.widgetApp) {
            unmount(this.widgetApp as Record<string, unknown>);
            this.widgetApp = null;
        }
        if (this.widgetEl && this.widgetEl.parentNode) {
            this.widgetEl.parentNode.removeChild(this.widgetEl);
        }
        this.widgetEl = null;
    }

    private dragWidget(e: MouseEvent, w: HTMLElement): void {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button")) { return; }
        this.cancelWidgetDrag?.();
        const rect = w.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        w.style.right = "auto";
        w.style.bottom = "auto";
        e.preventDefault();

        const move = (ev: MouseEvent) => {
            const x = Math.max(0, Math.min(window.innerWidth - w.offsetWidth, ev.clientX - offX));
            const y = Math.max(0, Math.min(window.innerHeight - 48, ev.clientY - offY));
            w.style.left = x + "px";
            w.style.top = y + "px";
        };
        const cleanup = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            window.removeEventListener("blur", cleanup);
            this.cancelWidgetDrag = null;
        };
        const up = () => {
            cleanup();
            try {
                window.localStorage.setItem(
                    "tongyun-widget-pos",
                    JSON.stringify({
                        x: parseInt(w.style.left, 10) || 0,
                        y: parseInt(w.style.top, 10) || 0
                    })
                );
            } catch { /* ignore */ }
        };
        this.cancelWidgetDrag = cleanup;
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
        window.addEventListener("blur", cleanup);
    }

    private loadWidgetPos(): { x: number; y: number } {
        try {
            const raw = window.localStorage.getItem("tongyun-widget-pos");
            if (raw) {
                const p = JSON.parse(raw) as { x: number; y: number };
                if (Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0) { return p; }
            }
        } catch { /* ignore */ }
        return { x: -1, y: -1 };
    }

    /* ---------------- 写回思源日记 ---------------- */
    private buildTodayMarkdown(): string {
        const today = dayKey();
        const list = get(tasks);
        const done = list.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today);
        const open = list.filter((t) => !t.done);
        const pomos = get(focusRecords).filter((f) => f.day === today);
        const minutes = pomos.reduce((a, b) => a + b.minutes, 0);
        const diary = get(diaries)[today]?.content || "";

        const L: string[] = [];
        L.push(`**专注**：${pomos.length} 个番茄 / ${minutes} 分钟`);
        L.push("");
        L.push("**今日完成**");
        if (done.length === 0) { L.push("- （无）"); }
        else { done.forEach((t) => L.push(`- [x] ${t.title}`)); }
        L.push("");
        L.push("**未完成**");
        if (open.length === 0) { L.push("- （无）"); }
        else { open.slice(0, 20).forEach((t) => L.push(`- [ ] ${t.title}`)); }
        if (diary.trim()) {
            L.push("");
            L.push("**日记**");
            L.push(diary.trim());
        }
        return L.join("\n");
    }

    private async postApi(path: string, body: unknown): Promise<{ code: number; msg: string; data: unknown }> {
        const res = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {})
        });
        return (await res.json()) as { code: number; msg: string; data: unknown };
    }

    private async exportToDailyNote(): Promise<void> {
        try {
            const nbRes = await this.postApi("/api/notebook/lsNotebooks", {});
            const notebooks = (nbRes.data as { notebooks?: { id: string; name: string; closed?: boolean }[] })?.notebooks || [];
            const openNbs = notebooks.filter((n) => !n.closed);
            if (openNbs.length === 0) { throw new Error("没有可用的笔记本"); }
            const nb = openNbs.find((n) => /日记|daily|diary/i.test(n.name)) || openNbs[0];

            const daily = await this.postApi("/api/filetree/createDailyNote", {
                notebook: nb.id,
                app: ""
            });
            const docId = (daily.data as { id?: string })?.id;
            if (!docId) { throw new Error(daily.msg || "创建日记失败"); }

            const md = this.buildTodayMarkdown();
            const ap = await this.postApi("/api/block/appendBlock", {
                dataType: "markdown",
                data: md,
                parentID: docId
            });
            if (ap.code !== 0) { throw new Error(ap.msg || "写入失败"); }

            showMessage(`已写入 ${nb.name} 的今日日记`, 3000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            showMessage("写入日记失败：" + msg, 5000);
            console.error("[tongyun] export to daily failed", e);
        }
    }

    /* ---------------- 命令 ---------------- */
    private registerCommands(): void {
        const add = (langKey: string, execute: () => void) => {
            try {
                this.addCommand({ langKey, execute });
            } catch (e) {
                console.error("[tongyun] addCommand " + langKey, e);
            }
        };

        add("newTask", () => this.openWindow());
        add("startFocus", () => {
            this.openWindow();
            pomodoro.start();
        });
        add("pauseFocus", () => pomodoro.pause());
        add("resetFocus", () => pomodoro.reset());
        add("toggleWidget", () => this.toggleWidget());
        add("exportToday", () => void this.exportToDailyNote());
    }
}
