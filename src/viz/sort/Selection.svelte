<script lang="ts">
  import Player from "../Player.svelte";
  import SortBars from "./SortBars.svelte";
  import { selectionFrames } from "./selectionFrames";
  import type { SortFrame } from "./types";

  const frames = selectionFrames();
</script>

{#snippet frame(f: SortFrame)}
  <SortBars {f} label="선택 정렬 막대 그래프" pivotLabel="최솟값 후보" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
