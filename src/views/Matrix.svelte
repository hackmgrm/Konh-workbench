<script lang="ts">
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, categories, save, uid } from "../lib/store";
    import { QUADRANTS, quadOf } from "../lib/types";
    import type { Task } from "../lib/types";
    import { dayKey, daysUntil, extractDateMention } from "../lib/time";
    import TaskDetail from "./TaskDetail.svelte";
    import AiInbox from "./AiInbox.svelte";
    import { attachCurrentTask, pomodoro, timerState } from "../lib/timer";

    const SUBS: Record<string, string> = {
        q1: "立即执行 · Do First",
        q2: "计划安排 · Schedule",
        q3: "快速处理 · Delegate",
        q4: "精简删除 · Eliminate"
    };
    const ROMAN = ["I", "II", "III", "IV"];

    let dragId = "";
    let overKey = "";
    let query = "";
    let showGuide = false;
    let quickDraft: Record<string, string | undefined> = {};
    let expandedKey = "";
    let eveningOnly = false;
    let detailTask: Task | null = null;
    let showInbox = false;
    $: timer = $timerState;

    $: open = $tasks.filter((t) => !t.done && (!eveningOnly || t.isEvening));
    $: q = query.trim().toLowerCase();
    $: catMap = Object.fromEntries($categories.map((c) => [c.id, c]));

    /* 显式依赖：Svelte 才能追踪更新 */
    $: groups = QUADRANTS.map((quad, i) => {
        const all = open.filter((t) => quadOf(t).key === quad.key);
        const items = q
            ? all.filter(
                  (t) =>
                      t.title.toLowerCase().includes(q) ||
                      (t.note || "").toLowerCase().includes(q) ||
                      (t.description || "").toLowerCase().includes(q)
              )
            : all;
        items.sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));
        const pct = open.length ? Math.round((all.length / open.length) * 100) : 0;
        return { quad, i, items, count: all.length, pct };
    });

    function addToQuad(key: string, raw: string, inputEl: HTMLInputElement) {
        const v = raw.trim();
        if (!v) return;
        const important = key === "q1" || key === "q2";
        const urgent = key === "q1" || key === "q3";
        const t: Task = {
            id: uid(),
            title: v,
            note: "",
            done: false,
            important,
            urgent,
            created: Date.now(),
            doneAt: 0,
            // 与上游快速新增一致：新任务默认归入今天。
            due: dayKey(),
            start: "",
            repeat: "none",
            url: "",
            category: "none",
            subtasks: [],
            reminder: 0,
            tags: [],
            isFavorite: false,
            isPinned: false,
            isEvening: false,
            description: ""
        };
        tasks.update((l) => [t, ...l]);
        save("tasks");
        quickDraft = { ...quickDraft, [key]: "" };
        inputEl.value = "";
    }

    function onDragStart(e: DragEvent, t: Task) {
        dragId = t.id;
        if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", t.id);
            e.dataTransfer.effectAllowed = "move";
        }
    }

    function onDragEnd() {
        dragId = "";
        overKey = "";
    }

    function onDragOver(e: DragEvent, key: string) {
        e.preventDefault();
        overKey = key;
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    }

    function onDragLeave(key: string) {
        if (overKey === key) overKey = "";
    }

    function onDrop(e: DragEvent, key: string) {
        e.preventDefault();
        const id = dragId || e.dataTransfer?.getData("text/plain") || "";
        overKey = "";
        dragId = "";
        if (!id) return;
        const important = key === "q1" || key === "q2";
        const urgent = key === "q1" || key === "q3";
        tasks.update((l) => l.map((x) => (x.id === id ? { ...x, important, urgent } : x)));
        save("tasks");
    }

    function toggleFlag(t: Task, key: "isPinned" | "isFavorite" | "isEvening") {
        tasks.update((list) => list.map((x) => x.id === t.id ? { ...x, [key]: !x[key] } : x));
        save("tasks");
    }

    function startFocus(t: Task) {
        if (timer.running && timer.mode === "focus" && timer.taskId === t.id) return;
        if (timer.running || timer.mode !== "focus" || (timer.taskId && timer.taskId !== t.id)) {
            if (!window.confirm("开始新专注会重置当前计时，继续吗？")) return;
            pomodoro.reset("focus");
        }
        attachCurrentTask(t.id);
        pomodoro.start();
    }

    function toggle(t: Task) {
        tasks.update((l) => toggleTask(l, t.id));
        save("tasks");
    }

    function dueText(t: Task): string {
        if (!t.due) return "";
        const n = daysUntil(t.due);
        if (n < 0) return `已逾期 ${-n} 天`;
        if (n === 0) return "今天到期";
        if (n === 1) return "明天到期";
        return `还剩 ${n} 天`;
    }

    function dueDateText(t: Task): string {
        if (t.due) return t.due.slice(5).replace("-", "/");
        return extractDateMention([t.title, t.description || "", t.note || ""].join(" "));
    }

    function hasDateBadge(t: Task): boolean {
        return !!t.due || !!dueDateText(t);
    }

    function catColor(t: Task): string {
        const c = catMap[t.category];
        return c ? c.color : "#c8c2b4";
    }
</script>

{#if detailTask}
    <div class="dt-wrap"><TaskDetail task={detailTask} onClose={() => (detailTask = null)} /></div>
{:else}
<div class="head-bar">
    <div class="hb-left">
        <span class="hb-title">四象限优先级看板</span>
        <span class="hb-pill">{open.length} 项待办</span>
    </div>

    <div class="search-box">
        <span class="s-ic">⌕</span>
        <input placeholder="搜索待办…" bind:value={query} />
    </div>

    <button class="ty-btn sm" class:on={eveningOnly} aria-pressed={eveningOnly} on:click={() => (eveningOnly = !eveningOnly)}>☾ 今晚清单 ({$tasks.filter((t) => !t.done && t.isEvening).length})</button>
    <button class="ty-btn sm" on:click={() => (showInbox = !showInbox)}>✦ AI 智能收集箱</button>
    <button class="ty-btn sm" on:click={() => (showGuide = !showGuide)}>ⓘ 象限法则指引</button>
</div>
{/if}

<AiInbox visible={showInbox && !detailTask} onClose={() => (showInbox = false)} />

{#if !detailTask}
{#if showGuide}
    <div class="guide">
        <div class="g-item"><b>I 重要且紧急</b>需要马上处理，通常有明确截止。</div>
        <div class="g-item"><b>II 重要不紧急</b>决定长期价值，最该被保护的时间。</div>
        <div class="g-item"><b>III 紧急不重要</b>能委托就委托，别让它占满一天。</div>
        <div class="g-item"><b>IV 不重要不紧急</b>大部分可以删掉。</div>
    </div>
{/if}

<div class="ty-matrix" class:expanded={expandedKey}>
    {#each groups.filter((g) => !expandedKey || expandedKey === g.quad.key) as g (g.quad.key)}
        <div
            class="ty-quad q{g.i + 1}"
            class:dragover={overKey === g.quad.key}
            on:dragover={(e) => onDragOver(e, g.quad.key)}
            on:dragleave={() => onDragLeave(g.quad.key)}
            on:drop={(e) => onDrop(e, g.quad.key)}
            role="list"
        >
            <div class="ty-quad-head">
                <span class="qn">{ROMAN[g.i]}.</span>
                <div class="q-name">
                    <div class="q-cn">{g.quad.label}</div>
                    <div class="q-en">{SUBS[g.quad.key]}</div>
                </div>
                <span class="ty-quad-hint">{g.count} 项待办 ({g.pct}%)</span>
                <button class="quad-action" title="新建任务" aria-label="在{g.quad.label}新建任务" on:click={() => (quickDraft = { ...quickDraft, [g.quad.key]: quickDraft[g.quad.key] === undefined ? "" : undefined })}>＋</button>
                <button class="quad-action" title={expandedKey ? "收起象限" : "展开象限"} aria-label={expandedKey ? "收起象限" : "展开象限"} on:click={() => (expandedKey = expandedKey ? "" : g.quad.key)}>{expandedKey ? "⊖" : "⛶"}</button>
            </div>

            {#if quickDraft[g.quad.key] !== undefined}
            <input
                class="ty-qadd"
                placeholder="+ 添加任务到「{g.quad.label}」，回车保存"
                value={quickDraft[g.quad.key] || ""}
                on:input={(e) => {
                    quickDraft = { ...quickDraft, [g.quad.key]: (e.target as HTMLInputElement).value };
                }}
                on:keydown={(e) => {
                    if (e.key === "Enter") {
                        addToQuad(g.quad.key, (e.target as HTMLInputElement).value, e.target as HTMLInputElement);
                    }
                }}
            />
            {/if}

            {#if g.items.length === 0}
                <div class="quad-empty">
                    <div class="qe-ic">☰</div>
                    <div>暂无待办，点击上方 + 按钮添加吧 ✨</div>
                    <div class="qe-sub">点击右上角 + 按钮添加，或拖拽卡片至此</div>
                </div>
            {:else}
                {#each g.items as t (t.id)}
                    <div
                        class="ty-qcard"
                        draggable="true"
                        on:dragstart={(e) => onDragStart(e, t)}
                        on:dragend={onDragEnd}
                        role="listitem"
                    >
                        <button class="qc-body" on:click={() => (detailTask = t)} title="打开任务详情">
                            <span class="qc-title">{#if t.isPinned}📌 {/if}{t.title} {#if t.isFavorite}♥{/if} {#if timer.running && timer.mode === 'focus' && timer.taskId === t.id}🍅 专注中{/if}</span>
                            {#if t.description || t.note}
                                <span class="qc-desc">{t.description || t.note}</span>
                            {/if}
                            <span class="qc-meta">
                                <span class="cat-dot" style="background:{catColor(t)}"></span>
                                {#if hasDateBadge(t)}
                                    <span class="date-badge" class:overdue={!!t.due && daysUntil(t.due) < 0} class:today={!!t.due && daysUntil(t.due) === 0}>
                                        📅 {dueDateText(t)}{#if t.due}（{dueText(t)}）{/if}
                                    </span>
                                {/if}
                            </span>
                        </button>
                        <div class="card-actions">
                            <button title={t.isPinned ? '取消置顶' : '置顶'} aria-label={t.isPinned ? '取消置顶' : '置顶'} aria-pressed={!!t.isPinned} on:click={() => toggleFlag(t, 'isPinned')}>📌</button>
                            <button title={t.isFavorite ? '取消收藏' : '收藏'} aria-label={t.isFavorite ? '取消收藏' : '收藏'} aria-pressed={!!t.isFavorite} on:click={() => toggleFlag(t, 'isFavorite')}>♥</button>
                            <button title={t.isEvening ? '移出今晚清单' : '加入今晚清单'} aria-label={t.isEvening ? '移出今晚清单' : '加入今晚清单'} aria-pressed={!!t.isEvening} on:click={() => toggleFlag(t, 'isEvening')}>☾</button>
                            <button title="开始专注" aria-label="开始专注" on:click={() => startFocus(t)}>◷</button>
                            <button title="标记完成" aria-label="标记完成" on:click={() => toggle(t)}>✓</button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/each}
</div>
{/if}

<style>
    .head-bar {
        background: var(--card);
        border: 1px solid var(--b3-border-color);
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    .hb-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .hb-title {
        font-size: 15px;
        font-weight: 700;
    }
    .hb-pill {
        font-size: 10.5px;
        color: var(--text-3);
        background: rgba(0, 0, 0, 0.04);
        padding: 3px 10px;
        border-radius: 12px;
    }
    .search-box {
        flex: 1;
        min-width: 140px;
        display: flex;
        align-items: center;
        gap: 7px;
        background: var(--card);
        border-radius: 12px;
        padding: 7px 12px;
    }
    .search-box input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--text);
        font-family: inherit;
        font-size: 12px;
        outline: none;
    }
    .search-box input::placeholder {
        color: var(--text-3);
    }
    .s-ic {
        color: var(--text-3);
        font-size: 14px;
    }
    .guide {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        background: var(--card);
        border-radius: 14px;
        padding: 14px;
    }
    .g-item {
        font-size: 11.5px;
        color: var(--text-2);
        line-height: 1.6;
    }
    .g-item b {
        color: var(--text);
        margin-right: 4px;
    }

    .ty-matrix.expanded { grid-template-columns: 1fr; }
    .quad-action, .card-actions button {
        border: 1px solid var(--b3-border-color); border-radius: 7px; background: transparent;
        color: var(--text-2); cursor: pointer; padding: 3px 6px;
    }
    .card-actions { display: flex; flex-wrap: wrap; gap: 3px; justify-content: flex-end; }
    .card-actions button[aria-pressed="true"] { color: #a34e36; background: rgba(232,160,191,.2); }
    .q-name {
        flex: 1;
        min-width: 0;
    }
    .q-cn {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.3;
    }
    .q-en {
        font-size: 9.5px;
        opacity: 0.5;
        letter-spacing: 0.3px;
    }
    .qn {
        font-weight: 800;
        opacity: 0.4;
        font-size: 12px;
    }
    .quad-empty {
        text-align: center;
        padding: 34px 8px;
        font-size: 11.5px;
        color: var(--text-3);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .qe-ic {
        font-size: 20px;
        opacity: 0.35;
    }
    .qe-sub {
        font-size: 10px;
        opacity: 0.6;
    }

    .ty-qcard {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 11px 12px;
    }
    .qc-body {
        border: 0; padding: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; font-family: inherit;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .qc-title {
        font-size: 12.5px;
        font-weight: 600;
        line-height: 1.45;
        word-break: break-word;
    }
    .qc-desc {
        font-size: 11px;
        color: var(--text-3);
        line-height: 1.55;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .qc-meta {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: 2px;
    }
    .cat-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: 0 0 auto;
    }
    .date-badge {
        font-size: 9.5px;
        padding: 2px 7px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.7);
        color: var(--text-2);
        white-space: nowrap;
    }
    .ty-root.dark .date-badge {
        background: rgba(255, 255, 255, 0.07);
    }
    .date-badge.overdue {
        background: #fdecea;
        color: #b0543f;
    }
    .date-badge.today {
        background: #fff0e6;
        color: #a64424;
        font-weight: 700;
    }
    .ty-root.dark .date-badge.overdue {
        background: #3d2325;
        color: #e57c58;
    }
    .ty-root.dark .date-badge.today {
        background: #382723;
        color: #e57c58;
    }
</style>
