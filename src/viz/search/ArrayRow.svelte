<script lang="ts">
  import { ARR } from "./arrayData";

  type Mark = { i: number; text: string };
  let {
    target,
    steps,
    cur = -1,
    found = -1,
    dim,
    top = [],
    bottom = [],
    label,
  }: {
    target: number;
    steps: number;
    cur?: number;
    found?: number;
    dim: (i: number) => boolean;
    top?: Mark[];
    bottom?: Mark[];
    label: string;
  } = $props();

  const W = 700;
  const H = 196;
  const slot = W / 16;
  const cw = 38;
  const cy = 58;
  const ch = 42;
  const cx = (i: number) => i * slot + slot / 2;
</script>

<div class="head">
  <b class="target">target = {target}</b>
  <b>비교 {steps}</b>
</div>
<svg viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  {#each ARR as v, i}
    <g opacity={dim(i) ? 0.4 : 1}>
      <rect
        x={cx(i) - cw / 2}
        y={cy}
        width={cw}
        height={ch}
        rx="6"
        fill={found === i ? "var(--viz-accent)" : "none"}
        stroke={cur === i || found === i ? "var(--viz-accent)" : "var(--viz-rule)"}
        stroke-width={cur === i || found === i ? 3 : 1.5}
      />
      <text
        class="val"
        class:on={found === i}
        x={cx(i)}
        y={cy + 29}
        text-anchor="middle">{v}</text
      >
      <text class="idx" x={cx(i)} y={cy + ch + 28} text-anchor="middle">{i}</text>
    </g>
  {/each}
  {#each top as m}
    <path d="M{cx(m.i)} 36 v12 m-6 -6 l6 6 l6 -6" class="ptr" />
    <text class="tag" x={cx(m.i)} y="26" text-anchor="middle">{m.text}</text>
  {/each}
  {#each bottom as m}
    <path d="M{cx(m.i)} 168 v-12 m-6 6 l6 -6 l6 6" class="ptr acc" />
    <text class="tag acc" x={cx(m.i)} y="192" text-anchor="middle">{m.text}</text>
  {/each}
</svg>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .head b {
    font-weight: 500;
    color: var(--viz-ink);
  }
  .head .target {
    color: var(--viz-accent);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  text {
    font-family: var(--font-mono);
    font-size: 26px;
    fill: var(--viz-ink);
  }
  text.idx {
    fill: var(--viz-muted);
  }
  text.on {
    fill: var(--background);
  }
  text.tag {
    font-weight: 700;
  }
  text.acc {
    fill: var(--viz-accent);
  }
  .ptr {
    fill: none;
    stroke: var(--viz-ink);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ptr.acc {
    stroke: var(--viz-accent);
  }
</style>
