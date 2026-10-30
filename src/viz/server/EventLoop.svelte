<script lang="ts">
  import Player from "../Player.svelte";
  import { BLOCKS, END, WAITS, loopFrames, type LoopFrame } from "./eventLoopFrames";

  const frames = loopFrames();
  const U = 40;
  const W = END * U + 20;
  const H = 214;
  const rowY = [14, 66, 118, 170];
  const names = ["이벤트 루프", "요청 A I/O", "요청 B I/O", "요청 C I/O"];
  const idx = { A: 1, B: 2, C: 3 } as const;
</script>

{#snippet frame(f: LoopFrame)}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="이벤트 루프 타임라인">
    {#each Array.from({ length: END + 1 }) as _, i}
      <line x1={i * U} x2={i * U} y1="6" y2={H - 6} class="grid" />
    {/each}
    {#each names as n, i}
      <text x="0" y={rowY[i] - 3} class="row">{n}</text>
    {/each}
    <rect x="0" y={rowY[0]} width={END * U} height="34" class="lane" />
    {#each BLOCKS as b}
      {#if f.t >= b.start + 1}
        <rect x={b.start * U} y={rowY[0]} width={U - 2} height="34" rx="4" class="blk" />
        <text x={b.start * U + (U - 2) / 2} y={rowY[0] + 21} text-anchor="middle" class="bt"
          >{b.who} {b.kind === "send" ? "전송" : "응답"}</text
        >
      {/if}
    {/each}
    {#if f.t > Math.floor(f.t) && !(f.t >= 3 && f.t < 4)}
      {@const s = Math.floor(f.t)}
      <rect x={s * U} y={rowY[0]} width={(f.t - s) * U} height="34" rx="4" class="cur" />
    {/if}
    {#if f.t > 3}
      <text x={3 * U + (U - 2) / 2} y={rowY[0] + 21} text-anchor="middle" class="idle">유휴</text>
    {/if}
    {#each WAITS as w}
      {@const end = Math.min(f.t, w.end)}
      {#if end > w.start}
        <rect x={w.start * U} y={rowY[idx[w.who]]} width={(end - w.start) * U} height="34" rx="4" class="wait" />
        {#if f.t >= w.end}
          <text x={w.start * U + ((w.end - w.start) * U) / 2} y={rowY[idx[w.who]] + 15} text-anchor="middle" class="wt">DB 응답 대기</text>
          <text x={w.start * U + ((w.end - w.start) * U) / 2} y={rowY[idx[w.who]] + 27} text-anchor="middle" class="wt">스레드 점유 없음</text>
        {/if}
      {/if}
    {/each}
    <line x1={f.t * U} x2={f.t * U} y1="6" y2={H - 6} class="now" />
    <path d="M{f.t * U - 4} 2 h8 l-4 7 z" class="nowh" />
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  svg {
    display: block;
    width: 100%;
    max-width: 640px;
    height: auto;
    margin-inline: auto;
    overflow: visible;
  }
  .grid {
    stroke: var(--viz-rule);
    stroke-dasharray: 1 3;
  }
  .row {
    fill: var(--viz-ink);
    font-size: 11px;
    font-weight: 600;
  }
  .lane {
    fill: none;
    stroke: var(--viz-rule);
    stroke-dasharray: 3 3;
  }
  .blk {
    fill: var(--background);
    stroke: var(--viz-ink);
    stroke-width: 1.2;
  }
  .cur {
    fill: var(--viz-tint);
    stroke: var(--viz-accent);
  }
  .bt {
    fill: var(--viz-ink);
    font-size: 11px;
    font-weight: 700;
  }
  .idle {
    fill: var(--viz-muted);
    font-size: 11px;
  }
  .wait {
    fill: none;
    stroke: var(--viz-muted);
    stroke-dasharray: 4 3;
  }
  .wt {
    fill: var(--viz-muted);
    font-size: 11px;
  }
  .now {
    stroke: var(--viz-accent);
    stroke-width: 1.6;
  }
  .nowh {
    fill: var(--viz-accent);
  }
</style>
