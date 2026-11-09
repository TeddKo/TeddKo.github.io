<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { resizeFrames, CAP, LOAD, type ResizeFrame } from "./hashResizeFrames";

  const frames = resizeFrames();
  const W = 270;
  const H = CAP * 2 * 26 + 26;
  const X = [4, 150];
</script>

{#snippet col(chains: number[][], x0: number, f: ResizeFrame, isNew: boolean)}
  {#each chains as chain, i}
    {@const y = i * 26 + 22}
    <text class="mut sm" x={x0} y={y + 14}>{i}</text>
    <rect class={(isNew ? f.newBucket : f.oldBucket) === i ? "cmp" : "box"} x={x0 + 10} {y} width="24" height="20" rx="4" />
    {#each chain as k, j}
      {@const x = x0 + 48 + j * 40}
      {@const moving = f.key === k && f.newBucket !== null}
      {@const cls = isNew ? (f.key === k ? "act" : "box") : f.key === k ? (moving ? "cmp" : "act") : "box"}
      <g class={!isNew && f.moved.includes(k) && !moving ? "dim" : ""}>
        <line class="ln" x1={j ? x - 12 : x0 + 34} x2={x - 2} y1={y + 10} y2={y + 10} marker-end="url(#ds-ah)" />
        <rect class={cls} {x} {y} width="30" height="20" rx="4" />
        <text class={cls === "act" ? "inv" : ""} x={x + 15} y={y + 14} text-anchor="middle">{k}</text>
      </g>
    {/each}
  {/each}
{/snippet}

{#snippet frame(f: ResizeFrame)}
  <div class="ds-info">
    <span>개수 <b>{f.size}</b></span>
    <span>임계값 {f.neu === null ? CAP : CAP * 2} × {LOAD} = <b class={f.alert ? "blue" : ""}>{f.threshold}</b></span>
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} {H}" style="max-width:{W * 1.6}px" role="img" aria-label="해시 테이블 리사이즈">
    <Defs />
    <text class="mut sm" x={X[0] + 10} y="12">이전 테이블 (용량 {CAP})</text>
    {@render col(f.old, X[0], f, false)}
    {#if f.neu}
      <text class="mut sm" x={X[1] + 10} y="12">새 테이블 (용량 {CAP * 2})</text>
      {@render col(f.neu, X[1], f, true)}
    {/if}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
