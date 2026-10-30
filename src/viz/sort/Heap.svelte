<script lang="ts">
  import Player from "../Player.svelte";
  import SortBars from "./SortBars.svelte";
  import { heapFrames } from "./heapFrames";
  import type { SortFrame } from "./types";

  const frames = heapFrames();
</script>

{#snippet frame(f: SortFrame)}
  <SortBars {f} label="힙 정렬 막대 그래프" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
