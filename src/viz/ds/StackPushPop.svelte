<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { stackFrames, CAPACITY, type StackFrame } from "./stackFrames";

  const frames = stackFrames();
  const W = 280;
  const base = 176;
  const slotY = (k: number) => base - 28 * (k + 1) - 2;
  const topY = (n: number) => (n ? slotY(n - 1) + 12 : base - 12);
</script>

{#snippet frame(f: StackFrame)}
  <div class="ds-info">
    <b class="hot">{f.op}</b>
    {#if f.ret !== null}<b>returns {f.ret}</b>{/if}
    <span>size = {f.size} / capacity = {CAPACITY}</span>
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} 190" style="max-width:{W * 1.4}px" role="img" aria-label="스택">
    <Defs />
    <path class="ln" d="M76 20 V{base} H184 V20" />
    {#each f.items as v, k}
      {@const hot = f.hot && k === f.items.length - 1}
      <rect class={hot ? "cmp" : "box"} x="82" y={slotY(k)} width="96" height="24" rx="4" />
      <text x="130" y={slotY(k) + 17} text-anchor="middle">{v}</text>
    {/each}
    {#if f.float !== null}
      <rect class="act" x="82" y="0" width="96" height="18" rx="4" />
      <text class="inv" x="130" y="13" text-anchor="middle">{f.float}</text>
    {/if}
        <line class="ln" x1="206" y1={topY(f.items.length)} x2="186" y2={topY(f.items.length)} marker-end="url(#ds-ah)" />
    <text x="212" y={topY(f.items.length) + 4}>top{f.items.length ? "" : " (empty)"}</text>
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
