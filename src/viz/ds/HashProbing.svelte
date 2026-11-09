<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import { probingFrames, CAP, type ProbeFrame } from "./hashProbingFrames";

  const frames = probingFrames();
  const W = 300;
</script>

{#snippet frame(f: ProbeFrame)}
  <div class="ds-info">
    {#if f.key !== null}
      <b>put({f.key})</b>
      <span>start = {f.key} mod {CAP} = {f.start}</span>
      <span class="hot">탐사: {f.probes.join(" → ")}</span>
    {:else}
      <span>linear probing: 차 있으면 다음 칸 (끝 다음은 0)</span>
    {/if}
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} 72" style="max-width:{W * 1.5}px" role="img" aria-label="선형 탐사 해시 테이블">
    {#each f.slots as v, i}
      {@const x = 6 + i * 36}
      {@const hot = f.stored && f.cur === i}
      <rect
        class={hot ? "act" : f.cur === i ? "cmp" : v === null ? "empty" : "box"}
        {x}
        y="14"
        width="32"
        height="30"
        rx="4"
      />
      {#if v !== null}
        <text class={hot ? "inv" : ""} x={x + 16} y="34" text-anchor="middle">{v}</text>
      {/if}
      <text class="mut sm" x={x + 16} y="62" text-anchor="middle">{i}</text>
      {#if f.cur === i && !f.stored}
        <path class="ah hot" d="M{x + 11} 2 L{x + 21} 2 L{x + 16} 10z" />
      {/if}
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
