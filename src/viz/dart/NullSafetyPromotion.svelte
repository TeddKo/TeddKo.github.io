<script lang="ts">
  import Player from "../Player.svelte";
  import { CODE, promotionFrames, type PromotionFrame } from "./promotionFrames";

  const frames = promotionFrames();
</script>

{#snippet frame(f: PromotionFrame)}
  <div class="grid">
    <pre class="code" aria-label="코드">{#each CODE as l, i}<span class:on={f.line === i}>{l}</span>{/each}</pre>
    <div class="type" class:on={f.promoted}>
      <small>name 의 타입</small>
      <strong>{f.type}</strong>
      <em>{f.note}</em>
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
    font-size: 0.72rem;
  }
  .code {
    margin: 0;
    padding: 0.4rem;
    display: grid;
    align-content: start;
    gap: 0.2rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    background: transparent;
    font: inherit;
    color: var(--viz-ink);
    overflow: hidden;
  }
  .code span {
    display: block;
    padding: 0.25em 0.4em;
    border: 1px solid transparent;
    border-radius: 3px;
    white-space: pre;
  }
  .code span.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .type {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.35rem;
    padding: 0.6rem;
    border: 1px solid var(--viz-ink);
    border-radius: 6px;
    text-align: center;
  }
  .type.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .type small {
    color: var(--viz-muted);
    font-size: 9.5px;
  }
  .type strong {
    font-size: 1.5rem;
  }
  .type em {
    font-style: normal;
    font-size: 0.7rem;
    color: var(--viz-muted);
  }
  .type.on em {
    color: var(--viz-accent);
  }
</style>
