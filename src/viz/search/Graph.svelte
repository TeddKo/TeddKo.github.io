<script lang="ts">
  import { GRAPH, type GraphFrame } from "./graphData";

  let {
    f,
    listTitle,
    label,
  }: { f: GraphFrame; listTitle: string; label: string } = $props();

  const POS = [
    [168, 28],
    [77, 88],
    [259, 88],
    [25, 168],
    [142, 168],
    [259, 168],
    [376, 168],
    [202, 228],
  ];
  const edges = GRAPH.flatMap((nb, a) =>
    nb.filter(b => a < b).map(b => [a, b])
  );
  const R = 20;
</script>

<svg viewBox="0 0 400 256" role="img" aria-label={label}>
  {#each edges as [a, b]}
    <line
      x1={POS[a][0]}
      y1={POS[a][1]}
      x2={POS[b][0]}
      y2={POS[b][1]}
      class="edge"
    />
  {/each}
  {#each POS as [x, y], n}
    {@const seen = f.order.includes(n)}
    {@const queued = !seen && f.list.includes(n)}
    <circle
      cx={x}
      cy={y}
      r={R}
      fill={f.cur === n
        ? "var(--viz-accent)"
        : seen
          ? "var(--viz-muted)"
          : "var(--background)"}
      stroke={f.cur === n
        ? "var(--viz-accent)"
        : queued
          ? "var(--viz-blue)"
          : seen
            ? "var(--viz-muted)"
            : "var(--viz-rule)"}
      stroke-width={queued ? 3 : 2}
    />
    <text {x} y={y + 7} text-anchor="middle" class:on={seen || f.cur === n}>{n}</text>
  {/each}
</svg>
<div class="rows">
  <div class="row">
    <span class="name">{listTitle}</span>
    <span class="chips">
      {#each f.list as n}<i class="box">{n}</i>{:else}<em>비어 있음</em>{/each}
    </span>
  </div>
  <div class="row">
    <span class="name">방문 순서</span>
    <span class="chips">
      {#each f.order as n}<i class="dot">{n}</i>{:else}<em>아직 없음</em>{/each}
    </span>
  </div>
</div>

<style>
  svg {
    display: block;
    width: 100%;
    max-width: 440px;
    height: auto;
    margin-inline: auto;
  }
  .edge {
    stroke: var(--viz-rule);
    stroke-width: 2;
  }
  text {
    font-family: var(--font-mono);
    font-size: 20px;
    fill: var(--viz-ink);
  }
  text.on {
    fill: var(--background);
  }
  .rows {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .row {
    display: grid;
    gap: 0.25rem;
  }
  .name {
    font-size: 0.75rem;
    color: var(--viz-muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-height: 1.75rem;
    align-items: center;
  }
  .chips i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.75rem;
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }
  .box {
    border: 1.5px solid var(--viz-ink);
    border-radius: 5px;
  }
  .dot {
    border-radius: 50%;
    background: var(--viz-muted);
    color: var(--background);
  }
  em {
    font-size: 0.75rem;
    font-style: normal;
    color: var(--viz-muted);
  }
</style>
