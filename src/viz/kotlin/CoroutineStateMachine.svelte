<script lang="ts">
  import Player from "../Player.svelte";
  import { CODE, coroutineFrames, type CoroutineFrame } from "./coroutineFrames";

  const frames = coroutineFrames();
  const SLOTS = 5;
</script>

{#snippet frame(f: CoroutineFrame)}
  <div class="wrap">
    <div class="top">
      <pre class="code" aria-label="코드">{#each CODE as l, i}<span class:on={f.line === i} class:end={i === 4 && f.line === 4}>{l}</span>{/each}</pre>
      <div class="sm">
        <h4>상태 머신 (label)</h4>
        <div class="steps">
          {#each [0, 1, 2] as n, i}
            {#if i > 0}<s>→</s>{/if}
            <span class="n" class:on={f.label === n}>{n}</span>
          {/each}
        </div>
        <div class="fld" class:chg={f.changed === "label"}>cont.label <b>= {f.label}</b></div>
        <div class="fld">cont.L$0 <b>= {f.l0 ?? "?"}</b> <small>(a)</small></div>
      </div>
    </div>
    <div class="tl">
      <h4>스레드 타임라인</h4>
      <div class="slots">
        {#each Array.from({ length: SLOTS }) as _, i}
          {@const s = f.timeline[i]}
          <span class="slot" class:run={s === "running"} class:free={s === "free"}
            >{s === "running" ? "running load()" : s === "free" ? "free" : ""}</span
          >
        {/each}
      </div>
      <small>대기 중에는 스레드가 막히지 않고 재개 사이에 비어 있습니다</small>
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .wrap {
    display: grid;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .top {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    gap: 0.5rem;
  }
  .code,
  .sm,
  .tl {
    margin: 0;
    padding: 0.4rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    font: inherit;
    color: var(--viz-ink);
    background: transparent;
    min-width: 0;
  }
  .code {
    display: grid;
    align-content: start;
    overflow: hidden;
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
  .code span.on.end {
    border-color: var(--viz-rule);
    background: transparent;
    color: var(--viz-muted);
  }
  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.72rem;
    color: var(--viz-ink);
  }
  .steps {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.4rem;
    color: var(--viz-muted);
  }
  .steps s {
    text-decoration: none;
  }
  .n {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border: 1px solid var(--viz-ink);
    border-radius: 50%;
    font-weight: 700;
  }
  .n.on {
    background: var(--viz-accent);
    border-color: var(--viz-accent);
    color: var(--background);
  }
  .fld {
    padding: 0.15em 0.3em;
    border-radius: 3px;
    color: var(--viz-muted);
  }
  .fld b {
    margin-left: 0.5em;
    color: var(--viz-ink);
    font-weight: 600;
  }
  .fld small {
    margin-left: 0.5em;
    font-size: 9.5px;
  }
  .fld.chg {
    background: var(--viz-tint);
  }
  .fld.chg b {
    color: var(--viz-accent);
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 3px;
    margin-bottom: 0.3rem;
  }
  .slot {
    display: grid;
    place-items: center;
    min-height: 2.2rem;
    padding: 0 2px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: var(--viz-tint);
    text-align: center;
    font-size: 9.5px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .slot.run {
    border-color: var(--viz-accent);
    color: var(--viz-accent);
  }
  .slot.free {
    border-color: var(--viz-rule);
    background: transparent;
    color: var(--viz-muted);
  }
  .tl small {
    font-size: 9.5px;
    color: var(--viz-muted);
  }
</style>
