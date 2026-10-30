<script lang="ts">
  import Player from "../Player.svelte";
  import { bubbleFrames, type BubbleFrame } from "./bubbleFrames";

  const frames = bubbleFrames();
  const W = 700;
  const H = 280;
  const slot = W / 16;
  const bw = 32;
  const unit = 12.5;
  const base = 250;

  function fill(f: BubbleFrame, i: number) {
    if (i >= f.sortedFrom) return "var(--viz-muted)";
    if (f.active?.includes(i))
      return f.kind === "swap" ? "var(--viz-blue)" : "var(--viz-accent)";
    return "var(--viz-rule)";
  }
</script>

{#snippet frame(f: BubbleFrame)}
  <div class="legend">
    <span><i style="background:var(--viz-accent)"></i>비교</span>
    <span><i style="background:var(--viz-blue)"></i>교환</span>
    <span><i style="background:var(--viz-muted)"></i>정렬 완료</span>
    <b>비교 {f.compares} · 교환 {f.swaps}</b>
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="버블 정렬 막대 그래프">
    {#each f.values as v, i}
      {@const h = v * unit}
      <rect
        x={i * slot + (slot - bw) / 2}
        y={base - h}
        width={bw}
        height={h}
        rx="4"
        fill={fill(f, i)}
      />
      <text x={i * slot + slot / 2} y={base + 26} text-anchor="middle">{v}</text>
    {/each}
  </svg>
{/snippet}

<Player
  {frames}
  {frame}
  caption={f => f.caption}
/>

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
    font-size: 20px;
  }
</style>
