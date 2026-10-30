<script lang="ts">
  import Player from "../Player.svelte";
  import ArrayRow from "./ArrayRow.svelte";
  import { linearFrames, TARGET, type LinearFrame } from "./linearFrames";

  const frames = linearFrames();
</script>

{#snippet frame(f: LinearFrame)}
  <ArrayRow
    target={TARGET}
    steps={f.steps}
    cur={f.at}
    found={f.found}
    dim={i => i < f.at}
    top={[{ i: f.at, text: "i" }]}
    label="선형 탐색 배열"
  />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
