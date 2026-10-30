<script lang="ts">
  import Player from "../Player.svelte";
  import TreeSvg from "./TreeSvg.svelte";
  import { bstInsertFrames, type BstFrame } from "./bstInsertFrames";

  const frames = bstInsertFrames();
  const cls = (f: BstFrame) => (k: number) => (f.cur === k ? "act" : f.fresh === k ? "new" : "box");
</script>

{#snippet frame(f: BstFrame)}
  <TreeSvg kids={f.kids} present={f.present} cls={cls(f)} hotEdge={f.fresh} />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
