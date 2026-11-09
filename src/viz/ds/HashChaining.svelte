<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { chainingFrames, CAP, type ChainFrame } from "./hashChainingFrames";

  const frames = chainingFrames();
  const W = 240;
  const H = CAP * 28 + 4;
</script>

{#snippet frame(f: ChainFrame)}
  <div class="ds-info">
    {#if f.put}
      <b>put({f.put.key})</b>
      <span>index = {f.put.key} mod {CAP} = {f.put.idx}</span>
      {#if f.put.collision}<span class="blue">충돌</span>{/if}
    {:else}
      <span>index = hash mod {CAP}</span>
    {/if}
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} {H}" style="max-width:{W * 1.5}px" role="img" aria-label="체이닝 해시 테이블">
    <Defs />
    {#each f.buckets as chain, i}
      {@const y = i * 28 + 4}
      <text class="mut sm" x="2" y={y + 15}>{i}</text>
      <rect class={f.bucket === i ? "cmp" : "box"} x="14" y={y} width="28" height="22" rx="4" />
      {#each chain as k, j}
        {@const x = 58 + j * 54}
        {@const hot = f.key === k}
        <line
          class="ln"
          x1={j ? x - 16 : 42}
          x2={x - 2}
          y1={y + 11}
          y2={y + 11}
          marker-end="url(#ds-ah)"
        />
        <rect class={hot ? "act" : "box"} {x} {y} width="38" height="22" rx="4" />
        <text class={hot ? "inv" : ""} x={x + 19} y={y + 16} text-anchor="middle">{k}</text>
      {/each}
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
