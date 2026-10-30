<script lang="ts">
  import HeapView from "./HeapView.svelte";
  import { heapInsertFrames } from "./heapFrames";
</script>

<HeapView frames={heapInsertFrames()} />
