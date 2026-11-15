<script lang="ts">
    import { tasks, stickies, diaries } from "../lib/store";

    export let onClose: () => void;
    export let onNavigate: (key: string) => void;
    export let onStartFocus: () => void;
    export let onOpenDiary: (date: string) => void;

    let query = "";
    let input: HTMLInputElement;
    let cursor = 0;

    interface Item {
        id: string;
        label: string;
        hint: string;
        kind: "go" | "act" | "task" | "note" | "diary";
        run: () => void;
    }

    const BASE: Item[] = [
        { id: "go-home", label: "主页", hint: "页面", kind: "go", run: () => onNavigate("home") },
        { id: "go-tasks", label: "待办清单", hint: "页面", kind: "go", run: () => onNavigate("tasks") },
        { id: "go-matrix", label: "四象限看板", hint: "页面", kind: "go", run: () => onNavigate("matrix") },
        { id: "go-calendar", label: "日历日程", hint: "页面", kind: "go", run: () => onNavigate("calendar") },
        { id: "go-gantt", label: "甘特图", hint: "页面", kind: "go", run: () => onNavigate("gantt") },
        { id: "go-diary", label: "日记手账", hint: "页面", kind: "go", run: () => onNavigate("diary") },
        { id: "go-focus", label: "专注模式", hint: "页面", kind: "go", run: () => onNavigate("focus") },
        { id: "go-analytics", label: "专注统计", hint: "页面", kind: "go", run: () => onNavigate("analytics") },
        { id: "go-habits", label: "习惯打卡", hint: "页面", kind: "go", run: () => onNavigate("habits") },
        { id: "go-news", label: "朝花夕拾", hint: "页面", kind: "go", run: () => onNavigate("news") },
        { id: "go-completed", label: "历史归档", hint: "页面", kind: "go", run: () => onNavigate("completed") },
        { id: "go-memory", label: "时光长廊", hint: "页面", kind: "go", run: () => onNavigate("memory") },
        { id: "go-countdown", label: "倒数日", hint: "页面", kind: "go", run: () => onNavigate("countdown") },
        { id: "go-wall", label: "随手便签", hint: "页面", kind: "go", run: () => onNavigate("wall") },
        { id: "go-settings", label: "系统设置", hint: "页面", kind: "go", run: () => onNavigate("settings") },
        { id: "act-focus", label: "开始专注", hint: "动作", kind: "act", run: () => onStartFocus() }
    ];

    $: q = query.trim().toLowerCase();

    $: items = (() => {
        if (!q) return BASE;

        const nav = BASE.filter((b) => b.label.toLowerCase().includes(q) || b.hint.includes(q));

        const taskHits: Item[] = $tasks
            .filter((t) => t.title.toLowerCase().includes(q))
            .slice(0, 8)
            .map((t) => ({
                id: "task-" + t.id,
                label: t.title,
                hint: t.done ? "已完成任务" : "任务",
                kind: "task" as const,
                run: () => onNavigate("tasks")
            }));

        const noteHits: Item[] = $stickies
            .filter((s) => s.text.toLowerCase().includes(q))
            .slice(0, 5)
            .map((s) => ({
                id: "note-" + s.id,
                label: s.text.slice(0, 50),
                hint: "便签",
                kind: "note" as const,
                run: () => onNavigate("wall")
            }));

        const diaryHits: Item[] = Object.keys($diaries)
            .filter((k) => (($diaries[k]?.content) || "").toLowerCase().includes(q))
            .slice(0, 5)
            .map((k) => ({
                id: "diary-" + k,
                label: k,
                hint: "日记",
                kind: "diary" as const,
                run: () => onOpenDiary(k)
            }));

        return [...nav, ...taskHits, ...noteHits, ...diaryHits];
    })();

    $: if (cursor >= items.length) cursor = 0;

    function exec(i: number) {
        const item = items[i];
        if (!item) return;
        item.run();
        onClose();
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
            onClose();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            cursor = Math.min(items.length - 1, cursor + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            cursor = Math.max(0, cursor - 1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            exec(cursor);
        }
    }

    setTimeout(() => input?.focus(), 30);
</script>

<div class="cp-mask" role="presentation" on:click={(e) => e.target === e.currentTarget && onClose()}>
    <div class="cp">
        <input
            class="cp-input"
            bind:this={input}
            bind:value={query}
            placeholder="搜索页面、任务、便签、日记…"
            on:keydown={onKey}
        />
        <div class="cp-list">
            {#if items.length === 0}
                <div class="cp-empty">没有匹配结果</div>
            {:else}
                {#each items as it, i (it.id)}
                    <button
                        class="cp-item"
                        class:on={i === cursor}
                        on:mouseenter={() => (cursor = i)}
                        on:click={() => exec(i)}
                    >
                        <span class="cp-label">{it.label}</span>
                        <span class="cp-hint">{it.hint}</span>
                    </button>
                {/each}
            {/if}
        </div>
        <div class="cp-foot">
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
            <span>Esc 关闭</span>
        </div>
    </div>
</div>

<style>
    .cp-mask {
        position: fixed;
        inset: 0;
        z-index: 10002;
        background: rgba(50, 42, 30, 0.28);
        display: flex;
        justify-content: center;
        padding-top: 14vh;
    }
    .cp {
        width: min(560px, 88vw);
        max-height: 64vh;
        background: #fff;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(60, 50, 35, 0.28);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .cp-input {
        border: 0;
        border-bottom: 1px solid #f0ece3;
        padding: 15px 18px;
        font-size: 14px;
        font-family: inherit;
        color: #2f3a32;
        outline: none;
        background: transparent;
    }
    .cp-input::placeholder {
        color: #b9b2a2;
    }
    .cp-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 6px;
    }
    .cp-empty {
        padding: 24px;
        text-align: center;
        color: #b9b2a2;
        font-size: 12px;
    }
    .cp-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        font-family: inherit;
        font-size: 12.5px;
        color: #2f3a32;
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
    }
    .cp-item.on {
        background: #e6efe7;
        color: #4d7c5d;
    }
    .cp-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cp-hint {
        font-size: 10px;
        color: #b9b2a2;
        flex: 0 0 auto;
    }
    .cp-item.on .cp-hint {
        color: #7fa98a;
    }
    .cp-foot {
        display: flex;
        gap: 16px;
        padding: 9px 18px;
        border-top: 1px solid #f0ece3;
        font-size: 10px;
        color: #b9b2a2;
    }
</style>
