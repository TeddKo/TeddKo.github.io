<script lang="ts">
  import Player from "../Player.svelte";
  import { lruFrames, REFS, FRAMES, type LruFrame } from "./lruFrames";

  const frames = lruFrames();
  const rows = Array.from({ length: FRAMES }, (_, r) => r);
</script>

{#snippet frame(f: LruFrame)}
  <div class="wrap">
    <div class="legend">
      <span><i class="f"></i>F 폴트</span>
      <span><i class="h"></i>H 히트</span>
      <b>폴트 {f.faults}</b>
    </div>
    <div class="grid" role="img" aria-label="참조열과 프레임 상태 표">
      <span class="lab">참조</span>
      {#each REFS as p, t}
        <span class="c ref" class:cur={t === f.t}>{p}</span>
      {/each}
      {#each rows as r}
        <span class="lab">F{r}</span>
        {#each REFS as _, t}
          {@const v = f.grid[t]?.[r] ?? null}
          {@const now = t === f.t && r === f.slot}
          <span
            class="c"
            class:empty={v === null}
            class:new={now && !f.hit}
            class:hitc={now && f.hit}>{v ?? ""}</span
          >
        {/each}
      {/each}
      <span class="lab">결과</span>
      {#each REFS as _, t}
        <span class="c res" class:flt={f.result[t] === "F"}>{f.result[t] ?? ""}</span>
      {/each}
    </div>
    <div class="rec">
      <span class="lab2">최근 사용 순서 (오래된 쪽 → 최신)</span>
      <div class="row">
        {#each f.recency as p, i}
          <span class="pg" class:victim={i === 0 && f.recency.length === FRAMES}>{p}</span>
        {/each}
        {#if f.recency.length === FRAMES}<em>← 교체 후보</em>{/if}
      </div>
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .wrap {
    display: grid;
    gap: 0.5rem;
    font-family: var(--font-mono);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
    align-items: center;
    color: var(--viz-muted);
    font-size: 0.75rem;
  }
  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 0.3rem;
    border-radius: 2px;
  }
  .legend .f {
    background: var(--viz-accent);
  }
  .legend .h {
    background: var(--viz-blue);
  }
  .legend b {
    margin-left: auto;
    font-weight: 500;
    color: var(--viz-ink);
  }
  .grid {
    display: grid;
    grid-template-columns: 2.4rem repeat(20, minmax(0, 1fr));
    gap: 2px;
    font-size: 9.5px;
  }
  .lab {
    align-self: center;
    color: var(--viz-muted);
    font-size: 9.5px;
    white-space: nowrap;
  }
  .c {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    min-width: 0;
    border: 1px solid var(--viz-rule);
    border-radius: 2px;
    color: var(--viz-ink);
    font-weight: 600;
  }
  .c.empty {
    border-style: dashed;
    opacity: 0.6;
  }
  .c.ref.cur {
    background: var(--viz-accent);
    border-color: var(--viz-accent);
    color: var(--background);
  }
  .c.new {
    background: var(--viz-tint);
    border-color: var(--viz-accent);
    color: var(--viz-accent);
  }
  .c.hitc {
    border-color: var(--viz-blue);
    color: var(--viz-blue);
  }
  .c.res {
    border: 0;
    aspect-ratio: auto;
    color: var(--viz-blue);
  }
  .c.res.flt {
    color: var(--viz-accent);
  }
  .rec {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    font-size: 0.75rem;
  }
  .lab2 {
    color: var(--viz-muted);
    font-size: 0.7rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2rem;
    margin-top: 0.25rem;
  }
  .pg {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border: 1px solid var(--viz-ink);
    border-radius: 4px;
    color: var(--viz-ink);
    font-weight: 600;
  }
  .pg.victim {
    background: var(--viz-tint);
    border-color: var(--viz-accent);
    color: var(--viz-accent);
  }
  em {
    margin-left: auto;
    font-style: normal;
    color: var(--viz-accent);
    font-size: 0.7rem;
  }
</style>
