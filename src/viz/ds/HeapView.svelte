<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import type { HeapFrame } from "./heapFrames";

  let { frames }: { frames: HeapFrame[] } = $props();

  const W = 300;
  const TX = [152, 77, 227, 40, 115, 190, 265, 22];
  const TY = [24, 74, 74, 124, 124, 124, 124, 174];

  function cls(f: HeapFrame, i: number) {
    if (f.cur === i) return f.kind === "swap" ? "wr" : "act";
    if (f.cmp === i) return "cmp";
    return "box";
  }
</script>

{#snippet frame(f: HeapFrame)}
  <div class="ds-info">
    <b class="hot">{f.label}</b>
    <span>비교 {f.compares} · 교환 {f.swaps}</span>
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} 258" style="max-width:{W * 1.5}px" role="img" aria-label="최소 힙 트리와 배열">
    {#each f.a as v, i}
      {#if i > 0 && v !== null}
        {@const p = (i - 1) >> 1}
        <line class="ln" x1={TX[p]} y1={TY[p]} x2={TX[i]} y2={TY[i]} />
      {/if}
    {/each}
    {#each f.a as v, i}
      {#if v !== null}
        <circle class="box" cx={TX[i]} cy={TY[i]} r="16" />
        <circle class={cls(f, i)} cx={TX[i]} cy={TY[i]} r="16" />
        <text class={cls(f, i) === "act" || cls(f, i) === "wr" ? "inv" : ""} x={TX[i]} y={TY[i] + 5} text-anchor="middle">{v}</text>
      {/if}
    {/each}
    {#each f.a as v, i}
      {@const x = 6 + i * 36}
      <rect class={v === null ? "empty" : cls(f, i)} {x} y="214" width="32" height="26" rx="4" />
      {#if v !== null}
        <text class={cls(f, i) === "act" || cls(f, i) === "wr" ? "inv" : ""} x={x + 16} y="232" text-anchor="middle">{v}</text>
      {/if}
      <text class="mut sm" x={x + 16} y="254" text-anchor="middle">{i}</text>
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
