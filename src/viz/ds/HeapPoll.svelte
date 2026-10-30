<script lang="ts">
  import HeapView from "./HeapView.svelte";
  import { heapPollFrames } from "./heapFrames";
</script>

<HeapView frames={heapPollFrames()} />
