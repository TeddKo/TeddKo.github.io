<script lang="ts">
  import Player from "../Player.svelte";
  import { EVENTS, projectionFrames, type ProjectionFrame } from "./projectionFrames";

  const frames = projectionFrames();
</script>

{#snippet frame(f: ProjectionFrame)}
  <div class="grid">
    <div class="box">
      <h4>Event store (append-only)</h4>
      <ol>
        {#each EVENTS as e, i}
          <li class:empty={i >= f.shown} class:on={f.active === i + 1}>
            {#if i < f.shown}<small>#{i + 1}</small>{e.name}{/if}
          </li>
        {/each}
      </ol>
    </div>
    <div class="box proj">
      <h4>Projection: 현재 잔액</h4>
      <strong class:lost={f.balance === null}>{f.balance ?? "?"}</strong>
      <small>{f.balance === null ? "상태 유실" : `#${f.applied} 까지 적용`}</small>
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 0.5rem;
    font-family: var(--font-mono);
  }
  .box {
    padding: 0.4rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    min-width: 0;
  }
  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.68rem;
    color: var(--viz-ink);
    text-align: center;
  }
  ol {
    display: grid;
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: 0.35em;
    align-items: baseline;
    min-height: 1.9em;
    padding: 0.3em 0.4em;
    border: 1px solid var(--viz-ink);
    border-radius: 4px;
    color: var(--viz-ink);
    font-size: 9.5px;
    overflow-wrap: anywhere;
  }
  li.empty {
    border: 1px dashed var(--viz-rule);
  }
  li.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  li small {
    color: var(--viz-muted);
  }
  li.on small {
    color: var(--viz-accent);
  }
  .proj {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.4rem;
    text-align: center;
  }
  strong {
    font-size: 2.2rem;
    line-height: 1;
    color: var(--viz-ink);
  }
  strong.lost {
    color: var(--viz-muted);
  }
  .proj small {
    color: var(--viz-muted);
    font-size: 9.5px;
  }
  @media (min-width: 560px) {
    li {
      font-size: 0.75rem;
    }
  }
</style>
