import type { Component } from "svelte";

/** GIF basename (no hash, no extension) -> lazy visualization component. */
export const registry: Record<string, () => Promise<{ default: Component }>> = {
  "sort-bubble": () => import("./sort/Bubble.svelte"),
  "sort-selection": () => import("./sort/Selection.svelte"),
  "sort-insertion": () => import("./sort/Insertion.svelte"),
  "sort-quick": () => import("./sort/Quick.svelte"),
  "sort-merge": () => import("./sort/Merge.svelte"),
  "sort-heap": () => import("./sort/Heap.svelte"),
  "search-linear": () => import("./search/Linear.svelte"),
  "search-binary": () => import("./search/Binary.svelte"),
  "search-bfs": () => import("./search/Bfs.svelte"),
  "search-dfs": () => import("./search/Dfs.svelte"),
  "hash-chaining": () => import("./ds/HashChaining.svelte"),
  "hash-probing": () => import("./ds/HashProbing.svelte"),
  "hash-resize": () => import("./ds/HashResize.svelte"),
  "heap-insert": () => import("./ds/HeapInsert.svelte"),
  "heap-poll": () => import("./ds/HeapPoll.svelte"),
  "stack-push-pop": () => import("./ds/StackPushPop.svelte"),
  "queue-circular": () => import("./ds/QueueCircular.svelte"),
  "linked-list-insert": () => import("./ds/LinkedInsert.svelte"),
  "linked-list-reverse": () => import("./ds/LinkedReverse.svelte"),
  "linked-list-cycle": () => import("./ds/LinkedCycle.svelte"),
  "tree-bst-insert": () => import("./ds/TreeBstInsert.svelte"),
  "tree-traversals": () => import("./ds/TreeTraversals.svelte"),
  "process-state": () => import("./process/ProcessState.svelte"),
  "process-race-condition": () => import("./process/RaceCondition.svelte"),
  "memory-stack-frames": () => import("./memory/StackFrames.svelte"),
  "vm-lru-replacement": () => import("./vm/LruReplacement.svelte"),
  "java-virtual-threads-mount": () =>
    import("./java/VirtualThreadsMount.svelte"),
  "kotlin-coroutines-state-machine": () =>
    import("./kotlin/CoroutineStateMachine.svelte"),
  "kotlin-flow-operators": () => import("./kotlin/FlowOperators.svelte"),
  "kotlin-flow-stateflow-conflation": () =>
    import("./kotlin/StateFlowConflation.svelte"),
  "dart-null-safety-promotion": () =>
    import("./dart/NullSafetyPromotion.svelte"),
  "effective-kotlin-4-sequence-vs-iterable": () =>
    import("./kotlin/SequenceVsIterable.svelte"),
  "cqrs-event-stream-projection": () =>
    import("./server/EventProjection.svelte"),
  "spring-webflux-event-loop": () => import("./server/EventLoop.svelte"),
};
