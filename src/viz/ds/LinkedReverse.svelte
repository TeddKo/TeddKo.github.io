<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import Defs from "./Defs.svelte";
  import { reverseFrames, N, type ReverseFrame } from "./linkedReverseFrames";

  const frames = reverseFrames();
  const P = 56;
  const W = P * (N + 2);
  const BW = 38;
  const cx = (p: number) => P * p + P / 2;
  const NY = 48;
  const NH = 34;
  const labels = (f: ReverseFrame) =>
    [
      ["prev", f.prev],
      ["curr", f.curr],
      ["next", f.next],
    ] as [string, number | null][];
</script>

{#snippet frame(f: ReverseFrame)}
  <svg class="ds-svg" viewBox="0 0 {W} 140" style="max-width:{W * 1.5}px" role="img" aria-label="연결 리스트 뒤집기">
    <Defs />
    {#each f.nxt as t, p}
      {#if p >= 1 && p <= N}
        {@const dir = t > p ? 1 : -1}
        {@const hot = f.hot === p}
        <line
          class="ln"
          class:hot
          x1={cx(p) + dir * (BW / 2)}
          x2={cx(t) - dir * (BW / 2 + 2)}
          y1={NY + NH / 2}
          y2={NY + NH / 2}
          marker-end={hot ? "url(#ds-ah-hot)" : "url(#ds-ah)"}
        />
      {/if}
    {/each}
    {#each Array.from({ length: N + 2 }, (_, p) => p) as p}
      {@const edge = p === 0 || p === N + 1}
      <rect
        class={edge ? "empty" : f.curr === p ? "cmp" : "box"}
        x={cx(p) - BW / 2}
        y={NY}
        width={BW}
        height={NH}
        rx="5"
      />
      <text class={edge ? "mut sm" : ""} x={cx(p)} y={NY + 22} text-anchor="middle">{edge ? "null" : p}</text>
    {/each}
    <text x={cx(f.head)} y="30" text-anchor="middle"><tspan font-weight="600">head</tspan></text>
    <line class="ln" x1={cx(f.head)} x2={cx(f.head)} y1="35" y2={NY - 3} marker-end="url(#ds-ah)" />
    {#each labels(f) as [name, p]}
      {#if p !== null}
        {@const hot = name === "curr"}
        <line class="ln" class:hot x1={cx(p)} x2={cx(p)} y1="108" y2={NY + NH + 3} marker-end={hot ? "url(#ds-ah-hot)" : "url(#ds-ah)"} />
        <rect class="pill" class:hot x={cx(p) - 19} y="110" width="38" height="18" rx="9" />
        <text class="sm" class:hot x={cx(p)} y="123" text-anchor="middle">{name}</text>
      {/if}
    {/each}
  </svg>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
