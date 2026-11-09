<script lang="ts">
  import Player from "../Player.svelte";
  import { flowOperatorFrames, type FlowOpFrame, type Lane } from "./flowOperatorFrames";

  const frames = flowOperatorFrames();
  const W = 300;
  const H = 178;
  const x = (n: number) => 22 + (n - 1) * 45;
  const lanes: [Lane, string, number][] = [
    ["source", "flowOf(1..6)", 22],
    ["filter", "filter { even }", 76],
    ["map", "map { it * 10 }", 130],
  ];
  const posOf = (lane: Lane, v: number) => (lane === "map" ? v / 10 : v);
</script>

{#snippet marble(cx: number, cy: number, v: number, on: boolean, dim = false)}
  {#if on}<circle {cx} {cy} r="15" class="ring" />{/if}
  <circle {cx} {cy} r="11" class="m" class:on class:dim />
  <text x={cx} y={cy + 4} text-anchor="middle" class="mt" class:on class:dim>{v}</text>
{/snippet}

{#snippet frame(f: FlowOpFrame)}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Flow 연산자 마블 다이어그램">
    {#each lanes as [lane, label, y]}
      <text x="0" y={y} class="lbl">{label}</text>
      <line x1="0" x2="292" y1={y + 22} y2={y + 22} class="axis" />
      <path d="M292 {y + 22} l-6 -3 v6 z" class="head" />
    {/each}
    {#each f.source as v}
      {@render marble(x(v), 44, v, f.active.lane === "source" && f.active.v === v)}
    {/each}
    {#each f.filter as e}
      {@render marble(x(e.v), 98, e.v, f.active.lane === "filter" && f.active.v === e.v, !e.pass)}
    {/each}
    {#each f.map as v}
      {@render marble(x(posOf("map", v)), 152, v, f.active.lane === "map" && f.active.v === v)}
    {/each}
    <text x="0" y={H - 2} class="col">collect: <tspan class="acc">{f.collected.join(", ") || "-"}</tspan></text>
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  svg {
    display: block;
    width: 100%;
    max-width: 560px;
    height: auto;
    margin-inline: auto;
    font-family: var(--font-mono);
  }
  .lbl {
    fill: var(--viz-ink);
    font-size: 11px;
  }
  .axis {
    stroke: var(--viz-muted);
    stroke-width: 1;
  }
  .head {
    fill: var(--viz-muted);
  }
  .m {
    fill: var(--background);
    stroke: var(--viz-ink);
    stroke-width: 1.2;
  }
  .m.dim {
    fill: var(--viz-tint);
    stroke: var(--viz-muted);
    stroke-dasharray: 2.5 2.5;
    opacity: 0.75;
  }
  .m.on {
    fill: var(--viz-accent);
    stroke: var(--viz-accent);
    opacity: 1;
  }
  .m.dim.on {
    fill: var(--viz-tint);
    stroke: var(--viz-accent);
    stroke-width: 1.6;
  }
  .ring {
    fill: none;
    stroke: var(--viz-accent);
    stroke-width: 1;
  }
  .mt {
    fill: var(--viz-ink);
    font-size: 11px;
    font-weight: 700;
  }
  .mt.dim {
    fill: var(--viz-muted);
    font-weight: 400;
  }
  .mt.on {
    fill: var(--background);
  }
  .mt.dim.on {
    fill: var(--viz-muted);
  }
  .col {
    fill: var(--viz-ink);
    font-size: 11px;
  }
  .acc {
    fill: var(--viz-accent);
    font-weight: 700;
  }
</style>
