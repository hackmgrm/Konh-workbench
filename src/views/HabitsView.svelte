<script lang="ts">
    import { habits, save, uid } from "../lib/store";
    import { HABIT_COLORS, type Habit } from "../lib/types";
    import { dayKey } from "../lib/time";

    let showAdd = false;
    let draftName = "";
    let draftEmoji = "🌱";

    const EMOJIS = ["🌱", "💧", "🏃", "📖", "🧘", "☀️", "🥗", "💤", "✍️", "🎵"];

    $: today = dayKey();

    function last7(): string[] {
        const out: string[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            out.push(dayKey(d));
        }
        return out;
    }

    $: week = last7();

    function done(h: Habit, k: string): boolean {
        return (h.records[k] || 0) > 0;
    }

    function toggle(h: Habit, k: string) {
        habits.update((l) =>
            l.map((x) => {
                if (x.id !== h.id) return x;
                const rec = { ...x.records };
                if (rec[k]) delete rec[k];
                else rec[k] = 1;
                return { ...x, records: rec };
            })
        );
        save("habits");
    }

    function streak(h: Habit): number {
        let n = 0;
        const now = new Date();
        for (let i = 0; i < 400; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const k = dayKey(d);
            if (done(h, k)) {
                n++;
            } else if (i === 0) {
                continue;
            } else {
                break;
            }
        }
        return n;
    }

    function total(h: Habit): number {
        return Object.keys(h.records).filter((k) => (h.records[k] || 0) > 0).length;
    }

    function add() {
        const n = draftName.trim();
        if (!n) return;
        const h: Habit = {
            id: uid(),
            name: n,
            emoji: draftEmoji,
            color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)],
            target: 1,
            records: {},
            created: Date.now()
        };
        habits.update((l) => [...l, h]);
        save("habits");
        draftName = "";
        draftEmoji = "🌱";
        showAdd = false;
    }

    function remove(id: string) {
        habits.update((l) => l.filter((x) => x.id !== id));
        save("habits");
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">习惯打卡</div>
        <div class="page-sub">每天一点点，时间会替你记账。</div>
    </div>
    <button class="ty-btn primary" on:click={() => (showAdd = !showAdd)}>
        {showAdd ? "取消" : "+ 新习惯"}
    </button>
</div>

{#if showAdd}
    <div class="ty-card">
        <div class="emoji-row">
            {#each EMOJIS as e}
                <button class="emoji" class:on={draftEmoji === e} on:click={() => (draftEmoji = e)}>{e}</button>
            {/each}
        </div>
        <div class="ty-row" style="margin-top:10px">
            <input
                class="ty-input"
                placeholder="习惯名称，比如「读书 30 分钟」"
                bind:value={draftName}
                on:keydown={(e) => e.key === "Enter" && add()}
            />
            <button class="ty-btn primary" on:click={add}>创建</button>
        </div>
    </div>
{/if}

{#if $habits.length === 0}
    <div class="ty-card">
        <div class="ty-empty">还没有习惯，先加一个最容易坚持的 ✨</div>
    </div>
{:else}
    <div class="list">
        {#each $habits as h (h.id)}
            <div class="habit">
                <div class="h-left">
                    <div class="h-emoji" style="background:{h.color}22">{h.emoji}</div>
                    <div class="h-info">
                        <div class="h-name">{h.name}</div>
                        <div class="h-meta">
                            连续 <b>{streak(h)}</b> 天 · 累计 <b>{total(h)}</b> 天
                        </div>
                    </div>
                </div>

                <div class="h-week">
                    {#each week as k (k)}
                        <button
                            class="h-cell"
                            class:on={done(h, k)}
                            class:today={k === today}
                            style={done(h, k) ? `background:${h.color};border-color:${h.color}` : ""}
                            on:click={() => toggle(h, k)}
                            title={k}
                        ></button>
                    {/each}
                </div>

                <button class="h-check" class:on={done(h, today)} on:click={() => toggle(h, today)}>
                    {done(h, today) ? "已打卡" : "打卡"}
                </button>

                <button class="h-del" on:click={() => remove(h.id)} aria-label="删除">✕</button>
            </div>
        {/each}
    </div>
{/if}

<style>
    .emoji-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }
    .emoji {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid #ece8df;
        background: #fff;
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
    }
    .emoji.on {
        border-color: #4d7c5d;
        background: #e6efe7;
    }
    .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .habit {
        display: flex;
        align-items: center;
        gap: 14px;
        background: #fff;
        border-radius: 16px;
        padding: 14px 16px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
    }
    .h-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }
    .h-emoji {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex: 0 0 auto;
    }
    .h-info {
        min-width: 0;
    }
    .h-name {
        font-size: 13px;
        font-weight: 600;
        color: #2f3a32;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .h-meta {
        font-size: 10.5px;
        color: #9aa398;
        margin-top: 3px;
    }
    .h-meta b {
        color: #4d7c5d;
        font-weight: 700;
    }
    .h-week {
        display: flex;
        gap: 5px;
        flex: 0 0 auto;
    }
    .h-cell {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border: 1px solid #ece8df;
        background: #fff;
        cursor: pointer;
        padding: 0;
        transition: transform 0.12s;
    }
    .h-cell:hover {
        transform: scale(1.12);
    }
    .h-cell.today {
        outline: 1.5px solid #cfdfd2;
        outline-offset: 1px;
    }
    .h-check {
        flex: 0 0 auto;
        padding: 7px 16px;
        border-radius: 20px;
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 11.5px;
        cursor: pointer;
        transition: all 0.15s;
    }
    .h-check:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .h-check.on {
        background: #4d7c5d;
        border-color: #4d7c5d;
        color: #fff;
    }
    .h-del {
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        color: #b9b2a2;
        cursor: pointer;
        font-size: 11px;
        opacity: 0;
    }
    .habit:hover .h-del {
        opacity: 0.7;
    }
</style>
