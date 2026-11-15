<script lang="ts">
    import { focusRecords } from "../lib/store";
    import { dayKey } from "../lib/time";

    const WEEKS = 26;
    const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

    $: all = $focusRecords;

    $: totalPomos = all.length;
    $: totalMin = all.reduce((a, b) => a + b.minutes, 0);
    $: todayKey = dayKey();
    $: todayPomos = all.filter((f) => f.day === todayKey).length;
    $: avgMin = totalPomos > 0 ? Math.round(totalMin / totalPomos) : 0;

    $: hoursText = (() => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h} 小时 ${m} 分钟`;
    })();

    /* ---------- 热力图 ---------- */
    $: heat = (() => {
        const counts: Record<string, number> = {};
        all.forEach((f) => {
            counts[f.day] = (counts[f.day] || 0) + 1;
        });

        const today = new Date();
        // 从今天往前推 WEEKS*7 天，并对齐到周日
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (WEEKS * 7 - 1));
        start.setDate(start.getDate() - start.getDay());

        const cols: { key: string; count: number; level: number; isToday: boolean }[][] = [];
        const monthLabels: { col: number; label: string }[] = [];
        let lastMonth = -1;

        const cursor = new Date(start);
        for (let w = 0; w < WEEKS; w++) {
            const col: { key: string; count: number; level: number; isToday: boolean }[] = [];
            for (let d = 0; d < 7; d++) {
                const k = dayKey(cursor);
                const c = counts[k] || 0;
                let level = 0;
                if (c >= 1) level = 1;
                if (c >= 3) level = 2;
                if (c >= 5) level = 3;
                if (c >= 8) level = 4;
                col.push({ key: k, count: c, level, isToday: k === todayKey });

                if (d === 0) {
                    const m = cursor.getMonth();
                    if (m !== lastMonth) {
                        monthLabels.push({ col: w, label: `${m + 1}月` });
                        lastMonth = m;
                    }
                }
                cursor.setDate(cursor.getDate() + 1);
            }
            cols.push(col);
        }
        return { cols, monthLabels };
    })();

    /* ---------- 时段分布 ---------- */
    $: slots = (() => {
        const defs = [
            { label: "清晨", range: "(6-9)", from: 6, to: 9 },
            { label: "上午", range: "(9-12)", from: 9, to: 12 },
            { label: "下午", range: "(12-18)", from: 12, to: 18 },
            { label: "晚上", range: "(18-24)", from: 18, to: 24 }
        ];
        return defs.map((d) => {
            const n = all.filter((f) => {
                const h = new Date(f.at).getHours();
                return h >= d.from && h < d.to;
            }).length;
            return { ...d, count: n };
        });
    })();

    $: slotMax = Math.max(1, ...slots.map((s) => s.count));

    /* ---------- 本周速览 ---------- */
    $: thisWeek = (() => {
        let pomos = 0;
        let minutes = 0;
        let days = 0;
        const now = new Date();
        const seen = new Set<string>();
        for (let i = 0; i < 7; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const k = dayKey(d);
            const list = all.filter((f) => f.day === k);
            if (list.length) days++;
            pomos += list.length;
            minutes += list.reduce((a, b) => a + b.minutes, 0);
            seen.add(k);
        }
        return { pomos, minutes, days };
    })();

    function cellTitle(c: { key: string; count: number }): string {
        return `${c.key} · ${c.count} 个番茄`;
    }
</script>

<div class="page-head">
    <div>
        <div class="page-title">专注度统计看板</div>
        <div class="page-sub">规划今日待办，有条不紊地记录生活的每个瞬间。</div>
    </div>
</div>

<div class="stat-row">
    <div class="stat-card pink">
        <div class="ic">◷</div>
        <div>
            <div class="label">总专注时长</div>
            <div class="value">{hoursText}</div>
        </div>
    </div>
    <div class="stat-card green">
        <div class="ic">◎</div>
        <div>
            <div class="label">总番茄数</div>
            <div class="value">{totalPomos} 个番茄</div>
        </div>
    </div>
    <div class="stat-card purple">
        <div class="ic">♡</div>
        <div>
            <div class="label">今日专注完成</div>
            <div class="value">{todayPomos} 个</div>
        </div>
    </div>
    <div class="stat-card yellow">
        <div class="ic">☕</div>
        <div>
            <div class="label">单次平均时间</div>
            <div class="value">{avgMin} 分钟</div>
        </div>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">
        <span>📊 番茄专注热力图（最近 {WEEKS} 周）</span>
        <span class="legend">
            少
            <i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i>
            多
        </span>
    </div>

    <div class="heat-wrap">
        <div class="heat-days">
            {#each WEEKDAY_LABELS as w, i}
                <span>{i % 2 === 1 ? w : ""}</span>
            {/each}
        </div>

        <div class="heat-body">
            <div class="heat-months">
                {#each Array(WEEKS) as _, i}
                    {@const lab = heat.monthLabels.find((m) => m.col === i)}
                    <span>{lab ? lab.label : ""}</span>
                {/each}
            </div>

            <div class="heat-grid">
                {#each heat.cols as col, ci}
                    <div class="heat-col">
                        {#each col as c}
                            <div
                                class="cell lv{c.level}"
                                class:today={c.isToday}
                                title={cellTitle(c)}
                            ></div>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">🕐 专注时段分布</div>
    <div class="slots">
        {#each slots as s (s.label)}
            <div class="slot">
                <span class="slot-label">{s.label}<em>{s.range}</em></span>
                <div class="slot-track">
                    <div class="slot-fill" style="width:{Math.round((s.count / slotMax) * 100)}%"></div>
                </div>
                <span class="slot-num">{s.count}</span>
            </div>
        {/each}
    </div>
</div>

<div class="ty-card">
    <div class="ty-h2">本周速览</div>
    <div class="week-row">
        <div class="wk">
            <b>{thisWeek.pomos}</b>
            <span>本周番茄</span>
        </div>
        <div class="wk">
            <b>{thisWeek.minutes}</b>
            <span>专注分钟</span>
        </div>
        <div class="wk">
            <b>{thisWeek.days}</b>
            <span>活跃天数</span>
        </div>
    </div>
</div>

<style>
    .stat-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
    }
    .stat-card {
        display: flex;
        align-items: center;
        gap: 13px;
        padding: 16px 18px;
        border-radius: 18px;
    }
    .stat-card.pink {
        background: #fdf2f1;
    }
    .stat-card.green {
        background: #e6efe7;
    }
    .stat-card.purple {
        background: #f2f0fa;
    }
    .stat-card.yellow {
        background: #fbf7ec;
    }
    .stat-card .ic {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #6b7568;
        flex: 0 0 auto;
    }
    .stat-card .label {
        font-size: 10.5px;
        color: #9aa398;
    }
    .stat-card .value {
        font-size: 16px;
        font-weight: 700;
        margin-top: 2px;
        color: #2f3a32;
    }

    .legend {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        color: #9aa398;
        font-weight: 400;
    }
    .legend i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
    }

    .heat-wrap {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
    }
    .heat-days {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-top: 18px;
        flex: 0 0 auto;
    }
    .heat-days span {
        height: 12px;
        line-height: 12px;
        font-size: 9px;
        color: #9aa398;
        width: 12px;
        text-align: center;
    }
    .heat-body {
        flex: 0 0 auto;
    }
    .heat-months {
        display: flex;
        gap: 3px;
        height: 15px;
        margin-bottom: 3px;
    }
    .heat-months span {
        width: 12px;
        font-size: 9px;
        color: #9aa398;
        white-space: nowrap;
        overflow: visible;
    }
    .heat-grid {
        display: flex;
        gap: 3px;
    }
    .heat-col {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .cell {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        transition: transform 0.12s;
    }
    .cell:hover {
        transform: scale(1.25);
        outline: 1px solid #4d7c5d;
    }
    .cell.today {
        outline: 1.5px solid #d8a0a0;
        outline-offset: 1px;
    }
    .lv0 {
        background: #f0ece3;
    }
    .lv1 {
        background: #d3e5d6;
    }
    .lv2 {
        background: #a9cdaf;
    }
    .lv3 {
        background: #6fa47c;
    }
    .lv4 {
        background: #4d7c5d;
    }

    .slots {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .slot {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .slot-label {
        flex: 0 0 96px;
        font-size: 12px;
        color: #2f3a32;
    }
    .slot-label em {
        font-style: normal;
        color: #9aa398;
        font-size: 10.5px;
        margin-left: 4px;
    }
    .slot-track {
        flex: 1;
        height: 8px;
        border-radius: 4px;
        background: #f0ece3;
        overflow: hidden;
    }
    .slot-fill {
        height: 100%;
        border-radius: 4px;
        background: linear-gradient(90deg, #a9cdaf, #4d7c5d);
        transition: width 0.4s ease;
    }
    .slot-num {
        flex: 0 0 26px;
        text-align: right;
        font-size: 12px;
        color: #6b7568;
        font-variant-numeric: tabular-nums;
    }

    .week-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
    }
    .wk {
        background: #f8f6f0;
        border-radius: 14px;
        padding: 14px;
        text-align: center;
    }
    .wk b {
        display: block;
        font-size: 22px;
        font-weight: 700;
        color: #2f3a32;
    }
    .wk span {
        font-size: 10.5px;
        color: #9aa398;
    }
</style>
