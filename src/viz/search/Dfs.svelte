<script lang="ts">
  import Player from "../Player.svelte";
  import Graph from "./Graph.svelte";
  import { dfsFrames } from "./dfsFrames";
  import type { GraphFrame } from "./graphData";

  const frames = dfsFrames();
</script>

{#snippet frame(f: GraphFrame)}
  <Graph {f} listTitle="콜 스택 (위가 오른쪽)" label="DFS 그래프" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
