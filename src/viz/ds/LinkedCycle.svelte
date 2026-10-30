<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { cycleFrames, nextOf, type CycleFrame } from "./linkedCycleFrames";

  const frames = cycleFrames();
  const POS: Record<number, [number, number]> = {
    1: [24, 80],
    2: [84, 80],
    3: [144, 80],
    4: [174, 28],
    5: [234, 28],
    6: [264, 80],
    7: [234, 132],
    8: [174, 132],
  };
  const OUT: Record<number, [number, number]> = {
    1: [0, -1],
    2: [0, -1],
    3: [-0.7, 0.7],
    4: [-0.5, -0.87],
    5: [0.5, -0.87],
    6: [1, 0],
    7: [0.5, 0.87],
    8: [-0.5, 0.87],
  };
  const R = 14;
  const W = 330;
  const nodes = [1, 2, 3, 4, 5, 6, 7, 8];

  function seg(a: number, b: number) {
    const [x1, y1] = POS[a];
    const [x2, y2] = POS[b];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / d;
    const uy = (y2 - y1) / d;
    return [x1 + ux * (R + 1), y1 + uy * (R + 1), x2 - ux * (R + 4), y2 - uy * (R + 4)];
  }
  function pill(n: number, order: number): [number, number] {
    const [x, y] = POS[n];
    const [ux, uy] = OUT[n];
    const d = 32 + order * 20;
    return [x + ux * d, y + uy * d];
  }
</script>

{#snippet frame(f: CycleFrame)}
  <div class="ds-info">
    <b>round {f.round}</b>
    <span>slow: 1칸 · fast: 2칸</span>
  </div>
  <svg class="ds-svg" viewBox="0 -22 {W} 212" style="max-width:{W * 1.4}px" role="img" aria-label="연결 리스트 사이클 탐지">
    <Defs />
    {#each nodes as n}
      {@const [x1, y1, x2, y2] = seg(n, nextOf(n))}
      <line class="ln" {x1} {y1} {x2} {y2} marker-end="url(#ds-ah)" />
    {/each}
    {#each nodes as n}
      <circle class={f.found && n === f.slow ? "act" : "box"} cx={POS[n][0]} cy={POS[n][1]} r={R} />
      <text class={f.found && n === f.slow ? "inv" : ""} x={POS[n][0]} y={POS[n][1] + 5} text-anchor="middle">{n}</text>
    {/each}
    {#each [["slow", f.slow, 0], ["fast", f.fast, f.slow === f.fast ? 1 : 0]] as [name, n, order]}
      {@const [px, py] = pill(n as number, order as number)}
      <rect class="pill" class:hot={name === "fast"} x={px - 19} y={py - 9} width="38" height="18" rx="9" />
      <text class="sm" class:hot={name === "fast"} x={px} y={py + 4} text-anchor="middle">{name}</text>
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
