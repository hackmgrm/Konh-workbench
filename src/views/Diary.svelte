<script lang="ts">
    import { diaries, tasks, focusRecords, habits, settings, save } from "../lib/store";
    import { dayKey, parseDayKey, fmtDateCN, fmtTime } from "../lib/time";
    import { MOODS, MOOD_LABELS, extractTags, type JournalEntry } from "../lib/types";

    export let initialDate = "";

    const PROMPTS = [
        "今天有什么小事让你觉得活着挺好？",
        "如果给今天起个名字，会叫什么？",
        "今天学到的一件新东西是什么？",
        "有没有哪一刻你想按下暂停键？",
        "今天对谁说过谢谢？为什么？",
        "最近在焦虑什么？它真的会发生吗？",
        "如果明天只做一件事，你希望是什么？",
        "今天有什么让你笑的瞬间？",
        "有哪件事你做得比昨天好一点？",
        "今天有没有对自己太苛刻？"
    ];

    let dateKey = initialDate || dayKey();
    let query = "";
    let promptIdx = Math.floor(Math.random() * PROMPTS.length);
    let showPrompt = true;
    let commentLoading = false;

    $: aiReady = !!(($settings.ai.endpoint || "").trim() && ($settings.ai.key || "").trim() && ($settings.ai.model || "").trim());

    async function genComment() {
        if (commentLoading || !content.trim()) return;
        const a = $settings.ai;
        if (!aiReady) return;
        const requestedDate = dateKey;
        const requestedContent = content;
        commentLoading = true;
        try {
            const base = a.endpoint.replace(/\/+$/, "");
            const url = base.includes("/chat/completions") ? base : base + "/chat/completions";
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.key },
                body: JSON.stringify({
                    model: a.model,
                    messages: [
                        {
                            role: "user",
                            content: `这是我今天的日记：\n\n${requestedContent}\n\n请用两三句温和、克制的中文给一句暖评。不要评价好坏，不要提建议，不要说教。`
                        }
                    ],
                    max_tokens: 160,
                    temperature: 0.85
                })
            });
            const j = await res.json();
            const txt = j?.choices?.[0]?.message?.content?.trim();
            if (txt) {
                diaries.update((d) => ({
                    ...d,
                    [requestedDate]: { ...(d[requestedDate] || empty()), aiComment: txt, updatedAt: Date.now() }
                }));
                save("diaries");
            }
        } catch {
            /* 忽略失败 */
        }
        commentLoading = false;
    }

    function empty(): JournalEntry {
        return { content: "", mood: -1, tags: [], aiComment: "", updatedAt: 0 };
    }

    $: entry = $diaries[dateKey] || empty();
    $: content = entry.content || "";
    $: mood = entry.mood;
    $: tags = extractTags(content);

    $: strip = Array.from({ length: 15 }, (_, i) => {
        const d = parseDayKey(dateKey);
        d.setDate(d.getDate() - 7 + i);
        return dayKey(d);
    });

    $: q = query.trim().toLowerCase();
    $: matchCount = q
        ? Object.keys($diaries).filter((k) => ($diaries[k].content || "").toLowerCase().includes(q)).length
        : 0;

    function update(patch: Partial<JournalEntry>) {
        diaries.update((d) => ({
            ...d,
            [dateKey]: { ...(d[dateKey] || empty()), ...patch, updatedAt: Date.now() }
        }));
        save("diaries");
    }

    function setContent(v: string) {
        update({ content: v, tags: extractTags(v) });
    }

    function setMood(m: number) {
        update({ mood: mood === m ? -1 : m });
    }

    function go(delta: number) {
        const d = parseDayKey(dateKey);
        d.setDate(d.getDate() + delta);
        dateKey = dayKey(d);
    }

    function goToday() {
        dateKey = dayKey();
    }

    function download(name: string, text: string) {
        const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportCurrent() {
        const e = $diaries[dateKey];
        if (!e || !(e.content || "").trim()) return;
        const lines = [`# ${dateKey}`, "", `心情：${e.mood >= 0 ? MOODS[e.mood] + " " + MOOD_LABELS[e.mood] : "未记录"}`, "", e.content.trim()];
        if (e.aiComment) lines.push("", "---", "", `> ${e.aiComment}`);
        download(`日记-${dateKey}.md`, lines.join("\n"));
    }

    function exportAll() {
        const keys = Object.keys($diaries)
            .filter((k) => ($diaries[k].content || "").trim())
            .sort();
        if (keys.length === 0) return;
        const blocks = keys.map((k) => {
            const e = $diaries[k];
            const m = e.mood >= 0 ? ` （${MOODS[e.mood]}）` : "";
            return `## ${k}${m}\n\n${e.content.trim()}${e.aiComment ? `\n\n> ${e.aiComment}` : ""}`;
        });
        download(`日记全集-${dayKey()}.md`, blocks.join("\n\n---\n\n"));
    }

    function insertText(text: string) {
        const next = content ? content + "\n" + text : text;
        setContent(next);
    }

    /* ---------- 今日关联 ---------- */
    $: dayTasks = $tasks.filter((t) => !t.done && (t.start === dateKey || t.due === dateKey));
    $: dayDone = $tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === dateKey);
    $: dayFocus = $focusRecords.filter((f) => f.day === dateKey);
    $: dayMinutes = dayFocus.reduce((a, b) => a + b.minutes, 0);

    function toggleHabit(id: string) {
        habits.update((l) =>
            l.map((h) => {
                if (h.id !== id) return h;
                const rec = { ...h.records };
                if (rec[dateKey]) delete rec[dateKey];
                else rec[dateKey] = 1;
                return { ...h, records: rec };
            })
        );
        save("habits");
    }

    $: recent = Object.keys($diaries)
        .filter((k) => ($diaries[k].content || "").trim())
        .sort()
        .reverse()
        .slice(0, 6);
</script>

<div class="page-head">
    <div>
        <div class="page-title">日记手账</div>
        <div class="page-sub">写下今天，日子就有了形状。</div>
    </div>
    <div class="ty-row" style="gap:6px">
        <button class="ty-btn sm" on:click={exportCurrent} disabled={!(entry.content || "").trim()}>↓ 导出这篇</button>
        <button class="ty-btn sm" on:click={exportAll}>↓ 导出全部</button>
    </div>
</div>

<div class="strip-bar">
    <button class="arrow" on:click={() => go(-1)}>‹</button>
    <div class="strip">
        {#each strip as k (k)}
            {@const e = $diaries[k]}
            <button
                class="day-cell"
                class:on={k === dateKey}
                class:has={!!(e && ((e.content || "").trim() || e.mood >= 0))}
                on:click={() => (dateKey = k)}
            >
                <span class="dm">{k.slice(5)}</span>
                <span class="de">{e && e.mood >= 0 ? MOODS[e.mood] : ""}</span>
                <i class="dot"></i>
            </button>
        {/each}
    </div>
    <button class="arrow" on:click={() => go(1)}>›</button>
    <button class="ty-btn sm" on:click={goToday}>今天</button>

    <div class="search-inline">
        <input class="ty-input" placeholder="搜索日记…" bind:value={query} />
        {#if q}<span class="ty-dim">{matchCount} 篇命中</span>{/if}
    </div>
</div>

<div class="layout">
    <div class="main">
        <div class="d-head">
            <div>
                <div class="d-date">{fmtDateCN(parseDayKey(dateKey))}</div>
                <div class="d-sub">{dateKey}</div>
            </div>
            <div class="moods">
                {#each MOODS as m, i (i)}
                    <button
                        class="mood-btn"
                        class:on={mood === i}
                        title={MOOD_LABELS[i]}
                        on:click={() => setMood(i)}
                    >{m}</button>
                {/each}
            </div>
        </div>

        {#if showPrompt}
            <div class="prompt">
                <span class="p-ic">✎</span>
                <div class="p-text">{PROMPTS[promptIdx % PROMPTS.length]}</div>
                <div class="p-acts">
                    <button class="mini" on:click={() => (promptIdx = promptIdx + 1)}>换一个</button>
                    <button class="mini" on:click={() => insertText(PROMPTS[promptIdx % PROMPTS.length])}>写入</button>
                    <button class="mini" on:click={() => (showPrompt = false)}>隐藏</button>
                </div>
            </div>
        {/if}

        <div class="paper">
            <textarea
                class="paper-ta"
                placeholder="今天…"
                value={content}
                on:input={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            ></textarea>
        </div>

        {#if tags.length > 0}
            <div class="tag-row">
                {#each tags as t (t)}
                    <span class="tag">#{t}</span>
                {/each}
            </div>
        {/if}

        <div class="comment-box">
            {#if entry.aiComment}
                <div class="cx-head">
                    <span>✎ 暖评</span>
                    <button class="mini" on:click={genComment} disabled={commentLoading}>
                        {commentLoading ? "生成中…" : "重新生成"}
                    </button>
                </div>
                <div class="cx-text">{entry.aiComment}</div>
            {:else}
                <div class="cx-head">
                    <span class="cx-hint">✎ 暖评 · 写完后让 AI 说两句</span>
                    <button class="mini" on:click={genComment} disabled={commentLoading || !content.trim() || !aiReady}>
                        {commentLoading ? "生成中…" : "完成今天"}
                    </button>
                </div>
            {/if}
        </div>

        {#if entry.updatedAt}
            <div class="ty-dim" style="text-align:right">上次编辑 {fmtTime(entry.updatedAt)}</div>
        {/if}
    </div>

    <aside class="side">
        <div class="side-card">
            <div class="side-h">今日任务 · {dayTasks.length}</div>
            {#if dayTasks.length === 0}
                <div class="side-empty">没有安排到今天</div>
            {:else}
                {#each dayTasks as t (t.id)}
                    <button class="side-item" on:click={() => insertText(`- [ ] ${t.title}`)}>{t.title}</button>
                {/each}
            {/if}
        </div>

        <div class="side-card">
            <div class="side-h">今日完成 · {dayDone.length}</div>
            {#if dayDone.length === 0}
                <div class="side-empty">还没有完成的任务</div>
            {:else}
                {#each dayDone.slice(0, 8) as t (t.id)}
                    <button class="side-item done" on:click={() => insertText(`- [x] ${t.title}`)}>{t.title}</button>
                {/each}
            {/if}
        </div>

        <div class="side-card">
            <div class="side-h">今日专注</div>
            {#if dayFocus.length === 0}
                <div class="side-empty">今天还没有番茄</div>
            {:else}
                <button class="side-item" on:click={() => insertText(`今天专注 ${dayFocus.length} 个番茄，共 ${dayMinutes} 分钟。`)}>
                    {dayFocus.length} 个番茄 · {dayMinutes} 分钟
                </button>
            {/if}
        </div>

        {#if $habits.length > 0}
            <div class="side-card">
                <div class="side-h">今日习惯</div>
                {#each $habits as h (h.id)}
                    <button class="side-item habit" class:on={h.records[dateKey]} on:click={() => toggleHabit(h.id)}>
                        <span>{h.emoji}</span>
                        <span class="hname">{h.name}</span>
                        {#if h.records[dateKey]}<span class="ck">✓</span>{/if}
                    </button>
                {/each}
            </div>
        {/if}
    </aside>
</div>

{#if recent.length}
    <div class="recent">
        <span class="ty-dim">最近写过</span>
        {#each recent as k (k)}
            <button class="rchip" class:on={k === dateKey} on:click={() => (dateKey = k)}>{k.slice(5)}</button>
        {/each}
    </div>
{/if}

<style>
    .strip-bar {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .strip {
        flex: 1;
        display: flex;
        gap: 3px;
        overflow-x: auto;
        padding: 2px;
        scrollbar-width: none;
    }
    .strip::-webkit-scrollbar {
        display: none;
    }
    .arrow {
        flex: 0 0 auto;
        width: 24px;
        height: 24px;
        border: 0;
        background: transparent;
        color: #9aa398;
        font-size: 16px;
        cursor: pointer;
        border-radius: 6px;
    }
    .arrow:hover {
        background: #f5f2ea;
            color: #4d7c5d;
    }
    .day-cell {
        flex: 0 0 auto;
        width: 44px;
        padding: 6px 2px 4px;
        border-radius: 10px;
        border: 1px solid transparent;
        background: transparent;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.14s;
    }
    .day-cell:hover {
        background: #f5f2ea;
    }
    .day-cell.on {
        background: #4d7c5d;
        border-color: #4d7c5d;
    }
    .dm {
        font-size: 11px;
        color: #6b7568;
    }
    .day-cell.on .dm {
        color: #fff;
        font-weight: 600;
    }
    .de {
        font-size: 11px;
        height: 14px;
        line-height: 14px;
    }
    .dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: transparent;
    }
    .day-cell.has .dot {
        background: #cfdfd2;
    }
    .day-cell.on .dot {
        background: rgba(255, 255, 255, 0.8);
    }

    .search-inline {
        flex: 0 0 190px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .search-inline :global(.ty-input) {
        padding: 5px 10px;
        font-size: 11.5px;
    }

    .layout {
        display: grid;
        grid-template-columns: 1fr 248px;
        gap: 16px;
        align-items: start;
    }
    .main {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
    }
    .d-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .d-date {
        font-size: 15px;
        font-weight: 700;
    }
    .d-sub {
        font-size: 10.5px;
        color: #b9b2a2;
    }
    .moods {
        display: flex;
        gap: 3px;
    }
    .mood-btn {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        border: 1px solid transparent;
        background: transparent;
        font-size: 16px;
        cursor: pointer;
        opacity: 0.45;
        transition: all 0.14s;
        line-height: 1;
    }
    .mood-btn:hover {
        opacity: 0.85;
        background: #f5f2ea;
    }
    .mood-btn.on {
        opacity: 1;
        background: #fff;
        border-color: #ece8df;
        box-shadow: 0 2px 8px rgba(90, 78, 55, 0.08);
        transform: scale(1.08);
    }

    .prompt {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: #f7f4fa;
        border-radius: 12px;
        padding: 11px 13px;
    }
    .p-ic {
        color: #9b8ec4;
        flex: 0 0 auto;
    }
    .p-text {
        flex: 1;
        font-size: 12px;
        color: #6b5f7a;
        line-height: 1.6;
    }
    .p-acts {
        display: flex;
        gap: 5px;
        flex: 0 0 auto;
    }
    .mini {
        border: 1px solid #e6e0ee;
        background: #fff;
        color: #8b7f9b;
        font-family: inherit;
        font-size: 10.5px;
        padding: 3px 9px;
        border-radius: 8px;
        cursor: pointer;
    }
    .mini:hover {
        background: #f2eef8;
    }

    .paper {
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
        background-image: repeating-linear-gradient(transparent, transparent 27px, #f2eee5 28px);
        background-position: 0 18px;
        background-size: 100% 28px;
        padding: 8px 20px;
    }
    .paper-ta {
        width: 100%;
        box-sizing: border-box;
        border: 0;
        background: transparent;
        color: #2f3a32;
        font-family: inherit;
        font-size: 13.5px;
        line-height: 28px;
        min-height: 300px;
        resize: vertical;
        outline: none;
    }
    .paper-ta::placeholder {
        color: #c4bfb4;
    }

    .tag-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .tag {
        font-size: 10px;
        padding: 2px 9px;
        border-radius: 10px;
        background: #e9f2ea;
        color: #4d7c5d;
    }

    .side {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .side-card {
        background: #fff;
        border-radius: 14px;
        padding: 12px 13px;
        box-shadow: 0 2px 12px rgba(90, 78, 55, 0.05);
    }
    .side-h {
        font-size: 11.5px;
        font-weight: 700;
        color: #2f3a32;
        margin-bottom: 8px;
    }
    .side-empty {
        font-size: 11px;
        color: #b9b2a2;
        padding: 4px 0;
    }
    .side-item {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        color: #6b7568;
        font-family: inherit;
        font-size: 11.5px;
        padding: 6px 7px;
        border-radius: 8px;
        cursor: pointer;
        line-height: 1.5;
    }
    .side-item:hover {
        background: #f8f6f0;
        color: #4d7c5d;
    }
    .side-item.done {
        text-decoration: line-through;
        opacity: 0.6;
    }
    .side-item.habit.on {
        background: #e9f2ea;
        color: #4d7c5d;
    }
    .hname {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ck {
        color: #4d7c5d;
    }

    .comment-box {
        background: #faf7fb;
        border-radius: 12px;
        padding: 11px 13px;
    }
    .cx-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11.5px;
        color: #8b7f9b;
        font-weight: 600;
    }
    .cx-hint {
        font-weight: 400;
        opacity: 0.75;
    }
    .cx-text {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.75;
        color: #6b5f7a;
        white-space: pre-wrap;
    }

    .recent {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .rchip {
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 14px;
        cursor: pointer;
    }
    .rchip.on {
        background: #4d7c5d;
        border-color: #4d7c5d;
        color: #fff;
    }
</style>
