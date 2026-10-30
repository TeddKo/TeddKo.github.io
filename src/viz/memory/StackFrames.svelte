<script lang="ts">
  import Player from "../Player.svelte";
  import { CODE, stackFrames, type StackFrame } from "./stackFrames";

  const frames = stackFrames();
  const MAX = 4;
</script>

{#snippet frame(f: StackFrame)}
  <div class="grid">
    <pre class="code" aria-label="코드">{#each CODE as l, i}<span class:on={f.line === i}>{l}</span>{/each}</pre>
    <div class="stack">
      <small>스택 (위가 가장 최근 프레임)</small>
      <div class="col" style="min-height:{MAX * 2.6}em">
        {#each [...f.stack].reverse() as fr, i (fr.name)}
          <div class="fr" class:top={i === 0}>
            <b>{fr.name}</b>
            <span>{fr.n !== undefined ? `n=${fr.n}` : `r = ${fr.r ?? "?"}`}</span>
            {#if i === 0}<em>← SP</em>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .code {
    margin: 0;
    padding: 0.4rem;
    display: grid;
    align-content: start;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    background: transparent;
    overflow: hidden;
    font: inherit;
    color: var(--viz-ink);
  }
  .code span {
    display: block;
    padding: 0.15em 0.3em;
    border: 1px solid transparent;
    border-radius: 3px;
    white-space: pre;
  }
  .code span.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .stack small {
    display: block;
    color: var(--viz-muted);
    font-size: 0.68rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 3px;
    border-bottom: 2px solid var(--viz-muted);
    padding-bottom: 3px;
  }
  .fr {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    padding: 0.3em 0.5em;
    border: 1px solid var(--viz-ink);
    border-radius: 4px;
    color: var(--viz-ink);
  }
  .fr.top {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .fr em {
    grid-column: 1 / -1;
    justify-self: end;
    font-style: normal;
    font-weight: 700;
    font-size: 0.68rem;
  }
</style>
