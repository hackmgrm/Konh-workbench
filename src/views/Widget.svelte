<script lang="ts">
    import { tasks, stickies, focusRecords, save, uid } from "../lib/store";
    import { pomodoro, timerState, attachCurrentTask } from "../lib/timer";
    import { toggleTask } from "../lib/taskCompletion";
    import { dayKey, fmtClock } from "../lib/time";
    import { quadOf, STICKY_COLORS, type Task, type Sticky } from "../lib/types";

    export let onClose: () => void;
    export let onDrag: (event: MouseEvent) => void;

    let view: "card" | "list" | "timer" | "notes" | "add" = "card";
    let title = "";
    let note = "";
    let due = "";
    let priority = "q2";
    let selectedNote = "";
    let locked = false;
    $: today = dayKey();
    $: open = $tasks.filter(t => !t.done && (!t.start || t.start <= today));
    $: ordered = [...open].sort ( (a, b) => Number(b.urgent && b.important) - Number(a.urgent && a.important));
    $: current = ordered[0];
    $: completed = $tasks.filter(t => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today).length;
    $: progress = open.length + completed ? Math.round(completed * 100 / (open.length + completed)) : 0;
    $: urgent = open.filter(t => t.urgent).length;
    $: dueCount = open.filter(t => t.due && t.due <= today).length;
    $: selected = $stickies.find(n => n.id === selectedNote);
    $: focused = $tasks.find(t => t.id === $timerState.taskId);
    $: todayFocus = $focusRecords.filter(f => f.day === today);

    function complete(t: Task) {
        tasks.update(list => toggleTask(list, t.id, Date.now(), true));
        save("tasks");
    }
    function snooze(t: Task) {
        const base = t.due && t.due > today ? new Date(`${t.due}T12:00:00`) : new Date();
        base.setDate(base.getDate() + 1);
        const next = dayKey(base);
        tasks.update(list => list.map(x => x.id === t.id ? { ...x, start: next, due: next } : x));
        save("tasks");
    }
    function focus(t: Task) {
        if ($timerState.running && $timerState.mode === "focus" && $timerState.taskId === t.id) {
            view = "timer";
            return;
        }
        if ($timerState.running || $timerState.mode !== "focus" || ($timerState.taskId && $timerState.taskId !== t.id)) {
            if (!window.confirm("开始新专注会重置当前计时，继续吗？")) return;
            pomodoro.reset("focus");
        }
        attachCurrentTask(t.id);
        pomodoro.start();
        view = "timer";
    }
    function addTask() {
        if (!title.trim()) return;
        const task: Task = { id: uid(), title: title.trim(), note: note.trim(), due, start: "", done: false,
            important: priority === "q1" || priority === "q2", urgent: priority === "q1" || priority === "q3",
            created: Date.now(), doneAt: 0, repeat: "none", url: "", project: "", category: "none", subtasks: [], reminder: 0, tags: [], isFavorite: false, isPinned: false, isEvening: false, description: "" };
        tasks.update(list => [task, ...list]);
        save("tasks");
        title = ""; note = ""; due = ""; view = "card";
    }
    function addNote() {
        const n: Sticky = { id: uid(), title: "", text: "", created: Date.now(), color: STICKY_COLORS[0], pinType: "pin", rotate: 0 };
        stickies.update(list => [n, ...list]);
        save("stickies");
        selectedNote = n.id;
    }
    function patchNote(id: string, patch: Partial<Sticky>) {
        stickies.update(list => list.map(n => n.id === id ? { ...n, ...patch } : n));
        save("stickies");
    }
    function deleteNote(id: string) {
        stickies.update(list => list.filter(n => n.id !== id));
        save("stickies"); selectedNote = "";
    }
</script>

<section class="widget" aria-label="思源内悬浮挂件">
    <header on:mousedown={(e) => { if (!locked && !(e.target as HTMLElement).closest("button")) onDrag(e); }} role="toolbar" tabindex="0" aria-label="挂件标题栏">
        <div class="heading"><span class="book">▣</span><strong>今日待办</strong><span class="badge">{urgent} 紧急</span>{#if dueCount}<span class="badge due">{dueCount} 到期</span>{/if}</div>
        <div class="header-actions"><button title={locked ? "解锁拖动" : "锁定拖动"} aria-label={locked ? "解锁拖动" : "锁定拖动"} on:click={() => locked = !locked}>{locked ? "🔒" : "♧"}</button><button title="关闭挂件" aria-label="关闭挂件" on:click={onClose}>×</button></div>
    </header>
    <main>
        {#if view === "card"}
            {#if current}
                <article class="task-card">
                    <div class="card-top"><span class="badge"><span class="dot"></span>{quadOf(current).label}</span>{#if current.due}<span class="badge due">{current.due <= today ? "已到期" : current.due}</span>{/if}</div>
                    <div class="task-content"><h2>{current.title}</h2>{#if current.note}<p>{current.note}</p>{/if}</div>
                    <div class="progress-track"><div style:width="{progress}%"></div></div>
                    <div class="progress-label"><span>今日进度</span><b>{progress}%</b></div>
                    <div class="card-actions"><button on:click={() => snooze(current)}>← 推迟一天</button><button on:click={() => focus(current)}>◷ 专注</button><button on:click={() => complete(current)}>完成 →</button></div>
                </article>
            {:else}<div class="empty"><span>☕</span><b>今天的任务都完成了</b><button on:click={() => view = "add"}>＋ 新建任务</button></div>{/if}
        {:else if view === "list"}
            <div class="list">{#each ordered as task (task.id)}<div class="list-row"><button class="check" title="完成任务" aria-label="完成 {task.title}" on:click={() => complete(task)}>✓</button><div class="row-text"><b>{task.title}</b><small>{quadOf(task).label}{task.due ? ` · ${task.due}` : ""}</small></div><button title="推迟一天" aria-label="推迟 {task.title}" on:click={() => snooze(task)}>↷</button><button title="开始专注" aria-label="专注 {task.title}" on:click={() => focus(task)}>▶</button></div>{:else}<div class="empty">暂无待办，休息一下吧</div>{/each}</div>
        {:else if view === "timer"}
            <div class="timer"><span class="badge">{$timerState.mode === "focus" ? "专注模式" : "休息模式"}</span><p>{focused?.title || "自由专注"}</p><div class="clock">{fmtClock($timerState.left)}<small>第 {$timerState.round + 1} 轮</small></div><div class="timer-actions"><button on:click={() => pomodoro.toggle()}>{$timerState.running ? "暂停" : "开始"}</button><button on:click={() => { pomodoro.reset(); attachCurrentTask(""); }}>重置</button></div><small>今日 {todayFocus.length} 个番茄 · {todayFocus.reduce((sum, f) => sum + f.minutes, 0)} 分钟</small></div>
        {:else if view === "notes"}
            {#if selected}
                <div class="note-editor" style:background={selected.color}><div class="note-bar"><button on:click={() => selectedNote = ""}>← 便签列表</button><button on:click={() => deleteNote(selected.id)}>删除</button></div><textarea aria-label="便签内容" placeholder="写下你的想法…" value={selected.text} on:input={(e) => patchNote(selected!.id, { text: e.currentTarget.value })}></textarea><div class="colors">{#each STICKY_COLORS as color}<button style:background={color} class:chosen={selected.color === color} aria-label="便签颜色 {color}" on:click={() => patchNote(selected!.id, { color })}></button>{/each}</div></div>
            {:else}<div class="notes"><div class="note-bar"><b>便签 · {$stickies.length}</b><button on:click={addNote}>＋ 新建</button></div>{#each $stickies as sticky (sticky.id)}<button class="note-item" style:background={sticky.color} on:click={() => selectedNote = sticky.id}>{sticky.title || sticky.text || "空白便签"}</button>{:else}<div class="empty">还没有便签</div>{/each}</div>{/if}
        {:else}
            <form on:submit|preventDefault={addTask}><label>任务名称<input bind:value={title} placeholder="要做什么？" required /></label><label>描述<input bind:value={note} placeholder="添加描述（可选）" /></label><label>截止日期<input type="date" bind:value={due} /></label><label>优先级<select bind:value={priority}><option value="q1">重要且紧急</option><option value="q2">重要不紧急</option><option value="q3">紧急不重要</option><option value="q4">不重要不紧急</option></select></label><div class="form-actions"><button type="button" on:click={() => view = "card"}>取消</button><button type="submit">添加任务</button></div></form>
        {/if}
    </main>
    <footer><span>待办任务<br /><b>{open.length}</b></span><nav aria-label="挂件视图"><button class:active={view === "card"} title="卡片" aria-label="卡片" on:click={() => view = "card"}>▱</button><button class:active={view === "list"} title="列表" aria-label="列表" on:click={() => view = "list"}>☷</button><button class:active={view === "timer"} title="番茄钟" aria-label="番茄钟" on:click={() => view = "timer"}>◷</button><button class:active={view === "notes"} title="便签" aria-label="便签" on:click={() => { view = "notes"; selectedNote = ""; }}>▧</button><button class:active={view === "add"} title="新增任务" aria-label="新增任务" on:click={() => view = "add"}>＋</button></nav><span>进度<br /><b>{progress}%</b></span></footer>
</section>

<style>
    .widget{box-sizing:border-box;width:100%;height:min(450px,calc(100vh - 24px));min-height:min(280px,calc(100vh - 24px));padding:18px 19px 14px;background:rgba(250,248,241,.97);border:1px solid #eee9df;border-radius:16px;box-shadow:0 12px 35px #514a3b30;color:#303741;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden} .widget *{box-sizing:border-box} button,input,select,textarea{font:inherit} button{border:0;background:none;color:inherit;cursor:pointer} button:hover{color:#a6553d} button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #a6553d;outline-offset:2px} header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dfe5eb;padding-bottom:12px;cursor:move;gap:4px} .heading,.header-actions,.card-top,.card-actions,.progress-label,.note-bar{display:flex;align-items:center;gap:7px} .heading{min-width:0;white-space:nowrap}.heading strong{color:#53627b}.book{color:#907c52;font-size:19px}.badge{border:1px solid #f1dcd7;background:#fbf2ef;border-radius:20px;color:#a5553e;font-weight:700;padding:4px 9px;font-size:10px;white-space:nowrap}.badge.due{border-radius:6px;background:#fbede6}.header-actions{gap:0}.header-actions button{font-size:18px;color:#93a4bb;padding:2px 5px}main{flex:1;min-height:0;display:flex;align-items:center;overflow:auto;padding:12px 0}.task-card{background:#fff;border-radius:12px;padding:22px 16px 14px;width:100%;box-shadow:0 12px 25px #514a3b0d}.card-top{justify-content:space-between}.dot{display:inline-block;background:#dca1ba;border-radius:50%;width:7px;height:7px;margin-right:6px}.task-content{min-height:90px;padding:20px 0 8px;overflow-wrap:anywhere}.task-content h2{font-size:19px;margin:0}.task-content p{color:#8593a5;margin:6px 0;font-size:12px}.progress-track{height:4px;border-radius:4px;background:#ebeff3;overflow:hidden}.progress-track div{height:100%;background:linear-gradient(90deg,#b5cde3,#c5d8b7,#e29cb9)}.progress-label{justify-content:space-between;color:#91a1b9;font-weight:bold;padding:5px 0}.progress-label b{color:#53627b}.card-actions{border-top:1px solid #f0efed;justify-content:space-between;padding-top:9px}.card-actions button{padding:4px 0;color:#7385a1;font-weight:700;font-size:11px}.card-actions button:last-child{color:#4d7c5d}.empty{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#9aa7b8;text-align:center;padding:25px}.empty span{font-size:30px}.empty button,.timer-actions button,.form-actions button{border:1px solid #dae8df;border-radius:8px;padding:6px 12px;color:#4d7c5d}.list,.notes{width:100%;height:100%;overflow:auto}.list-row{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #f0ece5;border-radius:9px;margin-bottom:6px;padding:8px}.row-text{flex:1;min-width:0}.row-text b,.row-text small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row-text small{color:#98a4b3;font-size:10px}.check{border:1px solid #bdc9d0;border-radius:50%;width:21px;height:21px;color:#4d7c5d;padding:0}.timer{width:100%;display:flex;flex-direction:column;align-items:center;gap:10px}.timer p{margin:0;color:#73839a}.timer small{color:#91a0b2}.clock{border:4px solid #ead6dc;background:#fff;border-radius:50%;width:120px;height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:27px;font-weight:bold}.clock small{font-size:10px}.timer-actions{display:flex;gap:10px}.note-bar{justify-content:space-between;border-bottom:1px dashed #c7cdd2;padding:4px 0 8px;color:#73839a}.note-item{display:block;width:100%;text-align:left;border-radius:8px;padding:10px;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.note-editor{width:100%;height:100%;border-radius:10px;padding:12px;display:flex;flex-direction:column}.note-editor textarea{flex:1;min-height:50px;border:0;background:transparent;resize:none;padding:10px 0;color:#303741}.colors{display:flex;gap:7px}.colors button{width:17px;height:17px;border-radius:50%;border:1px solid #c6c6c6}.colors .chosen{outline:2px solid #829393}form{width:100%;height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px}label{display:flex;flex-direction:column;gap:3px;color:#75849a;font-weight:700;font-size:11px}input,select{width:100%;border:1px solid #ece7df;background:#fff;border-radius:7px;padding:7px;color:#303741}.form-actions{display:flex;justify-content:flex-end;gap:8px}.form-actions button:last-child{background:#4d7c5d;color:white}footer{border-top:1px solid #dfe5eb;padding-top:12px;display:flex;align-items:center;justify-content:space-between;gap:5px;color:#71819b;font-size:10px;font-weight:700}footer span{white-space:nowrap}footer b{font-size:12px}nav{display:flex;gap:2px}nav button{width:29px;height:29px;border:1px solid transparent;border-radius:9px;color:#95a7bd;font-size:17px;padding:0}nav button.active{color:#a6553d;border-color:#f1dcd7;background:#fbf2ef}
</style>
