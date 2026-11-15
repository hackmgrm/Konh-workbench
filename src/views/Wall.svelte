<script lang="ts">
    import { stickies, save, uid } from "../lib/store";
    import { STICKY_COLORS, PIN_LABELS, type Sticky, type PinType } from "../lib/types";
    import { fmtTime } from "../lib/time";

    let query = "";
    let gridMode = false;
    let locked = false;
    let pinType: PinType = "pin";
    let editId = "";

    $: list = $stickies
        .filter((s) => {
            if (!query.trim()) return true;
            const q = query.trim().toLowerCase();
            return s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q);
        })
        .map((s) => s);

    $: editing = editId ? $stickies.find((s) => s.id === editId) || null : null;

    function add() {
        const s: Sticky = {
            id: uid(),
            title: "",
            text: "",
            created: Date.now(),
            color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
            pinType,
            rotate: (Math.random() * 3 - 1.5)
        };
        stickies.update((l) => [s, ...l]);
        save("stickies");
        editId = s.id;
    }

    function patch(id: string, p: Partial<Sticky>) {
        stickies.update((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
        save("stickies");
    }

    function remove(id: string) {
        stickies.update((l) => l.filter((x) => x.id !== id));
        save("stickies");
        if (editId === id) editId = "";
    }

    function rotateOf(s: Sticky): number {
        if (gridMode) return 0;
        return s.rotate || 0;
    }

    function pinChar(s: Sticky): string {
        const p = PIN_LABELS.find((x) => x.key === s.pinType);
        return p ? p.char : "📌";
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">
            随手便签
            <span class="count">{$stickies.length}</span>
        </div>
        <div class="page-sub">想到什么先贴上来，回头再整理。</div>
    </div>
    <div class="ty-row" style="gap:6px">
        <button class="ty-btn sm" class:on={gridMode} on:click={() => (gridMode = !gridMode)} title="网格模式（取消倾斜）">
            ▦ 网格
        </button>
        <button class="ty-btn sm" class:on={locked} on:click={() => (locked = !locked)} title="锁定悬停效果">
            {locked ? "🔒" : "🔓"} 锁定
        </button>
        <button class="ty-btn primary" on:click={add}>＋ 新便签</button>
    </div>
</div>

<div class="toolbar">
    <input class="ty-input" placeholder="搜索便签…" bind:value={query} />
    <div class="pins">
        {#each PIN_LABELS as p (p.key)}
            <button class="pin-chip" class:on={pinType === p.key} on:click={() => (pinType = p.key)} title={p.label}>
                {p.char}
            </button>
        {/each}
    </div>
</div>

{#if $stickies.length === 0}
    <div class="empty-board" role="button" tabindex="0" on:click={add} on:keydown={(e) => e.key === "Enter" && add()}>
        <div class="empty-note">
            <div class="plus">＋</div>
            <div>还没有便签，点这里贴一张</div>
        </div>
    </div>
{:else if list.length === 0}
    <div class="ty-card">
        <div class="ty-empty">没有找到「{query}」</div>
    </div>
{:else}
    <div class="board" class:grid={gridMode}>
        {#each list as s, i (s.id)}
            <div
                class="note"
                class:locked
                style="background:{s.color};transform:rotate({rotateOf(s)}deg)"
                role="button"
                tabindex="0"
                on:click={() => (editId = s.id)}
                on:keydown={(e) => e.key === "Enter" && (editId = s.id)}
            >
                <div class="pin">{pinChar(s)}</div>

                {#if s.title}
                    <div class="n-title">{s.title}</div>
                {/if}
                <div class="n-text" class:notitle={!s.title}>{s.text || "（空白便签）"}</div>

                <div class="n-foot">
                    <span class="n-time">{fmtTime(s.created)}</span>
                    <button class="n-del" on:click|stopPropagation={() => remove(s.id)} aria-label="删除">✕</button>
                </div>
                <div class="fold"></div>
            </div>
        {/each}
    </div>
{/if}

{#if editing}
    <div class="mask" role="presentation" on:click={(e) => e.target === e.currentTarget && (editId = "")}>
        <div class="modal-note" style="background:{editing.color}">
            <div class="m-pin">{pinChar(editing)}</div>

            <div class="m-bar">
                <div class="colors">
                    {#each STICKY_COLORS as c}
                        <button
                            class="cdot"
                            class:on={editing.color === c}
                            style="background:{c}"
                            on:click={() => patch(editing.id, { color: c })}
                            aria-label="颜色"
                        ></button>
                    {/each}
                </div>
                <div class="sp"></div>
                <button class="ty-btn sm" on:click={() => remove(editing.id)}>删除</button>
                <button class="ty-btn sm primary" on:click={() => (editId = "")}>完成</button>
            </div>

            <input
                class="m-title"
                placeholder="标题（可留空）"
                value={editing.title}
                on:input={(e) => patch(editing.id, { title: (e.target as HTMLInputElement).value })}
            />

            <textarea
                class="m-text"
                placeholder="写点什么…"
                value={editing.text}
                on:input={(e) => patch(editing.id, { text: (e.target as HTMLTextAreaElement).value })}
            ></textarea>

            <div class="m-foot">
                <span>{editing.created ? new Date(editing.created).toLocaleString() : ""}</span>
            </div>
        </div>
    </div>
{/if}

<style>
    .count {
        font-size: 11px;
        font-weight: 600;
        color: #4d7c5d;
        background: #e9f2ea;
        padding: 2px 9px;
        border-radius: 12px;
        margin-left: 6px;
        vertical-align: middle;
    }
    .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .pins {
        display: flex;
        gap: 4px;
    }
    .pin-chip {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        border: 1px solid #ece8df;
        background: #fff;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        opacity: 0.55;
        transition: all 0.14s;
    }
    .pin-chip:hover {
        opacity: 1;
    }
    .pin-chip.on {
        opacity: 1;
        border-color: #cfdfd2;
        background: #e9f2ea;
    }

    .board {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px 16px;
        padding: 6px 2px 10px;
    }
    .board.grid {
        gap: 14px;
    }
    .note {
        position: relative;
        border-radius: 3px;
        padding: 20px 15px 12px;
        min-height: 150px;
        cursor: pointer;
        box-shadow: 0 3px 12px rgba(90, 78, 55, 0.12);
        transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s, margin 0.2s;
        display: flex;
        flex-direction: column;
        color: #4a4436;
        overflow: hidden;
    }
    .note:hover {
        transform: rotate(0deg) translateY(-4px) scale(1.015) !important;
        box-shadow: 0 14px 30px rgba(90, 78, 55, 0.2);
        z-index: 2;
    }
    .note.locked:hover {
        transform: rotate(var(--r, 0deg));
        box-shadow: 0 3px 12px rgba(90, 78, 55, 0.12);
    }
    .pin {
        position: absolute;
        top: 3px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 15px;
        opacity: 0.85;
        pointer-events: none;
    }
    .n-title {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .n-text {
        flex: 1;
        font-size: 12px;
        line-height: 1.65;
        white-space: pre-wrap;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 5;
        -webkit-box-orient: vertical;
        overflow: hidden;
        opacity: 0.85;
    }
    .n-text.notitle {
        -webkit-line-clamp: 6;
    }
    .n-foot {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed rgba(0, 0, 0, 0.12);
        opacity: 0;
        transition: opacity 0.15s;
    }
    .note:hover .n-foot {
        opacity: 1;
    }
    .n-time {
        flex: 1;
        font-size: 9.5px;
        opacity: 0.5;
    }
    .n-del {
        border: 0;
        background: transparent;
        color: #6b6152;
        cursor: pointer;
        font-size: 11px;
        opacity: 0.5;
    }
    .n-del:hover {
        opacity: 1;
        color: #b0543f;
    }
    .fold {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 0 0 18px 18px;
        border-color: transparent transparent rgba(0, 0, 0, 0.08) transparent;
    }

    .empty-board {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 280px;
        cursor: pointer;
    }
    .empty-note {
        width: 220px;
        min-height: 150px;
        border: 2px dashed #ddd6c6;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #b9b2a2;
        font-size: 12px;
        transform: rotate(-1.5deg);
        transition: transform 0.2s, border-color 0.2s;
    }
    .empty-board:hover .empty-note {
        transform: rotate(0);
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .plus {
        font-size: 26px;
        line-height: 1;
    }

    .mask {
        position: fixed;
        inset: 0;
        z-index: 10004;
        background: rgba(50, 42, 30, 0.42);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }
    .modal-note {
        position: relative;
        width: min(520px, 92vw);
        max-height: 78vh;
        border-radius: 4px;
        padding: 22px 22px 16px;
        box-shadow: 0 24px 60px rgba(40, 32, 20, 0.4);
        display: flex;
        flex-direction: column;
        color: #4a4436;
    }
    .m-pin {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 17px;
    }
    .m-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
    }
    .colors {
        display: flex;
        gap: 5px;
    }
    .cdot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        padding: 0;
    }
    .cdot.on {
        border-color: rgba(0, 0, 0, 0.28);
        box-shadow: 0 0 0 2px #fff inset;
    }
    .sp {
        flex: 1;
    }
    .m-title {
        border: 0;
        border-bottom: 1px dashed rgba(0, 0, 0, 0.15);
        background: transparent;
        font-family: inherit;
        font-size: 16px;
        font-weight: 700;
        color: #3d3728;
        padding: 6px 0;
        outline: none;
        margin-bottom: 8px;
    }
    .m-text {
        flex: 1;
        min-height: 220px;
        border: 0;
        background: transparent;
        font-family: inherit;
        font-size: 13px;
        line-height: 24px;
        color: #4a4436;
        outline: none;
        resize: none;
        background-image: repeating-linear-gradient(transparent, transparent 23px, rgba(0, 0, 0, 0.07) 24px);
    }
    .m-foot {
        margin-top: 10px;
        font-size: 10px;
        opacity: 0.45;
        text-align: right;
    }
</style>
