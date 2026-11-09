<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { queueFrames, CAP, type QueueFrame } from "./queueFrames";

  const frames = queueFrames();
  const W = 300;
  const H = 282;
  const C = [150, 146];
  const RO = 90;
  const RI = 40;
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [C[0] + r * Math.sin(a), C[1] - r * Math.cos(a)];
  };
  function sector(i: number) {
    const a0 = i * 60 - 28;
    const a1 = i * 60 + 28;
    const [x0, y0] = pt(RO, a0);
    const [x1, y1] = pt(RO, a1);
    const [x2, y2] = pt(RI, a1);
    const [x3, y3] = pt(RI, a0);
    return `M${x0} ${y0} A${RO} ${RO} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${RI} ${RI} 0 0 0 ${x3} ${y3}Z`;
  }
</script>

{#snippet frame(f: QueueFrame)}
  <div class="ds-info">
    <b class="hot">{f.op}</b>
    {#if f.ret !== null}<b>returns {f.ret}</b>{/if}
    <span>head = <b>{f.head}</b></span>
    <span>tail = <b class="hot">{f.tail}</b></span>
    <span>size = <b>{f.size}{f.size === CAP ? " (full)" : f.size === 0 ? " (empty)" : ""}</b></span>
  </div>
  <svg class="ds-svg" viewBox="0 0 {W} {H}" style="max-width:{W * 1.3}px" role="img" aria-label="원형 큐">
    <Defs />
    {#each f.slots as v, i}
      {@const [lx, ly] = pt(104, i * 60)}
      {@const [tx, ty] = pt(65, i * 60)}
      <path class={f.hot === i ? "cmp" : v === null ? "empty" : "box"} d={sector(i)} />
      {#if v !== null}<text x={tx} y={ty + 5} text-anchor="middle">{v}</text>{/if}
      <text class="mut sm" x={lx} y={ly + 4} text-anchor="middle">{i}</text>
    {/each}
    {#each [f] as g}
{@const [hx, hy] = pt(130, f.head * 60)}
    {@const [h0x, h0y] = pt(112, f.head * 60)}
    <text x={hx} y={hy + 4} text-anchor="middle"><tspan font-weight="600">head</tspan></text>
    <path class="ah" d="M{h0x - 4} {h0y - 5} L{h0x + 4} {h0y - 5} L{h0x} {h0y + 1}z" transform="rotate({f.head * 60} {h0x} {h0y})" />
    {@const [t0x, t0y] = pt(14, f.tail * 60)}
    {@const [t1x, t1y] = pt(33, f.tail * 60)}
    <line class="ln hot" x1={t0x} y1={t0y} x2={t1x} y2={t1y} marker-end="url(#ds-ah-hot)" />
    <text class="hot sm" x={C[0]} y={C[1] + 4} text-anchor="middle">tail</text>
  {/each}
</svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
