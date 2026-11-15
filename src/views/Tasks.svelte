<script lang="ts">
    import { get } from "svelte/store";
    import { toggleTask } from "../lib/taskCompletion";
    import { tasks, save, uid } from "../lib/store";
    import { quadOf } from "../lib/types";
    import { daysUntil, dayKey } from "../lib/time";
    import { pomodoro, timerState, attachCurrentTask } from "../lib/timer";
    import type { Task } from "../lib/types";
    import TaskDetail from "./TaskDetail.svelte";
    import AiInbox from "./AiInbox.svelte";

    let showInbox = false;
    type SavedView = { id: string; name: string; query: string; status: string; quadrant: string; tag: string; due: string; project: string; starred: boolean };
    const savedKey = "konh.tasks.saved-views.v1";
    let draft = "";
    let draftDue = "";
    let query = "";
    let filter: "open" | "done" | "all" = "open";
    let quadrant = "all";
    let tag = "all";
    let dueFilter = "all";
    let projectFilter = "all";
    let projectDraft = "";
    let starredOnly = false;
    let viewName = "";
    let activeView = "";
    let savedViews: SavedView[] = [];
    let clipOpen = false;
    let clipText = "";
    let detailTask: Task | null = null;

    try {
        const stored = JSON.parse(localStorage.getItem(savedKey) || "[]");
        if (Array.isArray(stored)) savedViews = stored.filter(v => v && typeof v.id === "string" && typeof v.name === "string");
    } catch { savedViews = []; }

    $: tags = [...new Set($tasks.flatMap(t => t.tags || []))].sort();
    $: projects = [...new Set($tasks.map(t => (t.project || "").trim()).filter(Boolean))].sort();
    $: filtered = (() => {
        const today = dayKey();
        return $tasks.filter(t => {
            if (filter === "open" && t.done || filter === "done" && !t.done) return false;
            const q = query.trim().toLocaleLowerCase();
            if (q && ![t.title, t.note, t.description || "", t.url, ...(t.tags || [])].some(s => s.toLocaleLowerCase().includes(q))) return false;
            if (quadrant !== "all" && quadOf(t).key !== quadrant) return false;
            if (tag !== "all" && !(t.tags || []).includes(tag)) return false;
            if (projectFilter === "none" && (t.project || "").trim()) return false;
            if (projectFilter.startsWith("project:") && (t.project || "") !== projectFilter.slice(8)) return false;
            if (starredOnly && !t.isFavorite) return false;
            if (dueFilter === "today" && t.due !== today) return false;
            if (dueFilter === "week" && (!t.due || t.due < today || daysUntil(t.due) > 7)) return false;
            if (dueFilter === "overdue" && (!t.due || t.due >= today || t.done)) return false;
            if (dueFilter === "none" && !!t.due) return false;
            return true;
        }).sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || (a.due || "9999").localeCompare(b.due || "9999") || b.created - a.created);
    })();
    $: overdue = $tasks.filter(t => !t.done && t.due && daysUntil(t.due) < 0).length;
    $: focusingId = $timerState.taskId;
    $: isFocusing = $timerState.running && $timerState.mode === "focus";


    function blank(title: string, extra: Partial<Task> = {}): Task {
        return {
            id: uid(),
            title,
            note: "",
            done: false,
            important: false,
            urgent: false,
            created: Date.now(),
            doneAt: 0,
            due: "",
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
            description: "",
            ...extra
        };
    }

    function add() {
        const v = draft.trim();
        if (!v) return;
        const project = projectDraft.trim() || (projectFilter.startsWith("project:") ? projectFilter.slice(8) : "");
        tasks.update(l => [blank(v, { due: draftDue, project, important: quadrant === "q1" || quadrant === "q2", urgent: quadrant === "q1" || quadrant === "q3" }), ...l]);
        save("tasks");
        draft = "";
        draftDue = "";
        projectDraft = "";
    }

    function toggleFlag(id: string, key: "isFavorite" | "isPinned") {
        tasks.update(list => list.map(t => t.id === id ? { ...t, [key]: !t[key] } : t));
        save("tasks");
    }

    function focusTask(t: Task) {
        const state = get(timerState);
        if (state.running && state.mode === "focus" && state.taskId === t.id) return;
        if (state.running || state.mode !== "focus" || (state.taskId && state.taskId !== t.id)) {
            if (!window.confirm("开始新专注会重置当前计时，继续吗？")) return;
            pomodoro.reset("focus");
        }
        attachCurrentTask(t.id);
        pomodoro.start();
    }

    function saveCurrentView() {
        const name = viewName.trim();
        if (!name) return;
        const entry: SavedView = { id: uid(), name, query, status: filter, quadrant, tag, due: dueFilter, project: projectFilter, starred: starredOnly };
        savedViews = [...savedViews, entry];
        localStorage.setItem(savedKey, JSON.stringify(savedViews));
        activeView = entry.id;
        viewName = "";
    }

    function chooseView(id: string) {
        activeView = id;
        const v = savedViews.find(x => x.id === id);
        if (!v) return;
        query = v.query; filter = v.status as typeof filter; quadrant = v.quadrant; tag = v.tag; dueFilter = v.due; projectFilter = v.project || "all"; starredOnly = v.starred;
    }

    function removeView() {
        savedViews = savedViews.filter(v => v.id !== activeView);
        localStorage.setItem(savedKey, JSON.stringify(savedViews));
        activeView = "";
    }

    function toggle(t: Task) {
        tasks.update((l) => toggleTask(l, t.id));
        save("tasks");
    }

    function remove(id: string) {
        tasks.update((l) => l.filter((x) => x.id !== id));
        save("tasks");
    }

    function dueLabel(t: Task): string {
        if (!t.due) return "";
        const n = daysUntil(t.due);
        if (n < 0) return `逾期 ${-n} 天`;
        if (n === 0) return "今天";
        if (n === 1) return "明天";
        return `${n} 天后`;
    }

    function quadrantColor(t: Task): string {
        const key = quadOf(t).key;
        return key === "q1" ? "#d99ab3" : key === "q2" ? "#d8bb7a" : key === "q3" ? "#8badcf" : "#c4d7b2";
    }

    function dueClass(t: Task): string {
        if (!t.due) return "";
        const n = daysUntil(t.due);
        if (n < 0) return "od";
        if (n <= 1) return "soon";
        return "";
    }

    function subLabel(t: Task): string {
        if (!t.subtasks || t.subtasks.length === 0) return "";
        return `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`;
    }

    function openDetail(t: Task) {
        detailTask = t;
    }

    /* ---------- 剪藏 ---------- */
    function looksLikeUrl(s: string): boolean {
        return /^https?:\/\//i.test(s.trim());
    }

    function titleFromUrl(u: string): string {
        try {
            const url = new URL(u.trim());
            const seg = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
            const clean = seg.replace(/[-_]/g, " ").replace(/\.(html?|php|aspx?)$/i, "");
            return clean ? clean.slice(0, 80) : url.hostname;
        } catch {
            return u.trim().slice(0, 80);
        }
    }

    function createClip() {
        const raw = clipText.trim();
        if (!raw) return;
        if (looksLikeUrl(raw)) {
            tasks.update((l) => [blank(titleFromUrl(raw), { url: raw }), ...l]);
        } else {
            const firstLine = raw.split("\n")[0].trim().slice(0, 80);
            tasks.update((l) => [
                blank(firstLine || "剪藏", { note: raw.length > firstLine.length ? raw : "" }),
                ...l
            ]);
        }
        save("tasks");
        clipText = "";
        clipOpen = false;
    }
</script>

{#if detailTask}
    <div class="dt-wrap">
        <TaskDetail
            task={detailTask}
            onClose={() => {
                detailTask = null;
            }}
        />
    </div>
{:else}
    <div class="list-heading"><div><div class="page-title">待办任务列表</div><div class="page-sub">按优先级浏览待办，支持关键词实时搜索</div></div><button class="ty-btn" on:click={() => showInbox = !showInbox}>✦ AI 智能收集箱</button></div>
    <AiInbox visible={showInbox} onClose={() => showInbox = false} />
    <section class="task-list">
    <div class="filters">
        <input class="ty-input search" aria-label="搜索任务" placeholder="搜索任务、描述或标签" bind:value={query} on:input={() => activeView = ""} />
        <select aria-label="象限" bind:value={quadrant} on:change={() => activeView = ""}>
            <option value="all">所有象限</option><option value="q1">重要且紧急</option><option value="q2">重要不紧急</option><option value="q3">紧急不重要</option><option value="q4">不重要不紧急</option>
        </select>
        <select aria-label="标签" bind:value={tag} on:change={() => activeView = ""}><option value="all">所有标签</option>{#each tags as item}<option value={item}>{item}</option>{/each}</select>
        <button class="ty-btn" class:on={starredOnly} aria-pressed={starredOnly} on:click={() => { starredOnly = !starredOnly; activeView = ""; }}>★ 星标</button>
    </div>
    <div class="filters secondary">
        <select aria-label="项目" bind:value={projectFilter} on:change={() => activeView = ""}><option value="all">所有项目</option><option value="none">未归项目</option>{#each projects as project}<option value="project:{project}">{project}</option>{/each}</select>
        <select aria-label="到期范围" bind:value={dueFilter} on:change={() => activeView = ""}><option value="all">所有日期</option><option value="today">今日</option><option value="week">未来 7 天</option><option value="overdue">已逾期</option><option value="none">无日期</option></select>
        <select aria-label="保存的筛选" value={activeView} on:change={(e) => chooseView(e.currentTarget.value)}><option value="">保存的筛选</option>{#each savedViews as view}<option value={view.id}>{view.name}</option>{/each}</select>
        {#if activeView}<button class="ty-btn sm" on:click={removeView}>移除筛选</button>{/if}
        <form class="save-view" on:submit|preventDefault={saveCurrentView}><input class="ty-input" aria-label="筛选名称" placeholder="给当前筛选命名" maxlength="60" bind:value={viewName} /><button class="ty-btn sm" disabled={!viewName.trim()}>保存筛选</button></form>
    </div>
    <form class="quick-add" on:submit|preventDefault={add}>
        <input class="ty-input" aria-label="新任务" placeholder="添加任务，回车" bind:value={draft} />
        <input class="ty-input project" aria-label="项目" placeholder="项目（可选）" bind:value={projectDraft} />
        <input class="ty-input date" type="date" aria-label="新任务截止日期" bind:value={draftDue} />
        <button class="ty-btn primary" disabled={!draft.trim()}>添加</button>
        <button type="button" class="ty-btn" title="从链接或文字创建" on:click={() => (clipOpen = true)}>剪藏</button>
    </form>

    <div class="ty-row" style="gap:6px;margin-bottom:12px;flex-wrap:wrap">
        {#each [["open", "未完成"], ["done", "已完成"], ["all", "全部"]] as f}
            <button
                class="ty-btn sm"
                class:on={filter === f[0]}
                on:click={() => { filter = f[0] as typeof filter; activeView = ""; }}
            >
                {f[1]}
            </button>
        {/each}
        <div class="ty-spacer"></div>
        {#if overdue > 0}
            <span class="ty-dim" style="color:var(--b3-theme-error)">{overdue} 项逾期</span>
        {:else}
            <span class="ty-dim">{filtered.length} 项</span>
        {/if}
    </div>

    {#if filtered.length === 0}
        <div class="ty-empty">{filter === "done" ? "还没有完成的任务" : "没有任务"}</div>
    {:else}
        <div>
            {#each filtered as t (t.id)}
                <div class="item" class:done={t.done}>
                    <button
                        class="ty-check"
                        class:checked={t.done}
                        on:click={() => toggle(t)}
                        aria-label={t.done ? `重新打开 ${t.title}` : `完成 ${t.title}`} title={t.done ? '重新打开' : '完成'}
                    ></button>

                    <button class="body" on:click={() => openDetail(t)}>
                        <span class="t-title"><span class="priority-dot" style="background:{quadrantColor(t)}"></span>{#if t.isPinned}📌 {/if}{t.title}{#if t.isFavorite} ♥{/if}</span>
                        {#if t.description || t.note}<span class="description">{t.description || t.note}</span>{/if}
                        <span class="meta">
                            {#if t.due}
                                <span class="due {dueClass(t)}">{dueLabel(t)}</span>
                            {/if}
                            {#if t.repeat !== "none"}
                                <span class="tag">↻</span>
                            {/if}
                            {#if subLabel(t)}
                                <span class="tag">☑ {subLabel(t)}</span>
                            {/if}
                            {#if t.project}<span class="tag project-tag">{t.project}</span>{/if}
                            {#each t.tags || [] as taskTag}<span class="tag task-tag">#{taskTag}</span>{/each}
                            {#if t.note}
                                <span class="tag">≡</span>
                            {/if}
                            {#if isFocusing && focusingId === t.id}<span class="due soon">专注中</span>{/if}
                            {#if t.url}
                                <span class="tag">⛓</span>
                            {/if}
                        </span>
                    </button>

                    <span class="quad-tag">{quadOf(t).label}</span>
                    <div class="actions">
                        <button class:chosen={t.isPinned} title={t.isPinned ? '取消置顶' : '置顶'} aria-label={t.isPinned ? `取消置顶 ${t.title}` : `置顶 ${t.title}`} aria-pressed={!!t.isPinned} on:click={() => toggleFlag(t.id, 'isPinned')}>📌</button>
                        <button class:chosen={t.isFavorite} title={t.isFavorite ? '取消星标' : '星标'} aria-label={t.isFavorite ? `取消星标 ${t.title}` : `星标 ${t.title}`} aria-pressed={!!t.isFavorite} on:click={() => toggleFlag(t.id, 'isFavorite')}>{t.isFavorite ? '★' : '☆'}</button>
                        <button title="开始专注" aria-label={`专注 ${t.title}`} on:click={() => focusTask(t)}>◷</button>
                        <button title="详情" aria-label={`查看 ${t.title} 详情`} on:click={() => openDetail(t)}>详情</button>
                        <button title="删除" aria-label={`删除 ${t.title}`} on:click={() => { if (window.confirm(`删除任务“${t.title}”？`)) remove(t.id); }}>✕</button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
    </section>
{/if}

{#if clipOpen}
    <div
        class="mask"
        role="presentation"
        on:click={(e) => e.target === e.currentTarget && (clipOpen = false)}
    >
        <div class="clip">
            <div class="ty-h2">从链接或文字创建任务</div>
            <div class="ty-dim" style="margin-bottom:8px">
                粘贴网页链接，或用一段文字生成任务。链接会保留在任务来源里。
            </div>
            <textarea
                class="ty-textarea"
                style="min-height:120px"
                placeholder="https://… 或直接粘贴一段文字"
                bind:value={clipText}
                on:keydown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && createClip()}
            ></textarea>
            <div class="ty-row" style="justify-content:flex-end;gap:6px;margin-top:10px">
                <button class="ty-btn" on:click={() => (clipOpen = false)}>取消</button>
                <button class="ty-btn primary" on:click={createClip}>创建</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .list-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .description { color:var(--text-3); font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
    .task-list { padding: 16px; border: 1px solid var(--b3-border-color); border-radius: 16px; background: var(--b3-theme-background); color: var(--b3-theme-on-background); }
    .filters, .quick-add, .save-view { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filters { padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--b3-border-color); }
    .filters.secondary { border: 0; padding: 0; }
    .search, .quick-add > input:first-child { flex: 1 1 180px; }
    select { font: inherit; color: var(--b3-theme-on-background); background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: 8px; padding: 7px; max-width: 180px; }
    .quick-add { margin-bottom: 12px; }
    .quick-add .date { flex: 0 1 150px; width: 150px; }
    .save-view input { width: 150px; }
    .quick-add .project { flex: 0 1 130px; width: 130px; }
    .actions { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
    .actions button { border: 0; border-radius: 6px; background: transparent; color: var(--b3-theme-on-surface); padding: 5px; cursor: pointer; }
    .actions button:hover, .actions button:focus-visible { background: var(--b3-theme-surface); }
    .actions button.chosen { color: var(--b3-theme-primary); }
    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 8px 8px 0;
        border-radius: 7px;
        transition: background 0.14s;
        position: relative;
        border: 1px solid var(--b3-border-color);
        margin-bottom: 6px;
        padding-left: 8px;
        flex-wrap: wrap;
    }
    .item:hover {
        background: var(--b3-theme-surface);
    }
    .item.done .t-title {
        text-decoration: line-through;
        opacity: 0.4;
    }
    .bar {
        flex: 0 0 3px;
        align-self: stretch;
        border-radius: 0 2px 2px 0;
        opacity: 0.85;
    }
    .body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        border: 0;
        background: transparent;
        color: inherit;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
        padding: 0;
    }
    .t-title {
        font-size: 12.5px;
        line-height: 1.5;
        word-break: break-word;
    }
    .priority-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin:0 7px 1px 0; }
    .project-tag { padding:1px 6px; border-radius:6px; background:var(--b3-theme-surface); opacity:.8; }
    .task-tag { color:var(--b3-theme-primary); opacity:.8; }
    .meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .due {
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        opacity: 0.85;
    }
    .due.od {
        background: var(--b3-theme-error);
        color: #fff;
        opacity: 1;
    }
    .due.soon {
        color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-lightest);
        opacity: 1;
    }
    .tag {
        font-size: 10px;
        opacity: 0.45;
    }
    .quad-tag {
        flex: 0 0 auto;
        font-size: 10px;
        opacity: 0.45;
    }
    .mask {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .clip {
        width: min(480px, 90vw);
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    }
</style>
