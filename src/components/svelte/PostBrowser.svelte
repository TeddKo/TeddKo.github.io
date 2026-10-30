<script lang="ts">
  import { onMount } from "svelte";
  import { CATEGORIES, type Category } from "@/utils/categories";
  import { useTranslations, tplStr } from "@/i18n";
  import config from "@/config";

  const t = useTranslations(config.site.lang);

  type Post = {
    title: string;
    url: string;
    tname: string;
    description: string;
    category: Category;
    categoryLabel: string;
    featured: boolean;
    tags: { slug: string; name: string }[];
    modified: boolean;
    date: string;
    iso: string;
  };

  let { src, updatedLabel }: { src: string; updatedLabel: string } = $props();

  const PAGE = 12;

  let posts = $state<Post[] | null>(null);
  let category = $state("");
  let tag = $state("");
  let shown = $state(PAGE);
  let sentinel = $state<HTMLElement>();
  let filtersNav = $state<HTMLElement>();

  const inCategory = $derived(
    posts?.filter(p => !category || p.category === category) ?? []
  );
  const filtered = $derived(
    inCategory.filter(p => !tag || p.tags.some(t => t.slug === tag))
  );
  const categories = $derived(
    CATEGORIES.filter(c => posts?.some(p => p.category === c))
  );
  const tags = $derived.by(() => {
    const map = new Map<string, { name: string; n: number }>();
    for (const p of inCategory)
      for (const t of p.tags) {
        const e = map.get(t.slug) ?? { name: t.name, n: 0 };
        e.n++;
        map.set(t.slug, e);
      }
    return [...map].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  });

  function readUrl() {
    const q = new URLSearchParams(location.search);
    category = q.get("category") ?? "";
    tag = q.get("tag") ?? "";
    shown = PAGE;
  }

  function setFilter(next: { category?: string; tag?: string }) {
    category = next.category ?? category;
    tag = next.tag ?? tag;
    shown = PAGE;
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (tag) q.set("tag", tag);
    const qs = q.toString();
    history.pushState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }

  onMount(() => {
    readUrl();
    addEventListener("popstate", readUrl);
    fetch(src)
      .then(r => r.json())
      .then((data: Post[]) => {
        posts = data;
        document.getElementById("post-static")?.setAttribute("hidden", "");
        document.getElementById("post-pagination")?.setAttribute("hidden", "");
      })
      .catch(() => {});
    return () => removeEventListener("popstate", readUrl);
  });

  $effect(() => {
    void category;
    filtersNav
      ?.querySelector("[aria-current]")
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  });

  $effect(() => {
    void shown;
    void filtered;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && shown < filtered.length) shown += PAGE;
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });
</script>

{#if posts}
  <nav class="filters" aria-label={t.postBrowser.categoryNav} bind:this={filtersNav}>
    <ul class="segmented">
      {#each [["", t.categories.filterAll], ...categories.map(c => [c, t.categories.labels[c]])] as [slug, label] (slug)}
        <li>
          <a
            href={slug ? `?category=${slug}` : "?"}
            aria-current={slug === category ? "page" : undefined}
            onclick={e => {
              e.preventDefault();
              setFilter({ category: slug, tag: "" });
            }}
          >
            {label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="bar">
    <select
      aria-label={t.postBrowser.tagNav}
      value={tag}
      onchange={e => setFilter({ tag: e.currentTarget.value })}
    >
      <option value="">{t.postBrowser.tagAll}</option>
      {#if tag && !tags.some(([s]) => s === tag)}
        <option value={tag}>{tag}</option>
      {/if}
      {#each tags as [slug, t] (slug)}
        <option value={slug}>{t.name} ({t.n})</option>
      {/each}
    </select>
    <p class="secondary text-sm" aria-live="polite">{tplStr(t.postBrowser.countLabel, { n: filtered.length })}</p>
  </div>

  {#if filtered.length}
    <ul class="tile-grid tile-grid-3">
      {#each filtered.slice(0, shown) as p, i (p.url)}
        <li
          class="tile flex flex-col is-revealed"
          style="--i:{i % 3}"
          data-reveal
        >
          <p class="eyebrow eyebrow-quiet text-base!">
            {#if p.featured}<span class="text-accent">{t.card.featured}</span>{/if}
            {p.categoryLabel}
          </p>
          <h2 class="tile-title mt-2" style="view-transition-name:{p.tname}">
            <a href={p.url} class="tile-link">{p.title}</a>
          </h2>
          <p class="secondary clamp-3 mt-3 text-base">{p.description}</p>
          <div
            class="text-muted-foreground mt-auto flex items-center gap-x-2 pt-5"
          >
            {#if p.modified}<span class="text-sm">{updatedLabel}:</span>{/if}
            <time class="text-sm" datetime={p.iso}>{p.date}</time>
          </div>
        </li>
      {/each}
    </ul>
    <div bind:this={sentinel} aria-hidden="true"></div>
  {:else}
    <p class="secondary">
      {t.postBrowser.empty}
      <button
        type="button"
        class="link-more"
        onclick={() => setFilter({ category: "", tag: "" })}
      >
        {t.postBrowser.reset}
      </button>
    </p>
  {/if}
{/if}

<style>
  .filters {
    margin-bottom: 1rem;
    max-width: 100%;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  select {
    min-width: 0;
    max-width: 60%;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--foreground);
    padding: 0.4rem 1rem;
    font-size: 0.9375rem;
  }
  select:focus-visible {
    outline: 2px solid var(--accent);
  }
</style>
