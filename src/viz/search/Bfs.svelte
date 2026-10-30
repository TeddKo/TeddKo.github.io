<script lang="ts">
  import Player from "../Player.svelte";
  import Graph from "./Graph.svelte";
  import { bfsFrames } from "./bfsFrames";
  import type { GraphFrame } from "./graphData";

  const frames = bfsFrames();
</script>

{#snippet frame(f: GraphFrame)}
  <Graph {f} listTitle="큐 (앞이 왼쪽)" label="BFS 그래프" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
