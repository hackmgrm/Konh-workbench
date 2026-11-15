<script lang="ts">
    import { onMount } from "svelte";
    import { settings, favorites, tasks, save, uid } from "../lib/store";
    import type { FavItem } from "../lib/types";

    type NewsTab = "hot" | "github" | "rss" | "explore" | "fav";
    let tab: NewsTab = "hot";
    let query = "";

    interface HotItem {
        title: string;
        link: string;
        hot: string;
    }

    interface HotSource {
        key: string;
        name: string;
        tint: string;
    }

    const HOT_SOURCES: HotSource[] = [
        { key: "weibo", name: "微博", tint: "pink" },
        { key: "zhihu", name: "知乎", tint: "blue" },
        { key: "bilibili", name: "B站", tint: "cyan" },
        { key: "douyin", name: "抖音", tint: "dark" },
        { key: "toutiao", name: "头条", tint: "pink" },
        { key: "baidu", name: "百度", tint: "blue" },
        { key: "hupu", name: "虎扑", tint: "orange" },
        { key: "v2ex", name: "V2EX", tint: "gray" },
        { key: "juejin", name: "掘金", tint: "cyan" },
        { key: "csdn", name: "CSDN", tint: "pink" },
        { key: "xiaohongshu", name: "小红书", tint: "pink" }
    ];

    interface Repo {
        id: string;
        name: string;
        desc: string;
        stars: number;
        url: string;
        lang: string;
    }

    interface Article {
        id: string;
        title: string;
        link: string;
        desc: string;
        date: string;
        source: string;
    }

    interface SourceState {
        items: HotItem[];
        loading: boolean;
        error: string;
    }

    let hotState: Record<string, SourceState> = {};
    let hotLoading = false;

    /* ---------- 今日热议：uapis 聚合热榜 ---------- */
    async function fetchHotSource(s: HotSource): Promise<HotItem[]> {
        const raw = await proxyGet(`https://uapis.cn/api/v1/misc/hotboard?type=${s.key}`);
        const j = JSON.parse(raw) as {
            list?: { title?: string; url?: string; index?: number }[];
        };
        if (!j.list) throw new Error("接口返回异常");
        return j.list
            .filter((x) => x.title)
            .slice(0, 8)
            .map((x) => ({
                title: x.title || "",
                link: x.url || "",
                hot: ""
            }));
    }

    async function loadHot() {
        if (hotLoading) return;
        hotLoading = true;
        const next: Record<string, SourceState> = {};
        HOT_SOURCES.forEach((s) => {
            next[s.key] = { items: [], loading: true, error: "" };
        });
        hotState = { ...next };

        await Promise.all(
            HOT_SOURCES.map(async (s) => {
                try {
                    const items = await fetchHotSource(s);
                    hotState = { ...hotState, [s.key]: { items, loading: false, error: "" } };
                } catch (e) {
                    hotState = {
                        ...hotState,
                        [s.key]: {
                            items: [],
                            loading: false,
                            error: e instanceof Error ? e.message : String(e)
                        }
                    };
                }
            })
        );
        hotLoading = false;
    }

    function hotList(key: string): HotItem[] {
        const st = hotState[key];
        if (!st) return [];
        if (!q) return st.items;
        return st.items.filter((x) => x.title.toLowerCase().includes(q));
    }

    let repos: Repo[] = [];
    let ghLoading = false;
    let ghError = "";

    let articles: Article[] = [];
    let rssLoading = false;
    let rssError = "";

    let input: HTMLInputElement;

    async function proxyGet(url: string): Promise<string> {
        const res = await fetch("/api/network/forwardProxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url,
                method: "GET",
                timeout: 16000,
                headers: [{ key: "User-Agent", value: "Mozilla/5.0 TongYunWorkbench" }]
            })
        });
        const j = (await res.json()) as { code: number; msg: string; data?: { body?: string } };
        if (j.code !== 0) throw new Error(j.msg || "网络请求失败");
        return j.data?.body || "";
    }

    /* ---------- 今日热议（多平台） ---------- */

    /* ---------- GitHub 趋势 ---------- */
    async function loadGitHub() {
        if (ghLoading) return;
        ghLoading = true;
        ghError = "";
        try {
            const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            const body = await proxyGet(
                `https://api.github.com/search/repositories?q=created:%3E${since}&sort=stars&order=desc&per_page=24`
            );
            const j = JSON.parse(body) as {
                items?: {
                    id: number;
                    full_name: string;
                    description: string | null;
                    stargazers_count: number;
                    html_url: string;
                    language: string | null;
                }[];
            };
            repos = (j.items || []).map((r) => ({
                id: String(r.id),
                name: r.full_name,
                desc: r.description || "",
                stars: r.stargazers_count,
                url: r.html_url,
                lang: r.language || ""
            }));
        } catch (e) {
            ghError = e instanceof Error ? e.message : String(e);
        }
        ghLoading = false;
    }

    /* ---------- RSS ---------- */
    function parseRSS(xml: string, source: string): Article[] {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const nodes = Array.from(doc.querySelectorAll("item, entry"));
        return nodes.slice(0, 40).map((n, i) => {
            const get = (tags: string[]): string => {
                for (const t of tags) {
                    const el = n.querySelector(t);
                    if (el && el.textContent) return el.textContent.trim();
                }
                return "";
            };
            const linkEl = n.querySelector("link");
            const link = linkEl?.getAttribute("href") || linkEl?.textContent || "";
            const desc = get(["description", "summary", "content"]).replace(/<[^>]+>/g, "").slice(0, 180);
            return {
                id: `${source}-${i}-${get(["title"])}`,
                title: get(["title"]) || "(无标题)",
                link,
                desc,
                date: get(["pubDate", "updated", "published"]),
                source
            };
        });
    }

    async function loadRSS() {
        if (rssLoading) return;
        const feeds = $settings.rssFeeds || [];
        if (feeds.length === 0) {
            rssError = "还没有订阅源，去「系统设置 → RSS 订阅」添加地址";
            articles = [];
            return;
        }
        rssLoading = true;
        rssError = "";
        const out: Article[] = [];
        const errs: string[] = [];
        for (const f of feeds) {
            try {
                const xml = await proxyGet(f.url);
                out.push(...parseRSS(xml, f.name || f.url));
            } catch (e) {
                errs.push(`${f.name || f.url}：${e instanceof Error ? e.message : e}`);
            }
        }
        articles = out;
        if (errs.length) rssError = errs.join("；");
        rssLoading = false;
    }

    /* ---------- 收藏 / 转任务 ---------- */
    function addFav(item: { title: string; url: string; source?: string }) {
        if (!item.url) return;
        if ($favorites.some((f) => f.url === item.url)) return;
        const fav: FavItem = {
            id: uid(),
            title: item.title,
            url: item.url,
            source: item.source || "",
            note: "",
            created: Date.now()
        };
        favorites.update((l) => [fav, ...l]);
        save("favorites");
    }

    function removeFav(id: string) {
        favorites.update((l) => l.filter((x) => x.id !== id));
        save("favorites");
    }

    function toTask(item: { title: string; url: string }) {
        tasks.update((l) => [
            {
                id: uid(),
                title: item.title.slice(0, 90),
                note: "",
                done: false,
                important: false,
                urgent: false,
                created: Date.now(),
                doneAt: 0,
                due: "",
                start: "",
                repeat: "none",
                url: item.url,
                project: "",
                category: "none",
                subtasks: [],
                reminder: 0,
                tags: [],
                isFavorite: false,
                isPinned: false,
                isEvening: false,
                description: ""
            },
            ...l
        ]);
        save("tasks");
    }

    $: q = query.trim().toLowerCase();

    $: filteredRepos = repos.filter(
        (r) => !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
    );
    $: filteredArticles = articles.filter((a) => !q || a.title.toLowerCase().includes(q));
    $: filteredFavs = $favorites.filter(
        (f) => !q || f.title.toLowerCase().includes(q) || (f.note || "").toLowerCase().includes(q)
    );

    /* 视野：所有 RSS 文章按时间倒序聚合 */
    $: explore = articles
        .slice()
        .sort((a, b) => {
            const ta = Date.parse(a.date) || 0;
            const tb = Date.parse(b.date) || 0;
            return tb - ta;
        })
        .filter((a) => !q || a.title.toLowerCase().includes(q));

    function switchTab(t: NewsTab) {
        tab = t;
        if (t === "hot" && Object.keys(hotState).length === 0) void loadHot();
        if (t === "github" && repos.length === 0) void loadGitHub();
        if ((t === "rss" || t === "explore") && articles.length === 0) void loadRSS();
    }

    onMount(() => {
        void loadHot();
    });
</script>

<div class="page-head">
    <div>
        <div class="page-title">朝花夕拾 · 资讯与订阅</div>
        <div class="page-sub">把外面的世界，收进你的手帐里。</div>
    </div>
</div>

<div class="news-toolbar">
    <div class="news-tabs">
        <button class="news-tab" class:on={tab === "hot"} on:click={() => switchTab("hot")}>今日热议</button>
        <button class="news-tab" class:on={tab === "github"} on:click={() => switchTab("github")}>GitHub 趋势</button>
        <button class="news-tab" class:on={tab === "rss"} on:click={() => switchTab("rss")}>RSS 阅览室</button>
        <button class="news-tab" class:on={tab === "explore"} on:click={() => switchTab("explore")}>视野</button>
        <button class="news-tab" class:on={tab === "fav"} on:click={() => switchTab("fav")}>收藏夹</button>
    </div>
    <input class="ty-input search" bind:this={input} placeholder="搜索…" bind:value={query} />
</div>

<div class="news-content">
    {#if tab === "hot"}
        <div class="ty-card">
            <div class="ty-h2">
                <span>今日热议 · {HOT_SOURCES.length} 个平台</span>
                <button class="ty-btn sm" on:click={loadHot} disabled={hotLoading}>
                    {hotLoading ? "刷新中…" : "全部刷新"}
                </button>
            </div>
            <div class="hot-grid">
                {#each HOT_SOURCES as s (s.key)}
                    {@const st = hotState[s.key]}
                    <div class="hot-col {s.tint}">
                        <div class="hot-col-head">
                            <span>{s.name}</span>
                            {#if st && st.loading}<span class="spin">…</span>{/if}
                        </div>
                        {#if st && st.error}
                            <div class="hot-empty">{st.error}</div>
                        {:else if !st || st.loading}
                            <div class="hot-empty">加载中…</div>
                        {:else if hotList(s.key).length === 0}
                            <div class="hot-empty">暂无内容</div>
                        {:else}
                            {#each hotList(s.key) as h, i (s.key + i)}
                                <div class="hot-row">
                                    <span class="rank" class:top={i < 3}>{i + 1}</span>
                                    <div class="hot-body">
                                        <a class="hot-title" href={h.link} target="_blank" rel="noreferrer">{h.title}</a>
                                        {#if h.hot}<span class="hot-val">{h.hot}</span>{/if}
                                    </div>
                                    <button
                                        class="mini star"
                                        title="收藏"
                                        on:click={() => addFav({ title: h.title, url: h.link, source: s.name })}
                                    >★</button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {:else if tab === "github"}
        <div class="ty-card">
            <div class="ty-h2">
                <span>近一周 star 增长最快的仓库</span>
                <button class="ty-btn sm" on:click={loadGitHub} disabled={ghLoading}>
                    {ghLoading ? "加载中…" : "刷新"}
                </button>
            </div>
            {#if ghError}
                <div class="err">{ghError}</div>
            {/if}
            {#if filteredRepos.length === 0}
                <div class="ty-empty">{ghLoading ? "正在拉取 GitHub 数据…" : "没有结果"}</div>
            {:else}
                <div class="repo-grid">
                    {#each filteredRepos as r (r.id)}
                        <div class="repo">
                            <div class="repo-head">
                                <a class="repo-name" href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                                <span class="stars">★ {r.stars}</span>
                            </div>
                            <div class="repo-desc">{r.desc || "（无描述）"}</div>
                            <div class="repo-foot">
                                {#if r.lang}<span class="lang">{r.lang}</span>{/if}
                                <div class="sp"></div>
                                <button class="mini" on:click={() => addFav({ title: r.name, url: r.url, source: "GitHub" })}>收藏</button>
                                <button class="mini" on:click={() => toTask({ title: r.name, url: r.url })}>转任务</button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if tab === "rss"}
        <div class="ty-card">
            <div class="ty-h2">
                <span>订阅源 · {($settings.rssFeeds || []).length} 个</span>
                <button class="ty-btn sm" on:click={loadRSS} disabled={rssLoading}>
                    {rssLoading ? "加载中…" : "全部刷新"}
                </button>
            </div>
            {#if rssError}
                <div class="err">{rssError}</div>
            {/if}
            {#if filteredArticles.length === 0}
                <div class="ty-empty">还没有文章。去「系统设置 → RSS 订阅」添加订阅地址。</div>
            {:else}
                <div class="article-list">
                    {#each filteredArticles as a (a.id)}
                        <div class="article">
                            <div class="a-main">
                                <a class="a-title" href={a.link} target="_blank" rel="noreferrer">{a.title}</a>
                                {#if a.desc}<div class="a-desc">{a.desc}</div>{/if}
                                <div class="a-meta">
                                    <span class="src">{a.source}</span>
                                    {#if a.date}<span>{a.date.slice(0, 16)}</span>{/if}
                                </div>
                            </div>
                            <div class="acts always">
                                <button class="mini" on:click={() => addFav({ title: a.title, url: a.link, source: a.source })}>收藏</button>
                                <button class="mini" on:click={() => toTask({ title: a.title, url: a.link })}>转任务</button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if tab === "explore"}
        <div class="ty-card">
            <div class="ty-h2">
                <span>视野 · 所有订阅的最新文章</span>
                <button class="ty-btn sm" on:click={loadRSS} disabled={rssLoading}>
                    {rssLoading ? "加载中…" : "刷新"}
                </button>
            </div>
            {#if rssError}
                <div class="err">{rssError}</div>
            {/if}
            {#if explore.length === 0}
                <div class="ty-empty">添加 RSS 订阅后，这里会按时间汇总所有来源的文章。</div>
            {:else}
                <div class="article-list">
                    {#each explore.slice(0, 60) as a (a.id)}
                        <div class="article">
                            <div class="a-main">
                                <a class="a-title" href={a.link} target="_blank" rel="noreferrer">{a.title}</a>
                                <div class="a-meta">
                                    <span class="src">{a.source}</span>
                                    {#if a.date}<span>{a.date.slice(0, 16)}</span>{/if}
                                </div>
                            </div>
                            <div class="acts always">
                                <button class="mini" on:click={() => addFav({ title: a.title, url: a.link, source: a.source })}>收藏</button>
                                <button class="mini" on:click={() => toTask({ title: a.title, url: a.link })}>转任务</button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else}
        <div class="ty-card">
            <div class="ty-h2">收藏夹 · {filteredFavs.length} 条</div>
            {#if filteredFavs.length === 0}
                <div class="ty-empty">还没有收藏。在上面几个列表里点「收藏」。</div>
            {:else}
                <div class="article-list">
                    {#each filteredFavs as f (f.id)}
                        <div class="article">
                            <div class="a-main">
                                <a class="a-title" href={f.url} target="_blank" rel="noreferrer">{f.title}</a>
                                <div class="a-meta">
                                    {#if f.source}<span class="src">{f.source}</span>{/if}
                                    <span>{new Date(f.created).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div class="acts always">
                                <button class="mini" on:click={() => toTask({ title: f.title, url: f.url })}>转任务</button>
                                <button class="mini danger" on:click={() => removeFav(f.id)}>删除</button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .news-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 4px;
    }
    .news-tabs {
        display: flex;
        flex-wrap: wrap;
        min-width: 0;
        max-width: 100%;
        gap: 4px;
        background: #fff;
        padding: 5px;
        border-radius: 14px;
        box-shadow: 0 2px 14px rgba(90, 78, 55, 0.05);
    }
    .news-tab {
        border: 0;
        background: transparent;
        color: #6b7568;
        font-family: inherit;
        font-size: 12px;
        padding: 7px 14px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
    }
    .news-tab:hover {
        background: #f8f6f0;
    }
    .news-tab.on {
        background: #4d7c5d;
        color: #fff;
        font-weight: 600;
    }
    .search {
        flex: 1;
        min-width: 140px;
        max-width: 240px;
    }
    .err {
        font-size: 11.5px;
        color: #b0543f;
        background: #fdf2f1;
        padding: 8px 12px;
        border-radius: 10px;
        margin-bottom: 10px;
    }

    .news-content, .news-content :global(.ty-card) {
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
    }
    .hot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
        min-width: 0;
        gap: 10px;
        align-items: start;
    }
    .hot-col {
        min-width: 0;
        box-sizing: border-box;
        border-radius: 14px;
        padding: 12px 11px 6px;
    }
    .hot-col.pink {
        background: #fdf2f1;
    }
    .hot-col.blue {
        background: #eff4fa;
    }
    .hot-col.cyan {
        background: #edf6f5;
    }
    .hot-col.dark {
        background: #f1f1ef;
    }
    .hot-col.orange {
        background: #fdf4ec;
    }
    .hot-col.gray {
        background: #f4f3f0;
    }
    .hot-col-head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #2f3a32;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        margin-bottom: 5px;
    }
    .spin {
        opacity: 0.4;
        font-weight: 400;
    }
    .hot-empty {
        padding: 22px 6px;
        text-align: center;
        font-size: 11px;
        color: #9aa398;
        opacity: 0.7;
    }
    .hot-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 6px 3px;
        border-radius: 8px;
    }
    .hot-row:hover {
        background: rgba(255, 255, 255, 0.65);
    }
    .rank {
        flex: 0 0 18px;
        height: 18px;
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.05);
        color: #9aa398;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 2px;
    }
    .rank.top {
        background: #4d7c5d;
        color: #fff;
    }
    .hot-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .hot-title {
        font-size: 11.5px;
        color: #2f3a32;
        text-decoration: none;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }
    .hot-title:hover {
        color: #4d7c5d;
        text-decoration: underline;
    }
    .hot-val {
        font-size: 9.5px;
        color: #b9b2a2;
    }
    .mini.star {
        flex: 0 0 auto;
        padding: 2px 6px;
        opacity: 0;
    }
    .hot-row:hover .mini.star {
        opacity: 1;
    }

    .repo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
        gap: 12px;
    }
    .repo {
        border: 1px solid #f0ece3;
        border-radius: 14px;
        padding: 13px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .repo:hover {
        border-color: #cfdfd2;
        box-shadow: 0 4px 14px rgba(90, 78, 55, 0.07);
    }
    .repo-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }
    .repo-name {
        flex: 1;
        min-width: 0;
        font-size: 12.5px;
        font-weight: 600;
        color: #2f3a32;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .repo-name:hover {
        color: #4d7c5d;
        text-decoration: underline;
    }
    .stars {
        flex: 0 0 auto;
        font-size: 11px;
        color: #d8bb7a;
    }
    .repo-desc {
        font-size: 11.5px;
        color: #6b7568;
        line-height: 1.55;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        min-height: 36px;
    }
    .repo-foot {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .lang {
        font-size: 10px;
        color: #9aa398;
        background: #f8f6f0;
        padding: 2px 8px;
        border-radius: 10px;
    }
    .sp {
        flex: 1;
    }
    .mini {
        border: 1px solid #ece8df;
        background: #fff;
        color: #6b7568;
        font-family: inherit;
        font-size: 10.5px;
        padding: 3px 9px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.14s;
    }
    .mini:hover {
        border-color: #cfdfd2;
        color: #4d7c5d;
    }
    .mini.danger:hover {
        border-color: #e2b8c4;
        color: #b0543f;
    }

    .article-list {
        display: flex;
        flex-direction: column;
    }
    .article {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 4px;
        border-bottom: 1px solid #f4f1ea;
    }
    .article:last-child {
        border-bottom: 0;
    }
    .a-main {
        flex: 1;
        min-width: 0;
    }
    .a-title {
        font-size: 12.5px;
        font-weight: 600;
        color: #2f3a32;
        text-decoration: none;
        line-height: 1.5;
    }
    .a-title:hover {
        color: #4d7c5d;
        text-decoration: underline;
    }
    .a-desc {
        font-size: 11.5px;
        color: #9aa398;
        line-height: 1.6;
        margin-top: 4px;
    }
    .a-meta {
        display: flex;
        gap: 10px;
        font-size: 10px;
        color: #b9b2a2;
        margin-top: 6px;
    }
    .src {
        color: #4d7c5d;
        background: #e6efe7;
        padding: 1px 7px;
        border-radius: 8px;
    }
    .acts {
        display: flex;
        gap: 5px;
        flex: 0 0 auto;
        opacity: 0;
        transition: opacity 0.14s;
    }
    .acts.always,
    .article:hover .acts {
        opacity: 1;
    }
    :global(.ty-root.dark) .news-tabs { background: var(--card); }
    :global(.ty-root.dark) .news-tab { color: var(--text-2); }
    :global(.ty-root.dark) .news-tab:hover { background: var(--card-soft); }
    :global(.ty-root.dark) .news-tab.on { background: var(--green); color: #16201a; }
</style>
