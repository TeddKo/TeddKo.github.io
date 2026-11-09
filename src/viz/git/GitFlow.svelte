<script lang="ts">
  import Player from "../Player.svelte";
  import {
    LANES,
    LANE_NAMES,
    gitflowFrames,
    NODES,
    type GitFrame,
  } from "./gitflowFrames";

  const frames = gitflowFrames();
  const LX = 112;
  const U = 40;
  const GY = 40;
  const TOP = 34;
  const W = LX + 11 * U + 40;
  const H = TOP + 4 * GY + 36;
  const px = (x: number) => LX + x * U;
  const py = (lane: (typeof LANES)[number]) => TOP + LANES.indexOf(lane) * GY;
  const pos = (id: string) => {
    const n = NODES.find(n => n.id === id)!;
    return { x: px(n.x), y: py(n.lane) };
  };
  function path(from: string, to: string) {
    const a = pos(from);
    const b = pos(to);
    if (a.y === b.y) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }
</script>

{#snippet frame(f: GitFrame)}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Git Flow 브랜치 타임라인">
    {#each LANES as lane}
      <line x1={LX - 8} x2={W - 8} y1={py(lane)} y2={py(lane)} class="lane" />
      <text x="0" y={py(lane) + 4} class="row">{LANE_NAMES[lane]}</text>
    {/each}
    {#each f.edges as e}
      <path d={path(e.from, e.to)} class="edge" class:merge={e.merge} />
    {/each}
    {#each f.nodes as n}
      <circle
        cx={px(n.x)}
        cy={py(n.lane)}
        r="7"
        class="node"
        class:fresh={f.fresh.includes(n.id)}
      />
    {/each}
    {#each f.tags as t}
      {@const p = pos(t.node)}
      <rect x={p.x - 24} y={p.y - 30} width="48" height="16" rx="4" class="tag" />
      <text x={p.x} y={p.y - 18.5} text-anchor="middle" class="tt">{t.name}</text>
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  svg {
    display: block;
    width: 100%;
    max-width: 640px;
    height: auto;
    margin-inline: auto;
    overflow: visible;
  }
  .lane {
    stroke: var(--viz-rule);
    stroke-dasharray: 2 4;
  }
  .row {
    fill: var(--viz-muted);
    font-size: 11px;
    font-weight: 600;
  }
  .edge {
    fill: none;
    stroke: var(--viz-ink);
    stroke-width: 1.6;
  }
  .edge.merge {
    stroke: var(--viz-muted);
    stroke-dasharray: 4 3;
  }
  .node {
    fill: var(--background);
    stroke: var(--viz-ink);
    stroke-width: 1.6;
  }
  .node.fresh {
    fill: var(--viz-tint);
    stroke: var(--viz-accent);
    stroke-width: 2.4;
  }
  .tag {
    fill: var(--viz-tint);
    stroke: var(--viz-accent);
  }
  .tt {
    fill: var(--viz-accent);
    font-size: 10.5px;
    font-weight: 700;
  }
</style>
