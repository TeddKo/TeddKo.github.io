<script lang="ts">
  import "./ds.css";
  import { POS, W, H } from "./treeLayout";
  import type { Kids } from "./bstInsertFrames";

  let {
    kids,
    present,
    cls,
    badge,
    hotEdge = null,
  }: {
    kids: Kids;
    present: number[];
    cls: (k: number) => string;
    badge?: (k: number) => number | undefined;
    hotEdge?: number | null;
  } = $props();
</script>

<svg class="ds-svg" viewBox="0 0 {W} {H}" style="max-width:{W * 1.4}px" role="img" aria-label="이진 탐색 트리">
  {#each present as p}
    {#each kids[p] as c}
      {#if c !== null && present.includes(c)}
        <line class="ln" class:hot={hotEdge === c} x1={POS[p][0]} y1={POS[p][1]} x2={POS[c][0]} y2={POS[c][1]} />
      {/if}
    {/each}
  {/each}
  {#each present as k}
    {@const c = cls(k)}
    <circle class="box" cx={POS[k][0]} cy={POS[k][1]} r="16" />
    <circle class={c} cx={POS[k][0]} cy={POS[k][1]} r="16" />
    <text class={c === "act" ? "inv" : ""} x={POS[k][0]} y={POS[k][1] + 5} text-anchor="middle">{k}</text>
    {#if badge?.(k) !== undefined}
      <circle style="fill:var(--viz-ink)" cx={POS[k][0] + 13} cy={POS[k][1] - 13} r="9" />
      <text class="inv sm" x={POS[k][0] + 13} y={POS[k][1] - 9.5} text-anchor="middle">{badge(k)}</text>
    {/if}
  {/each}
</svg>
