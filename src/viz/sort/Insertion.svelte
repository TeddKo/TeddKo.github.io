<script lang="ts">
  import Player from "../Player.svelte";
  import SortBars from "./SortBars.svelte";
  import { insertionFrames } from "./insertionFrames";
  import type { SortFrame } from "./types";

  const frames = insertionFrames();
</script>

{#snippet frame(f: SortFrame)}
  <SortBars {f} label="삽입 정렬 막대 그래프" />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
