<script lang="ts">
    import "./app.css";
    import Home from "./views/Home.svelte";
    import Tasks from "./views/Tasks.svelte";
    import Matrix from "./views/Matrix.svelte";
    import CalendarView from "./views/CalendarView.svelte";
    import Diary from "./views/Diary.svelte";
    import Focus from "./views/Focus.svelte";
    import Analytics from "./views/Analytics.svelte";
    import CompletedView from "./views/CompletedView.svelte";
    import CountdownView from "./views/CountdownView.svelte";
    import HabitsView from "./views/HabitsView.svelte";
    import FlowMode from "./views/FlowMode.svelte";
    import GanttView from "./views/GanttView.svelte";
    import MemoryView from "./views/MemoryView.svelte";
    import NewsView from "./views/NewsView.svelte";
    import CommandPalette from "./views/CommandPalette.svelte";
    import Wall from "./views/Wall.svelte";
    import SettingsView from "./views/SettingsView.svelte";
    import { tasks, stickies, diaries, countdowns, settings, celebration, celebrate, save } from "./lib/store";
    import { setSoundEnabled, sfxDone, sfxAllDone } from "./lib/sound";
    import type { NoiseType } from "./lib/noise";
    import { timerState, pomodoro } from "./lib/timer";
    import { fmtClock } from "./lib/time";
    import type { NoiseEngine } from "./lib/noise";

    export let noise: NoiseEngine;
    export let onToggleWidget: () => void = () => {};

    type TabKey =
        | "home" | "tasks" | "matrix" | "calendar" | "gantt" | "diary"
        | "focus" | "analytics" | "completed" | "countdown" | "habits" | "memory"
        | "news" | "wall" | "settings";

    const ICONS: Record<string, string> = {
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>',
        list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
        grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
        calendar:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
        clock:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 4.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H20z"/></svg>',
        note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5v5h5"/></svg>',
        gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.2 12H1.6M22.4 12h-2.6M6.3 6.3 4.5 4.5M19.5 19.5l-1.8-1.8M17.7 6.3l1.8-1.8M4.5 19.5l1.8-1.8"/></svg>',
        search:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
        archive:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 12.5h4"/></svg>',
        target:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
        sprout:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13C12 8 8 5 3.5 5c0 5 3.5 8 8.5 8z"/><path d="M13 13c0-4 3.5-7 7.5-7 0 4-3 7-7.5 7z"/></svg>',
        flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
        news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5.5h11a1 1 0 0 1 1 1V19a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1z"/><path d="M16 9h3a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2"/><path d="M7 9h5M7 12.5h5M7 16h3"/></svg>',
        timeline:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M6 8.4v7.2"/><path d="M11 6h9M11 18h6"/></svg>'
    };

    let tab: TabKey = "home";
    let searchOpen = false;
    let query = "";
    let searchInput: HTMLInputElement;

    $: total = $tasks.length;
    $: doneCount = $tasks.filter((t) => t.done).length;
    $: openCount = total - doneCount;
    $: pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    $: ts = $timerState;

    type NavGroupKey = "tasks" | "focus" | "archive";
    type NavEntry = { key: TabKey; label: string; icon: string } | {
        group: NavGroupKey; label: string; icon: string; items: { key: TabKey; label: string }[];
    };
    const NAV: NavEntry[] = [
        { key: "home", label: "主页", icon: "home" },
        { group: "tasks", label: "待办清单", icon: "list", items: [
            { key: "matrix", label: "四象限看板" },
            { key: "tasks", label: "待办清单" },
            { key: "calendar", label: "日历日程" },
            { key: "gantt", label: "甘特图" }
        ] },
        { group: "focus", label: "专注模式", icon: "clock", items: [
            { key: "focus", label: "专注模式" },
            { key: "analytics", label: "专注统计" },
            { key: "habits", label: "习惯打卡" }
        ] },
        { key: "wall", label: "随手便签", icon: "note" },
        { key: "diary", label: "日记手账", icon: "book" },
        { key: "news", label: "朝花夕拾", icon: "news" },
        { group: "archive", label: "历史归档", icon: "archive", items: [
            { key: "completed", label: "历史归档" },
            { key: "memory", label: "时光长廊" },
            { key: "countdown", label: "倒数日" }
        ] },
        { key: "settings", label: "系统设置", icon: "gear" }
    ];
    let expanded: Record<NavGroupKey, boolean> = { tasks: false, focus: false, archive: false };
    let previousTab: TabKey = tab;
    $: if (tab !== previousTab) {
        previousTab = tab;
        const group = NAV.find((entry) => "group" in entry && entry.items.some((item) => item.key === tab));
        if (group && "group" in group) expanded = { ...expanded, [group.group]: true };
    }

    function toggleGroup(group: Extract<NavEntry, { group: NavGroupKey }>) {
        const opening = !expanded[group.group];
        expanded = { ...expanded, [group.group]: opening };
        if (opening && !group.items.some((item) => item.key === tab)) tab = group.items[0].key;
    }

    let flowOpen = false;
    let diaryDate = "";
    let noiseOn = false;

    function bumpMin(delta: number) {
        if (ts.running) return;
        timerState.update((s) => {
            const left = Math.max(60, Math.min(180 * 60, s.left + delta * 60));
            return { ...s, left, total: Math.max(s.total, left) };
        });
    }

    function toggleRandomBreak() {
        settings.update((s) => ({ ...s, randomBreak: !s.randomBreak }));
        save("settings");
    }

    function toggleNoise() {
        if (noiseOn) {
            noise.fadeOut();
            noiseOn = false;
        } else {
            const ok = noise.play(($settings.noiseType || "rain") as NoiseType, $settings.noiseVolume);
            noiseOn = ok;
        }
    }

    /* 完成任务的轻提示 + 音效 */
    let lastDoneCount = -1;

    $: setSoundEnabled($settings.soundOn);

    $: {
        const n = $tasks.filter((t) => t.done).length;
        if (lastDoneCount >= 0 && n > lastDoneCount) {
            const total = $tasks.length;
            if (n === total && total > 0) {
                celebrate(pickPraise(true));
                if ($settings.soundOn) sfxAllDone();
            } else {
                celebrate(pickPraise(false));
                if ($settings.soundOn) sfxDone();
            }
        }
        lastDoneCount = n;
    }

    /* ---------- 夸夸词库 ---------- */
    const PRAISE_POOL = [
        "帅呆了！🔥",
        "干得漂亮 ✨",
        "这就是效率 🚀",
        "又清掉一件 🎉",
        "稳得一批 😎",
        "你可以的 💪",
        "轻松拿下 🌟",
        "太强了 👏",
        "优秀如你 🌈",
        "今日份的厉害 ⚡"
    ];
    const PRAISE_ALL_DONE = ["今天全部搞定！🏆", "收工，辛苦了 🌙", "满血通关 🎊"];

    function pickPraise(allDone: boolean): string {
        let pool = allDone ? [...PRAISE_ALL_DONE, ...PRAISE_POOL] : [...PRAISE_POOL];
        if ($settings.praiseOn) {
            try {
                const raw = window.localStorage.getItem("tongyun_ai_praise");
                if (raw) {
                    const extra = JSON.parse(raw) as string[];
                    if (Array.isArray(extra) && extra.length) pool = pool.concat(extra);
                }
            } catch {
                /* ignore */
            }
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /* ---------- 彩带 ---------- */
    const CONFETTI_COLORS = [
        "#4d7c5d", "#d99ab3", "#8badcf", "#d8bb7a", "#9b8ec4",
        "#e8a87c", "#7fb08c", "#c96a5f", "#a9b6e0", "#e5c07b"
    ];
    let confetti: { left: number; w: number; color: string; delay: number; dur: number; rot: number }[] = [];

    $: if ($celebration) {
        confetti = Array.from({ length: 60 }, (_, i) => ({
            left: Math.random() * 100,
            w: 4 + Math.random() * 8,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            delay: Math.random() * 0.5,
            dur: 1.5 + Math.random() * 2,
            rot: Math.random() * 360
        }));
    }

    function goto(e: CustomEvent<TabKey>) {
        tab = e.detail;
    }

    $: q = query.trim().toLowerCase();
    $: results = (() => {
        if (!q) return { tasks: [], stickies: [], diaries: [] };
        return {
            tasks: $tasks
                .filter(
                    (t) =>
                        t.title.toLowerCase().includes(q) ||
                        (t.note || "").toLowerCase().includes(q) ||
                        (t.url || "").toLowerCase().includes(q)
                )
                .slice(0, 12),
            stickies: $stickies.filter((s) => s.text.toLowerCase().includes(q)).slice(0, 12),
            diaries: Object.keys($diaries)
                .filter((k) => (($diaries[k]?.content) || "").toLowerCase().includes(q))
                .sort()
                .reverse()
                .slice(0, 12)
        };
    })();
    $: totalHits = results.tasks.length + results.stickies.length + results.diaries.length;

    function openSearch() {
        searchOpen = true;
        query = "";
        setTimeout(() => searchInput?.focus(), 30);
    }

    function closeSearch() {
        searchOpen = false;
        query = "";
    }

    function jump(kind: TabKey) {
        tab = kind;
        closeSearch();
    }

    let cmdOpen = false;

    function onKey(e: KeyboardEvent) {
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
            e.preventDefault();
            cmdOpen = true;
            return;
        }
        if (e.key === "Escape") {
            closeSearch();
            cmdOpen = false;
        }
    }

    $: miniPct = ts.total > 0 ? ((ts.total - ts.left) / ts.total) * 100 : 0;
</script>

<svelte:window on:keydown={onKey} />

{#if flowOpen}
    <FlowMode onExit={() => (flowOpen = false)} />
{/if}

<div class="ty-root" class:dark={$settings.dark}>
    <aside class="ty-side">
        <div class="brand">
            <div class="brand-icon">🍊</div>
            <div class="brand-text">
                <div class="brand-name">空核手账</div>
                <div class="brand-sub">待办日程管理</div>
            </div>
        </div>

        <div class="progress-box">
            <div class="progress-head">
                <span>完成进度</span>
                <span>{pct}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:{pct}%"></div>
            </div>
            <div class="progress-foot">
                <span>{doneCount} 已完成</span>
                <span>{openCount} 剩余待办</span>
            </div>
        </div>

        <nav class="nav-group" aria-label="主导航">
            {#each NAV as entry}
                {#if "group" in entry}
                    <div>
                        <button class="nav-item" class:active={!expanded[entry.group] && entry.items.some((item) => item.key === tab)}
                            aria-expanded={expanded[entry.group]} on:click={() => toggleGroup(entry)}>
                            <span class="ic">{@html ICONS[entry.icon]}</span>
                            <span>{entry.label}</span>
                            {#if entry.group === "tasks" && openCount > 0}
                                <span class="badge">{openCount}</span>
                            {:else if entry.group === "archive" && doneCount > 0}
                                <span class="badge">{doneCount}</span>
                            {/if}
                            <span class="nav-chevron" class:with-count={(entry.group === "tasks" && openCount > 0) || (entry.group === "archive" && doneCount > 0)} aria-hidden="true">{expanded[entry.group] ? "⌄" : "›"}</span>
                        </button>
                        {#if expanded[entry.group]}
                            <div class="nav-children">
                                {#each entry.items as item (item.key)}
                                    <button class="nav-item nav-child" class:active={tab === item.key}
                                        aria-current={tab === item.key ? "page" : undefined} on:click={() => (tab = item.key)}>
                                        <span>{item.label}</span>
                                        {#if item.key === "tasks" && openCount > 0}<span class="badge">{openCount}</span>
                                        {:else if item.key === "completed" && doneCount > 0}<span class="badge">{doneCount}</span>
                                        {:else if item.key === "countdown" && $countdowns.length > 0}<span class="badge">{$countdowns.length}</span>{/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {:else}
                    <button class="nav-item" class:active={tab === entry.key}
                        aria-current={tab === entry.key ? "page" : undefined} on:click={() => (tab = entry.key)}>
                        <span class="ic">{@html ICONS[entry.icon]}</span>
                        <span>{entry.label}</span>
                        {#if entry.key === "wall" && $stickies.length > 0}<span class="badge">{$stickies.length}</span>{/if}
                    </button>
                {/if}
            {/each}
        </nav>

        <div class="side-foot">
            <div class="mini-timer">
                <div class="mini-head">
                    <span>🕐 专注模式</span>
                    <span>⚡ #{ts.round}</span>
                </div>
                <div class="mini-row">
                    <button class="mini-btn" on:click={() => bumpMin(-1)} title="减 1 分钟">−</button>
                    <span class="mini-time">{fmtClock(ts.left)}</span>
                    <button class="mini-btn" on:click={() => bumpMin(1)} title="加 1 分钟">+</button>
                    <button class="mini-btn play" on:click={() => pomodoro.toggle()} title={ts.running ? "暂停" : "开始"}>
                        {ts.running ? "❚❚" : "▶"}
                    </button>
                    <button class="mini-btn" on:click={() => pomodoro.reset()} title="重置">↻</button>
                </div>
                <div class="mini-bar">
                    <div class="mini-bar-fill" style="width:{miniPct}%"></div>
                </div>

                <div class="mini-opts">
                    <button
                        class="mo-chip"
                        class:on={$settings.randomBreak}
                        on:click={toggleRandomBreak}
                        title="随机微休息"
                    >⏱ 微休息</button>

                    <button
                        class="mo-chip"
                        class:on={noiseOn}
                        on:click={toggleNoise}
                        title="自然白噪音"
                    >☕ {noiseOn ? "停止" : "白噪音"}</button>
                </div>
            </div>

            <button class="nav-item" on:click={openSearch}>
                <span class="ic">{@html ICONS.search}</span>
                <span>搜索</span>
            </button>

            <button class="nav-item" on:click={onToggleWidget}>
                <span class="ic">{@html ICONS.grid}</span>
                <span>桌面挂件</span>
            </button>

            <button class="nav-item flow-btn" on:click={() => (flowOpen = true)}>
                <span class="ic">{@html ICONS.flow}</span>
                <span>心流模式</span>
                {#if openCount > 0}<span class="badge">{openCount}</span>{/if}
            </button>
        </div>
    </aside>

    <main class="ty-main">
        <div class="ty-fade">
            {#if tab === "home"}
                <Home on:goto={goto} />
            {:else if tab === "tasks"}
                <Tasks />
            {:else if tab === "matrix"}
                <Matrix />
            {:else if tab === "calendar"}
                <CalendarView />
            {:else if tab === "diary"}
                {#key diaryDate}
                    <Diary initialDate={diaryDate} />
                {/key}
            {:else if tab === "memory"}
                <MemoryView
                    onOpenJournal={(d) => {
                        diaryDate = d;
                        tab = "diary";
                    }}
                />
            {:else if tab === "focus"}
                <Focus {noise} on:goto={goto} />
            {:else if tab === "analytics"}
                <Analytics />
            {:else if tab === "habits"}
                <HabitsView />
            {:else if tab === "completed"}
                <CompletedView />
            {:else if tab === "countdown"}
                <CountdownView />
            {:else if tab === "gantt"}
                <GanttView />
            {:else if tab === "news"}
                <NewsView />
            {:else if tab === "wall"}
                <Wall />
            {:else}
                <SettingsView {noise} />
            {/if}
        </div>
    </main>
</div>

{#if $celebration}
    <div class="praise-mask">
        {#each confetti as c, i (i)}
            <span
                class="confetti"
                style="left:{c.left}%;width:{c.w}px;height:{c.w * 0.6}px;background:{c.color};animation-delay:{c.delay}s;animation-duration:{c.dur}s"
            ></span>
        {/each}
        <div class="praise-card">
            <div class="dots"></div>
            <div class="stamp">完工<span>DONE</span></div>
            <div class="praise-text">{$celebration}</div>
        </div>
    </div>
{/if}

{#if cmdOpen}
    <CommandPalette
        onClose={() => (cmdOpen = false)}
        onNavigate={(k) => (tab = k as TabKey)}
        onOpenDiary={(date) => {
            diaryDate = date;
            tab = "diary";
        }}
        onStartFocus={() => {
            pomodoro.start();
            tab = "focus";
        }}
    />
{/if}

{#if searchOpen}
    <div class="s-mask" role="presentation" on:click={(e) => e.target === e.currentTarget && closeSearch()}>
        <div class="s-panel">
            <input class="ty-input" bind:this={searchInput} bind:value={query} placeholder="搜索任务、便签、日记…" />

            {#if !q}
                <div class="ty-empty">输入关键词开始搜索</div>
            {:else if totalHits === 0}
                <div class="ty-empty">没有找到「{query}」</div>
            {:else}
                <div class="s-list">
                    {#if results.tasks.length}
                        <div class="s-group">任务 · {results.tasks.length}</div>
                        {#each results.tasks as t (t.id)}
                            <button class="s-item" on:click={() => jump("tasks")}>
                                <span class="s-main">{t.title}</span>
                                <span class="s-sub">{t.done ? "已完成" : "未完成"}</span>
                            </button>
                        {/each}
                    {/if}
                    {#if results.stickies.length}
                        <div class="s-group">便签 · {results.stickies.length}</div>
                        {#each results.stickies as s (s.id)}
                            <button class="s-item" on:click={() => jump("wall")}>
                                <span class="s-main">{s.text.slice(0, 60)}</span>
                            </button>
                        {/each}
                    {/if}
                    {#if results.diaries.length}
                        <div class="s-group">日记 · {results.diaries.length}</div>
                        {#each results.diaries as k (k)}
                            <button class="s-item" on:click={() => { diaryDate = k; jump("diary"); }}>
                                <span class="s-main">{k}</span>
                                <span class="s-sub">{($diaries[k]?.content || "").slice(0, 30)}</span>
                            </button>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .nav-children {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 3px 0 0 26px;
    }
    .nav-item.nav-child {
        padding: 6px 12px;
        font-size: 12px;
    }
    .nav-chevron {
        margin-left: auto;
        color: var(--text-3);
        font-size: 16px;
        line-height: 1;
    }
    .nav-chevron.with-count { margin-left: 0; }
    .ic :global(svg) {
        width: 17px;
        height: 17px;
        display: block;
    }
    :global(.flow-btn) {
        background: var(--green-soft);
        border-radius: 14px;
        padding: 11px 12px;
        color: var(--green);
        font-weight: 600;
        margin-bottom: 10px;
    }
    :global(.flow-btn:hover) {
        background: var(--green-soft);
        color: var(--green);
        filter: brightness(0.97);
    }
    .s-mask {
        position: fixed;
        inset: 0;
        z-index: 10001;
        background: rgba(50, 42, 30, 0.28);
        display: flex;
        justify-content: center;
        padding-top: 12vh;
    }
    .s-panel {
        width: min(540px, 88vw);
        max-height: 68vh;
        background: #fff;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(60, 50, 35, 0.28);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
        color: #2f3a32;
    }
    .s-list {
        overflow-y: auto;
        min-height: 0;
    }
    .s-group {
        font-size: 10.5px;
        color: #9aa398;
        padding: 10px 10px 4px;
        letter-spacing: 0.6px;
    }
    .s-item {
        display: flex;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        color: #2f3a32;
        font-family: inherit;
        font-size: 12.5px;
        padding: 8px 10px;
        border-radius: 10px;
        cursor: pointer;
    }
    .s-item:hover {
        background: #f5f2ea;
    }
    .s-main {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .s-sub {
        font-size: 10.5px;
        color: #9aa398;
        flex: 0 0 auto;
        max-width: 40%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .praise-mask {
        position: fixed;
        inset: 0;
        z-index: 10007;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        overflow: hidden;
    }
    .confetti {
        position: absolute;
        top: -24px;
        border-radius: 2px;
        opacity: 0;
        animation-name: confettiFall;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
    }
    @keyframes confettiFall {
        0% {
            opacity: 0;
            transform: translateY(-24px) rotate(0deg);
        }
        12% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: translateY(102vh) rotate(720deg);
        }
    }
    .praise-card {
        position: relative;
        background: rgba(255, 253, 248, 0.96);
        backdrop-filter: blur(10px);
        border-radius: 18px;
        padding: 30px 44px 26px;
        box-shadow:
            0 24px 70px rgba(60, 50, 35, 0.26),
            0 2px 8px rgba(60, 50, 35, 0.08);
        animation: praiseIn 0.6s cubic-bezier(0.22, 1.3, 0.4, 1);
        text-align: center;
        min-width: 220px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }
    .dots {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(120, 108, 88, 0.22) 1px, transparent 1px);
        background-size: 10px 10px;
        opacity: 0.35;
        pointer-events: none;
    }
    .stamp {
        position: relative;
        z-index: 1;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        border: 2px dashed #c96a5f;
        border-radius: 12px;
        padding: 7px 15px 5px;
        color: #c96a5f;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 3px;
        transform: rotate(-8deg);
        opacity: 0.88;
        animation: stampIn 0.5s 0.1s cubic-bezier(0.22, 1.4, 0.4, 1) both;
    }
    .stamp span {
        font-size: 8px;
        letter-spacing: 2px;
        opacity: 0.7;
        margin-top: 1px;
    }
    @keyframes stampIn {
        0% {
            opacity: 0;
            transform: rotate(-8deg) scale(2.2);
        }
        100% {
            opacity: 0.88;
            transform: rotate(-8deg) scale(1);
        }
    }
    .praise-text {
        position: relative;
        z-index: 1;
        font-size: 22px;
        font-weight: 800;
        color: #2f3a32;
        letter-spacing: 0.5px;
        line-height: 1.3;
        white-space: nowrap;
    }
    @keyframes praiseIn {
        0% {
            opacity: 0;
            transform: scale(0.7);
        }
        55% {
            opacity: 1;
            transform: scale(1.05);
        }
        75% {
            transform: scale(0.98);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
