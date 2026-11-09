<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { insertFrames, type InsertFrame } from "./linkedInsertFrames";

  const frames = insertFrames();
  const W = 330;
  const NW = 70;
  const NH = 30;
  const POS: Record<number, [number, number]> = { 10: [8, 34], 20: [106, 34], 40: [208, 34], 30: [166, 100] };
  const ptr = (k: number): [number, number] => [POS[k][0] + NW - 11, POS[k][1] + NH / 2];
  const right = (k: number): [number, number] => [POS[k][0], POS[k][1] + NH / 2];
  const bottom = (k: number): [number, number] => [POS[k][0] + NW / 2, POS[k][1] + NH];
  const top = (k: number): [number, number] => [POS[k][0] + NW / 2, POS[k][1]];

  function edge(f: InsertFrame, from: number, to: number | null): [number, number, number, number] {
    const [x1, y1] = ptr(from);
    if (to === null) return [x1, y1, from === 30 ? x1 + 30 : x1 + 24, y1];
    const same = POS[from][1] === POS[to][1];
    const [x2, y2] = same ? right(to) : POS[to][1] > POS[from][1] ? top(to) : bottom(to);
    return [x1, y1, x2 - (same ? 2 : 0), y2];
  }
  const nodes = (f: InsertFrame) => Object.keys(f.next).map(Number);
</script>

{#snippet frame(f: InsertFrame)}
  <svg class="ds-svg" viewBox="0 0 {W} 142" style="max-width:{W * 1.5}px" role="img" aria-label="연결 리스트 중간 삽입">
    <Defs />
    <text class="sm" x={POS[10][0] + 4} y="22">head</text>
    {#each nodes(f) as k}
      {@const [x1, y1, x2, y2] = edge(f, k, f.next[k])}
      {@const hot = (k === 30 && f.step === 2) || (k === 20 && f.step === 3)}
      {@const dim = k === 20 && f.step === 2}
      <line class="ln" class:hot class:dim {x1} {y1} {x2} {y2} marker-end={hot ? "url(#ds-ah-hot)" : "url(#ds-ah)"} />
      {#if f.next[k] === null}
        <text class="mut sm" x={x2 + 4} y={y2 + 4}>null</text>
      {/if}
    {/each}
    {#each nodes(f) as k}
      {@const [x, y] = POS[k]}
      {@const cls = k === 30 ? (f.step === 4 ? "box" : "act") : k === 20 && f.step === 3 ? "cmp" : "box"}
      <rect class={cls} {x} {y} width={NW} height={NH} rx="5" />
      <line class="ln" style="stroke:{cls === 'act' ? 'var(--background)' : ''}" x1={x + NW - 22} x2={x + NW - 22} y1={y} y2={y + NH} />
      <circle class="ah" cx={x + NW - 11} cy={y + NH / 2} r="2.5" style={cls === "act" ? "fill:var(--background)" : ""} />
      <text class={cls === "act" ? "inv" : ""} x={x + (NW - 22) / 2} y={y + 20} text-anchor="middle">{k}</text>
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
