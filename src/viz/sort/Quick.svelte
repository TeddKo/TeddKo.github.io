<script lang="ts">
  import Player from "../Player.svelte";
  import SortBars from "./SortBars.svelte";
  import { quickFrames } from "./quickFrames";
  import type { SortFrame } from "./types";

  const frames = quickFrames();
</script>

{#snippet frame(f: SortFrame)}
  <SortBars {f} label="퀵 정렬 막대 그래프" pivotLabel="피벗" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
