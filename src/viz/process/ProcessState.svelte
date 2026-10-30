<script lang="ts">
  import Player from "../Player.svelte";
  import { stateFrames, type Edge, type PState, type StateFrame } from "./stateFrames";

  const frames = stateFrames();
  const W = 326;
  const H = 150;
  const box = 74;
  const bh = 28;
  const nodes: Record<PState, [number, number]> = {
    new: [0, 22],
    ready: [84, 22],
    running: [168, 22],
    terminated: [252, 22],
    waiting: [125, 110],
  };
  const edges: Record<Edge, string> = {
    admitted: "M74 36 H84",
    dispatch: "M158 31 H168",
    interrupt: "M168 41 H158",
    exit: "M242 36 H252",
    ioWait: "M205 50 V124 H199",
    ioDone: "M125 124 H121 V50",
  };
  const labels: [Edge, string, number, number, string][] = [
    ["admitted", "admitted", 79, 14, "middle"],
    ["dispatch", "dispatch", 163, 14, "middle"],
    ["interrupt", "interrupt", 163, 62, "middle"],
    ["exit", "exit", 247, 14, "middle"],
    ["ioWait", "I/O wait", 211, 88, "start"],
    ["ioDone", "I/O done", 115, 88, "end"],
  ];
</script>

{#snippet frame(f: StateFrame)}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="프로세스 상태 전이 다이어그램">
    <defs>
      <marker id="ps-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" class="head" />
      </marker>
      <marker id="ps-h" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" class="head on" />
      </marker>
    </defs>
    {#each Object.entries(edges) as [k, d]}
      {@const on = f.via === k}
      <path {d} class="edge" class:on marker-end="url(#{on ? 'ps-h' : 'ps-a'})" />
    {/each}
    {#each labels as [k, t, x, y, anchor]}
      <text {x} {y} text-anchor={anchor} class="lbl" class:on={f.via === k}>{t}</text>
    {/each}
    {#each Object.entries(nodes) as [name, [x, y]]}
      <rect {x} {y} width={box} height={bh} rx="6" class="node" class:on={f.state === name} />
      <text x={x + box / 2} y={y + 18} text-anchor="middle" class="name" class:on={f.state === name}>{name}</text>
    {/each}
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
  }
  .edge {
    fill: none;
    stroke: var(--viz-muted);
    stroke-width: 1.2;
  }
  .edge.on {
    stroke: var(--viz-accent);
    stroke-width: 2;
  }
  .head {
    fill: var(--viz-muted);
  }
  .head.on {
    fill: var(--viz-accent);
  }
  .node {
    fill: var(--background);
    stroke: var(--viz-ink);
    stroke-width: 1.2;
  }
  .node.on {
    fill: var(--viz-tint);
    stroke: var(--viz-accent);
    stroke-width: 2;
  }
  text {
    font-family: var(--font-mono);
  }
  .name {
    fill: var(--viz-ink);
    font-size: 12px;
    font-weight: 600;
  }
  .name.on {
    fill: var(--viz-accent);
  }
  .lbl {
    fill: var(--viz-muted);
    font-size: 12px;
  }
  .lbl.on {
    fill: var(--viz-accent);
  }
</style>
