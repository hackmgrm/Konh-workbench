<script lang="ts">
    import { tasks, categories, save, uid } from "../lib/store";
    import { REPEAT_LABELS, QUADRANTS } from "../lib/types";
    import type { Task, Subtask, RepeatRule } from "../lib/types";

    export let task: Task;
    export let onClose: () => void;

    let tab: "settings" | "note" = "settings";
    let subDraft = "";
    let tagDraft = "";

    function addTag() {
        const t = tagDraft.trim();
        if (!t) return;
        if (draft.tags.includes(t)) {
            tagDraft = "";
            return;
        }
        draft = { ...draft, tags: [...draft.tags, t] };
        tagDraft = "";
    }

    function removeTag(t: string) {
        draft = { ...draft, tags: draft.tags.filter((x) => x !== t) };
    }

    let draft: Task = {
        ...task,
        subtasks: task.subtasks ? task.subtasks.map((s) => ({ ...s })) : []
    };

    const REMINDERS = [
        { value: 0, label: "不提醒" },
        { value: 5, label: "提前 5 分钟" },
        { value: 15, label: "提前 15 分钟" },
        { value: 30, label: "提前 30 分钟" },
        { value: 60, label: "提前 1 小时" },
        { value: 1440, label: "提前 1 天" }
    ];

    function set<K extends keyof Task>(key: K, value: Task[K]) {
        draft = { ...draft, [key]: value };
    }

    function commit() {
        const t = draft.title.trim();
        if (!t) {
            draft = { ...draft, title: "未命名任务" };
        }
        tasks.update((l) => l.map((x) => (x.id === task.id ? { ...draft } : x)));
        save("tasks");
        onClose();
    }

    function removeTask() {
        tasks.update((l) => l.filter((x) => x.id !== task.id));
        save("tasks");
        onClose();
    }

    function addSub() {
        const v = subDraft.trim();
        if (!v) return;
        draft = {
            ...draft,
            subtasks: [...draft.subtasks, { id: uid(), title: v, done: false }]
        };
        subDraft = "";
    }

    function toggleSub(id: string) {
        draft = {
            ...draft,
            subtasks: draft.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
        };
    }

    function removeSub(id: string) {
        draft = { ...draft, subtasks: draft.subtasks.filter((s) => s.id !== id) };
    }

    function setQuad(key: string) {
        draft = {
            ...draft,
            important: key === "q1" || key === "q2",
            urgent: key === "q1" || key === "q3"
        };
    }

    $: currentQuad = draft.important && draft.urgent ? "q1" : draft.important ? "q2" : draft.urgent ? "q3" : "q4";
    $: subDone = draft.subtasks.filter((s) => s.done).length;
</script>

<header class="dt-head">
    <button class="dt-back" on:click={onClose} aria-label="返回">‹</button>
    <span class="dt-title">任务详情</span>
    <button class="dt-save" on:click={commit}>保存</button>
</header>

<div class="dt-tabs">
    <button class="dt-tab" class:active={tab === "settings"} on:click={() => (tab = "settings")}>
        任务设置
    </button>
    <button class="dt-tab" class:active={tab === "note"} on:click={() => (tab = "note")}>
        任务备注{draft.note ? " ·" : ""}
    </button>
</div>

<div class="dt-body">
    {#if tab === "settings"}
        <input class="dt-input title" bind:value={draft.title} placeholder="请输入任务标题" />

        <div class="dt-section">
            <div class="dt-label">所属项目</div>
            <input class="dt-input" placeholder="项目名称（可选）" value={draft.project || ""} on:input={(e) => set("project", e.currentTarget.value)} />
        </div>

        <div class="dt-section">
            <div class="dt-label">任务分类</div>
            <div class="chips">
                {#each $categories as c (c.id)}
                    <button
                        class="chip"
                        class:active={draft.category === c.id}
                        style="--c:{c.color}"
                        on:click={() => set("category", c.id)}
                    >
                        <span class="dot" style="background:{c.color}"></span>
                        {c.name}
                    </button>
                {/each}
            </div>
        </div>

        <div class="dt-section">
            <div class="dt-label">任务日期</div>

            <div class="dline">
                <span class="dk">开始</span>
                <input
                    class="dt-input"
                    type="date"
                    value={draft.start}
                    on:change={(e) => set("start", (e.target as HTMLInputElement).value)}
                />
                {#if draft.start}
                    <button class="clear" on:click={() => set("start", "")} aria-label="清除">✕</button>
                {/if}
            </div>

            <div class="dline">
                <span class="dk">截止</span>
                <input
                    class="dt-input"
                    type="date"
                    value={draft.due}
                    on:change={(e) => set("due", (e.target as HTMLInputElement).value)}
                />
                {#if draft.due}
                    <button class="clear" on:click={() => set("due", "")} aria-label="清除">✕</button>
                {/if}
            </div>
        </div>

        <div class="dt-section">
            <div class="dline">
                <span class="dk">重复</span>
                <select
                    class="dt-input"
                    value={draft.repeat}
                    on:change={(e) => set("repeat", (e.target as HTMLSelectElement).value as RepeatRule)}
                >
                    {#each REPEAT_LABELS as r (r.key)}
                        <option value={r.key}>{r.label}</option>
                    {/each}
                </select>
            </div>

            <div class="dline">
                <span class="dk">提醒</span>
                <select
                    class="dt-input"
                    value={String(draft.reminder)}
                    on:change={(e) => set("reminder", Number((e.target as HTMLSelectElement).value))}
                >
                    {#each REMINDERS as r (r.value)}
                        <option value={String(r.value)}>{r.label}</option>
                    {/each}
                </select>
            </div>
            <div class="dt-label">提醒以截止日当地时间 09:00 为准，需设置截止日期；仅在插件运行时提示。</div>
        </div>

        <div class="dt-section">
            <div class="dt-label">任务分类（四象限）</div>
            <div class="quads">
                {#each QUADRANTS as q, i (q.key)}
                    <button
                        class="quad"
                        class:active={currentQuad === q.key}
                        on:click={() => setQuad(q.key)}
                    >
                        <b>{i + 1}</b>
                        <span>{q.label}</span>
                    </button>
                {/each}
            </div>
        </div>

        <div class="dt-section">
            <div class="dt-label">标签</div>
            {#if draft.tags.length > 0}
                <div class="chips">
                    {#each draft.tags as tag (tag)}
                        <button class="tag-chip" on:click={() => removeTag(tag)}>
                            {tag} <span>✕</span>
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="dline">
                <input
                    class="dt-input"
                    placeholder="输入标签，回车添加"
                    bind:value={tagDraft}
                    on:keydown={(e) => e.key === "Enter" && addTag()}
                />
                <button class="add-sub" on:click={addTag}>+</button>
            </div>
        </div>

        <div class="dt-section">
            <div class="dt-label">
                子任务
                <span class="count">{subDone}/{draft.subtasks.length}</span>
            </div>

            {#if draft.subtasks.length > 0}
                <div class="subs">
                    {#each draft.subtasks as s (s.id)}
                        <div class="sub" class:done={s.done}>
                            <button class="sub-check" class:on={s.done} on:click={() => toggleSub(s.id)} aria-label="完成"></button>
                            <span class="sub-title">{s.title}</span>
                            <button class="sub-del" on:click={() => removeSub(s.id)} aria-label="删除">✕</button>
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="dline">
                <input
                    class="dt-input"
                    placeholder="添加子任务，回车"
                    bind:value={subDraft}
                    on:keydown={(e) => e.key === "Enter" && addSub()}
                />
                <button class="add-sub" on:click={addSub}>+</button>
            </div>
        </div>
    {:else}
        <textarea
            class="dt-input note"
            placeholder="写下这个任务的背景、要求、参考链接…"
            bind:value={draft.note}
        ></textarea>
    {/if}
</div>

<footer class="dt-foot">
    <button class="btn danger" on:click={removeTask}>删除</button>
    <div class="sp"></div>
    <button class="btn" on:click={onClose}>取消</button>
    <button class="btn primary" on:click={commit}>保存</button>
</footer>

<style>
    :global(.dt-wrap) {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
    .dt-head {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--b3-border-color);
    }
    .dt-back {
        width: 26px;
        height: 26px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--b3-theme-on-surface);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
    }
    .dt-back:hover {
        background: var(--b3-theme-surface);
    }
    .dt-title {
        flex: 1;
        font-size: 13px;
        font-weight: 600;
    }
    .dt-save {
        border: 0;
        background: transparent;
        color: var(--b3-theme-primary);
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
    }
    .dt-save:hover {
        background: var(--b3-theme-primary-lightest);
    }

    .dt-tabs {
        flex: 0 0 auto;
        display: flex;
        gap: 18px;
        padding: 0 14px;
        border-bottom: 1px solid var(--b3-border-color);
    }
    .dt-tab {
        border: 0;
        background: transparent;
        color: var(--b3-theme-on-surface);
        font-family: inherit;
        font-size: 12.5px;
        padding: 10px 0 9px;
        cursor: pointer;
        position: relative;
        opacity: 0.65;
    }
    .dt-tab.active {
        color: var(--b3-theme-primary);
        opacity: 1;
        font-weight: 600;
    }
    .dt-tab.active::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        border-radius: 2px;
        background: var(--b3-theme-primary);
    }

    .dt-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .dt-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-background);
        font-family: inherit;
        font-size: 12.5px;
        padding: 8px 10px;
        border-radius: 8px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .dt-input:focus {
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 3px var(--b3-theme-primary-lightest);
    }
    .dt-input.title {
        font-size: 15px;
        font-weight: 600;
        padding: 11px 12px;
    }
    .dt-input.note {
        flex: 1;
        min-height: 240px;
        line-height: 1.7;
        resize: vertical;
    }

    .dt-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .dt-label {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
        opacity: 0.75;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .count {
        font-weight: 400;
        opacity: 0.6;
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 11px;
        border-radius: 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-background);
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .chip .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: 0 0 auto;
    }
    .chip:hover {
        border-color: var(--c);
    }
    .chip.active {
        background: var(--c);
        border-color: var(--c);
        color: #fff;
    }
    .chip.active .dot {
        background: #fff !important;
    }

    .dline {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .dk {
        flex: 0 0 34px;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        opacity: 0.7;
    }
    .clear {
        flex: 0 0 auto;
        width: 26px;
        height: 26px;
        border: 1px solid var(--b3-border-color);
        background: transparent;
        border-radius: 6px;
        color: var(--b3-theme-on-surface);
        cursor: pointer;
        font-size: 10px;
        opacity: 0.6;
    }
    .clear:hover {
        opacity: 1;
        color: var(--b3-theme-error);
        border-color: var(--b3-theme-error);
    }

    .quads {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
    }
    .quad {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-background);
        font-family: inherit;
        font-size: 11.5px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .quad b {
        width: 17px;
        height: 17px;
        border-radius: 5px;
        background: var(--b3-theme-background);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 600;
        color: var(--b3-theme-on-surface);
    }
    .quad:hover {
        border-color: var(--b3-theme-primary);
    }
    .quad.active {
        background: var(--b3-theme-primary-lightest);
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
        font-weight: 600;
    }
    .quad.active b {
        background: var(--b3-theme-primary);
        color: #fff;
    }

    .subs {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .sub {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 12.5px;
    }
    .sub:hover {
        background: var(--b3-theme-surface);
    }
    .sub-check {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1.5px solid var(--b3-border-color);
        background: transparent;
        cursor: pointer;
        padding: 0;
        flex: 0 0 auto;
    }
    .sub-check.on {
        background: var(--b3-theme-primary);
        border-color: var(--b3-theme-primary);
    }
    .sub-title {
        flex: 1;
        word-break: break-word;
    }
    .sub.done .sub-title {
        text-decoration: line-through;
        opacity: 0.45;
    }
    .sub-del {
        border: 0;
        background: transparent;
        color: var(--b3-theme-on-surface);
        cursor: pointer;
        font-size: 11px;
        opacity: 0;
    }
    .sub:hover .sub-del {
        opacity: 0.5;
    }
    .sub-del:hover {
        opacity: 1 !important;
        color: var(--b3-theme-error);
    }
    .add-sub {
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-primary);
        font-size: 16px;
        cursor: pointer;
    }

    .dt-foot {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-top: 1px solid var(--b3-border-color);
    }
    .sp {
        flex: 1;
    }
    .btn {
        padding: 7px 16px;
        border-radius: 8px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-background);
        font-family: inherit;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .btn:hover {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
    }
    .btn.primary {
        background: var(--b3-theme-primary);
        border-color: var(--b3-theme-primary);
        color: #fff;
        font-weight: 600;
    }
    .btn.primary:hover {
        opacity: 0.9;
        color: #fff;
    }
    .btn.danger:hover {
        border-color: #c25450;
        color: #c25450;
    }

    .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 8px;
        border: 1px solid #cfdfd2;
        background: #e6efe7;
        color: #4d7c5d;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
    }
    .tag-chip span {
        opacity: 0.6;
        font-size: 9px;
    }
    .tag-chip:hover span {
        opacity: 1;
    }
</style>
