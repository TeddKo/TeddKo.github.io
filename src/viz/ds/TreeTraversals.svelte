<script lang="ts">
  import "./ds.css";
  import Player from "../Player.svelte";
  import TreeSvg from "./TreeSvg.svelte";
  import { buildTree, KEYS } from "./bstInsertFrames";
  import { traversalFrames, type TravFrame } from "./traversalFrames";

  const frames = traversalFrames();
  const kids = buildTree(KEYS);
  const present = KEYS;
  const cls = (f: TravFrame) => (k: number) =>
    f.cur === k ? "act" : f.visited.includes(k) ? "seen" : "box";
  const badge = (f: TravFrame) => (k: number) => {
    const i = f.visited.indexOf(k);
    return i < 0 ? undefined : i + 1;
  };
</script>

{#snippet frame(f: TravFrame)}
  <div class="ds-info"><b>{f.title}</b></div>
  <TreeSvg {kids} {present} cls={cls(f)} badge={badge(f)} />
  <div class="ds-chips">
    <span style="border:0;min-width:0;padding:0;color:var(--viz-muted)">visited:</span>
    {#each f.visited as v, i}
      <span class:on={i === f.visited.length - 1}>{v}</span>
    {/each}
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
