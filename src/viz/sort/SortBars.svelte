<script lang="ts">
  import type { SortFrame } from "./types";

  let {
    f,
    label,
    swapLabel = "교환",
    pivotLabel,
  }: {
    f: SortFrame;
    label: string;
    swapLabel?: string;
    pivotLabel?: string;
  } = $props();

  const W = 700;
  const H = 284;
  const slot = W / 16;
  const bw = 32;
  const unit = 12.5;
  const base = 248;

  const FILL = {
    idle: "var(--viz-rule)",
    compare: "var(--viz-accent)",
    swap: "var(--viz-blue)",
    sorted: "var(--viz-muted)",
    pivot: "var(--viz-ink)",
  } as const;
</script>

<div class="legend">
  <span><i style="background:var(--viz-accent)"></i>비교</span>
  <span><i style="background:var(--viz-blue)"></i>{swapLabel}</span>
  {#if pivotLabel}
    <span><i style="background:var(--viz-ink)"></i>{pivotLabel}</span>
  {/if}
  <span><i style="background:var(--viz-muted)"></i>정렬 완료</span>
  <b>비교 {f.compares} · {swapLabel} {f.swaps}</b>
</div>
<svg viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  {#each f.values as v, i}
    {@const h = v * unit}
    <g opacity={f.dim[i] ? 0.4 : 1}>
      <rect
        x={i * slot + (slot - bw) / 2}
        y={base - h}
        width={bw}
        height={h}
        rx="4"
        fill={FILL[f.roles[i]]}
      />
      <text x={i * slot + slot / 2} y={base + 28} text-anchor="middle">{v}</text>
    </g>
  {/each}
</svg>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.875rem;
    align-items: center;
    color: var(--viz-muted);
    font-size: 0.75rem;
  }
  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 0.3rem;
    border-radius: 2px;
  }
  .legend b {
    margin-left: auto;
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--viz-ink);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  text {
    fill: var(--viz-muted);
    font-family: var(--font-mono);
    font-size: 26px;
  }
</style>
