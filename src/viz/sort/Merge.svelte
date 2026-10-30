<script lang="ts">
  import Player from "../Player.svelte";
  import SortBars from "./SortBars.svelte";
  import { mergeFrames } from "./mergeFrames";
  import type { SortFrame } from "./types";

  const frames = mergeFrames();
</script>

{#snippet frame(f: SortFrame)}
  <SortBars {f} label="병합 정렬 막대 그래프" swapLabel="쓰기" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
