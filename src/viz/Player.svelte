<script lang="ts" generics="F">
  import type { Snippet } from "svelte";
  import { useTranslations, tplStr } from "@/i18n";
  import config from "@/config";

  const t = useTranslations(config.site.lang);

  let {
    frames,
    caption,
    frame,
  }: {
    frames: F[];
    caption: (f: F) => string;
    frame: Snippet<[F]>;
  } = $props();

  const SPEEDS = [0.5, 1, 2];
  const total = frames.length;
  let i = $state(0);
  let playing = $state(false);
  let speed = $state(1);
  let userPaused = false;
  let visible = false;
  let root: HTMLElement;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function play() {
    if (i >= total - 1) i = 0;
    playing = true;
  }
  function pause() {
    playing = false;
  }
  function toggle() {
    userPaused = playing;
    playing ? pause() : play();
  }
  function step(d: number) {
    pause();
    userPaused = true;
    i = Math.min(total - 1, Math.max(0, i + d));
  }
  function restart() {
    i = 0;
    userPaused = false;
    if (visible && !reduced) play();
    else pause();
  }

  $effect(() => {
    if (!playing) return;
    const cur = i;
    const t = setTimeout(() => {
      i = Math.min(cur + 1, total - 1);
      if (i >= total - 1) playing = false;
    }, 550 / speed);
    return () => clearTimeout(t);
  });

  $effect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (!visible) pause();
        else if (!reduced && !userPaused && i < total - 1) play();
      },
      { threshold: 0.4 }
    );
    io.observe(root);
    return () => io.disconnect();
  });

  function onkeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("button, input")) return;
    if (e.key === " ") toggle();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="viz"
  bind:this={root}
  role="group"
  aria-label={t.viz.region}
  tabindex="0"
  {onkeydown}
>
  <div class="stage">{@render frame(frames[i])}</div>
  <p class="caption" aria-live="polite">{caption(frames[i])}</p>
  <div class="bar">
    <button
      type="button"
      onclick={restart}
      aria-label={t.viz.first}
      title={t.viz.first}>⏮</button
    >
    <button
      type="button"
      onclick={() => step(-1)}
      disabled={i === 0}
      aria-label={t.viz.prev}>‹</button
    >
    <button
      type="button"
      class="primary"
      onclick={toggle}
      aria-label={playing ? t.viz.pause : t.viz.play}
      aria-pressed={playing}>{playing ? "❚❚" : "▶"}</button
    >
    <button
      type="button"
      onclick={() => step(1)}
      disabled={i === total - 1}
      aria-label={t.viz.next}>›</button
    >
    <span class="count" aria-hidden="true">{i + 1} / {total}</span>
    <button
      type="button"
      class="speed"
      onclick={() => (speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % 3])}
      aria-label={tplStr(t.viz.speedLabel, { speed })}>{speed}x</button
    >
  </div>
  <input
    type="range"
    min="0"
    max={total - 1}
    bind:value={i}
    oninput={() => {
      pause();
      userPaused = true;
    }}
    aria-label={t.viz.seek}
  />
</div>

<style>
  .viz {
    --viz-blue: #0066cc;
    --viz-ink: var(--foreground);
    --viz-muted: var(--muted-foreground);
    --viz-rule: var(--border);
    --viz-accent: var(--accent);
    --viz-tint: rgba(124, 58, 237, 0.08);
    margin: 1.5rem 0;
    padding: 0.75rem;
    border: 1px solid var(--viz-rule);
    border-radius: 8px;
    background: var(--background);
    color: var(--viz-ink);
    font-family: var(--font-app);
    font-size: 0.875rem;
    display: grid;
    gap: 0.5rem;
  }
  :global([data-theme="dark"]) .viz {
    --viz-blue: #4da3ff;
    --viz-tint: rgba(167, 139, 250, 0.12);
  }
  .viz:focus-visible {
    outline: 2px solid var(--viz-accent);
    outline-offset: 2px;
  }
  .stage {
    min-width: 0;
  }
  .caption {
    margin: 0;
    min-height: 2.8em;
    color: var(--viz-muted);
    line-height: 1.4;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  button {
    min-width: 40px;
    min-height: 40px;
    padding: 0 0.5rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    background: transparent;
    color: var(--viz-ink);
    font: inherit;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--viz-tint);
  }
  button:focus-visible {
    outline: 2px solid var(--viz-accent);
    outline-offset: 1px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.primary,
  button[aria-pressed="true"] {
    border-color: var(--viz-accent);
    color: var(--viz-accent);
    background: var(--viz-tint);
  }
  .count {
    margin-inline: auto 0.25rem;
    font-family: var(--font-mono);
    color: var(--viz-muted);
  }
  input[type="range"] {
    width: 100%;
    min-height: 40px;
    margin: 0;
    accent-color: var(--viz-accent);
  }
</style>
