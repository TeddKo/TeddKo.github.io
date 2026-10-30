<script lang="ts">
  import Player from "../Player.svelte";
  import { INPUT, seqFrames, type Panel, type SeqFrame } from "./seqFrames";

  const frames = seqFrames();
</script>

{#snippet panel(title: string, sub: string, p: Panel)}
  <div class="panel">
    <h4>{title}<small>{sub}</small></h4>
    <span class="lab">input</span>
    <div class="cells">
      {#each INPUT as v}<span class="c">{v}</span>{/each}
    </div>
    <span class="lab">map {"{ it * 2 }"}</span>
    <div class="cells">
      {#each p.map as v, i}
        <span class="c" class:empty={v === null}>{v ?? (p.untouched && i >= 3 ? "-" : "")}</span>
      {/each}
    </div>
    <span class="lab">filter {"{ it > 4 }"}</span>
    <div class="cells">
      {#each p.filter as e, i}
        <span class="c" class:empty={e.cell === "empty"} class:drop={e.cell === "drop"} class:keep={e.cell === "keep"}
          >{e.v ?? (p.untouched && i >= 3 ? "-" : "")}</span
        >
      {/each}
    </div>
    <div class="ops" class:done={p.done}>
      <b>operations: {p.ops}</b>
      <span>{p.note}</span>
    </div>
  </div>
{/snippet}

{#snippet frame(f: SeqFrame)}
  <div class="wrap">
    <code class="expr">list.map {"{ it * 2 }"}.filter {"{ it > 4 }"}.first()</code>
    <div class="two">
      {@render panel("Iterable (List)", "연산자 단위", f.iter)}
      {@render panel("Sequence (asSequence)", "원소 단위", f.seq)}
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={() => "Sequence 는 first() 가 필요 없는 작업을 건너뜁니다"} />

<style>
  .wrap {
    display: grid;
    gap: 0.4rem;
    font-family: var(--font-mono);
  }
  .expr {
    justify-self: center;
    font-size: 0.7rem;
    color: var(--viz-ink);
    text-align: center;
    overflow-wrap: anywhere;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }
  .panel {
    display: grid;
    gap: 0.15rem;
    align-content: start;
    padding: 0.35rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    min-width: 0;
  }
  h4 {
    margin: 0 0 0.1rem;
    font-size: 0.68rem;
    text-align: center;
    color: var(--viz-ink);
    line-height: 1.2;
  }
  h4 small {
    display: block;
    color: var(--viz-muted);
    font-size: 9.5px;
    font-weight: 400;
  }
  .lab {
    color: var(--viz-muted);
    font-size: 9.5px;
    margin-top: 0.15rem;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 2px;
  }
  .c {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    min-width: 0;
    border: 1px solid var(--viz-ink);
    border-radius: 3px;
    color: var(--viz-ink);
    font-size: 9.5px;
    font-weight: 700;
  }
  .c.empty {
    border: 1px dashed var(--viz-rule);
    color: var(--viz-muted);
  }
  .c.drop {
    border-color: var(--viz-rule);
    color: var(--viz-muted);
    text-decoration: line-through;
    background: var(--viz-tint);
  }
  .c.keep {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .ops {
    display: grid;
    gap: 0.1rem;
    margin-top: 0.3rem;
    padding: 0.3rem 0.35rem;
    border: 1px solid transparent;
    border-radius: 4px;
    background: var(--viz-tint);
    font-size: 9.5px;
    line-height: 1.3;
    color: var(--viz-muted);
    min-height: 4.2em;
    align-content: start;
  }
  .ops b {
    color: var(--viz-ink);
    font-size: 0.72rem;
  }
  .ops.done {
    border-color: var(--viz-accent);
  }
  .ops.done b {
    color: var(--viz-accent);
  }
  @media (min-width: 560px) {
    .c,
    .lab,
    .ops {
      font-size: 0.72rem;
    }
  }
</style>
