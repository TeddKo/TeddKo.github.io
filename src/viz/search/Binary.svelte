<script lang="ts">
  import Player from "../Player.svelte";
  import ArrayRow from "./ArrayRow.svelte";
  import { binaryFrames, TARGET, type BinaryFrame } from "./binaryFrames";

  const frames = binaryFrames();
  const ends = (f: BinaryFrame) =>
    f.lo === f.hi
      ? [{ i: f.lo, text: "lo = hi" }]
      : [
          { i: f.lo, text: "lo" },
          { i: f.hi, text: "hi" },
        ];
</script>

{#snippet frame(f: BinaryFrame)}
  <ArrayRow
    target={TARGET}
    steps={f.steps}
    cur={f.mid}
    found={f.found}
    dim={i => i < f.lo || i > f.hi}
    top={f.lo > f.hi ? [] : ends(f)}
    bottom={f.mid >= 0 ? [{ i: f.mid, text: "mid" }] : []}
    label="이진 탐색 배열"
  />
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />
