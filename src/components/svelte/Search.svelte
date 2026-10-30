<script lang="ts">
  import { onMount } from "svelte";
  import { navigate } from "astro:transitions/client";
  import { useTranslations, tplStr } from "@/i18n";
  import config from "@/config";

  const t = useTranslations(config.site.lang);

  type Hit = { url: string; title: string; excerpt: string; category: string };
  type Pagefind = {
    options: (o: { basePath: string }) => Promise<void>;
    search: (q: string) => Promise<{
      results: { data: () => Promise<any> }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    }>;
  };

  let {
    bundlePath,
    indexSrc,
    backUrl,
  }: { bundlePath: string; indexSrc: string; backUrl: string } = $props();

  const STEP = 10;

  let q = $state("");
  let status = $state<"idle" | "loading" | "done" | "error">("idle");
  let hits = $state<Hit[]>([]);
  let rest = $state<{ data: () => Promise<any> }[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  let total = $state(0);
  let active = $state(-1);
  let devMissing = $state(false);
  let input = $state<HTMLInputElement>();

  let pf: Promise<Pagefind> | undefined;
  let categories: Promise<Map<string, string>> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let seq = 0;

  const key = (u: string) => u.replace(/\/$/, "");

  function load() {
    pf ??= (async () => {
      const m: Pagefind = await import(
        /* @vite-ignore */ `${bundlePath}pagefind.js`
      );
      await m.options({ basePath: bundlePath });
      return m;
    })();
    categories ??= fetch(indexSrc)
      .then(r => r.json())
      .then(
        (d: { url: string; categoryLabel: string }[]) =>
          new Map(d.map(p => [key(p.url), p.categoryLabel]))
      )
      .catch(() => new Map());
    return Promise.all([pf, categories] as const);
  }

  async function toHits(
    items: { data: () => Promise<any> }[], // eslint-disable-line @typescript-eslint/no-explicit-any
    cats: Map<string, string>
  ): Promise<Hit[]> {
    return (await Promise.all(items.map(r => r.data()))).map(d => ({
      url: d.url,
      title: d.meta?.title ?? d.url,
      excerpt: d.excerpt,
      category: cats.get(key(d.url)) ?? "",
    }));
  }

  async function run(term: string) {
    const id = ++seq;
    if (!term) {
      status = "idle";
      hits = [];
      rest = [];
      total = 0;
      return;
    }
    status = "loading";
    try {
      const [p, cats] = await load();
      const res = await p.search(term);
      const first = await toHits(res.results.slice(0, STEP), cats);
      if (id !== seq) return;
      hits = first;
      rest = res.results.slice(STEP);
      total = res.results.length;
      active = -1;
      status = "done";
    } catch {
      if (id !== seq) return;
      devMissing = import.meta.env.DEV;
      status = "error";
    }
  }

  async function more() {
    const [, cats] = await load();
    const next = await toHits(rest.slice(0, STEP), cats);
    hits = [...hits, ...next];
    rest = rest.slice(STEP);
  }

  function sync(term: string) {
    const url = location.pathname + (term ? `?q=${encodeURIComponent(term)}` : "");
    history.replaceState(history.state, "", url);
    try {
      sessionStorage.setItem("backUrl", `${backUrl.split("?")[0]}${url.slice(location.pathname.length)}`);
    } catch {
      /* storage unavailable */
    }
  }

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sync(q.trim());
      run(q.trim());
    }, 250);
  }

  function clear() {
    clearTimeout(timer);
    q = "";
    sync("");
    run("");
    input?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      clear();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      active = (active + d + hits.length) % hits.length;
      document.getElementById(`hit-${active}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      navigate(hits[active].url);
    }
  }

  onMount(() => {
    q = new URLSearchParams(location.search).get("q") ?? "";
    input?.focus();
    if (q) run(q.trim());
    return () => clearTimeout(timer);
  });
</script>

<div class="search">
  <div class="field">
    <input
      bind:this={input}
      bind:value={q}
      oninput={onInput}
      onkeydown={onKey}
      type="search"
      placeholder={t.a11y.searchPlaceholder}
      aria-label={t.search.label}
      aria-controls="hits"
      aria-activedescendant={active >= 0 ? `hit-${active}` : undefined}
      autocomplete="off"
      spellcheck="false"
    />
    {#if q}
      <button type="button" class="clear" aria-label={t.search.clear} onclick={clear}>
        ×
      </button>
    {/if}
  </div>

  <div aria-live="polite" class="state secondary">
    {#if status === "loading"}
      {t.search.loading}
    {:else if status === "error"}
      {#if devMissing}
        <strong>{t.search.devNoticeTitle}</strong>
        {t.search.devNoticeBody}
        <code>pnpm run build</code>
      {:else}
        {t.search.error}
      {/if}
    {:else if status === "done"}
      {total ? tplStr(t.search.resultCount, { n: total }) : t.a11y.noResults}
    {/if}
  </div>

  <ul id="hits" class="hits" role="listbox" aria-label={t.search.resultsNav}>
    {#each hits as h, i (h.url)}
      <li
        id="hit-{i}"
        class="tile hit"
        class:active={i === active}
        role="option"
        aria-selected={i === active}
      >
        {#if h.category}<p class="eyebrow eyebrow-quiet text-base!">{h.category}</p>{/if}
        <h2 class="tile-title mt-2">
          <a href={h.url} class="tile-link">{h.title}</a>
        </h2>
        <p class="secondary mt-3 text-base">{@html h.excerpt}</p>
      </li>
    {/each}
  </ul>
  {#if rest.length}
    <button type="button" class="more link-more" onclick={more}>
      {t.search.more}
    </button>
  {/if}
</div>

<style>
  .field {
    position: relative;
  }
  input {
    width: 100%;
    border-radius: 0.875rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--foreground);
    padding: 0.8rem 2.75rem 0.8rem 1rem;
    font-size: 1.0625rem;
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    position: absolute;
    inset-block: 0;
    right: 0.5rem;
    width: 2rem;
    font-size: 1.5rem;
    color: var(--muted-foreground);
  }
  .state {
    min-height: 1.5rem;
    margin-block: 1rem;
    font-size: 0.9375rem;
  }
  .state code {
    display: block;
    margin-top: 0.5rem;
  }
  .hits {
    display: grid;
    gap: 1rem;
  }
  .hit.active {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .hit :global(mark) {
    background: color-mix(in srgb, var(--accent) 25%, transparent);
    color: inherit;
    border-radius: 0.2em;
  }
  .more {
    display: block;
    margin: 1.5rem auto 0;
  }
</style>
