import assert from "node:assert/strict";
import { selectionFrames } from "../src/viz/sort/selectionFrames.ts";
import { insertionFrames } from "../src/viz/sort/insertionFrames.ts";
import { quickFrames } from "../src/viz/sort/quickFrames.ts";
import { mergeFrames } from "../src/viz/sort/mergeFrames.ts";
import { heapFrames } from "../src/viz/sort/heapFrames.ts";
import { linearFrames } from "../src/viz/search/linearFrames.ts";
import { binaryFrames } from "../src/viz/search/binaryFrames.ts";
import { bfsFrames } from "../src/viz/search/bfsFrames.ts";
import { dfsFrames } from "../src/viz/search/dfsFrames.ts";

const sorted = Array.from({ length: 16 }, (_, i) => i + 1);
const cases = [
  ["selection", selectionFrames, 120, 13],
  ["insertion", insertionFrames, 64, 53],
  ["quick", quickFrames, 59, 31],
  ["merge", mergeFrames, 46, 64],
  ["heap", heapFrames, 81, 55],
] as const;
for (const [name, fn, c, s] of cases) {
  const f = fn();
  const last = f.at(-1)!;
  assert.deepEqual(last.values, sorted, name);
  assert.equal(last.compares, c, `${name} compares`);
  assert.equal(last.swaps, s, `${name} swaps`);
  assert.ok(last.roles.every(r => r === "sorted"), `${name} all sorted`);
  for (const fr of f) {
    assert.equal(fr.values.length, 16);
    assert.deepEqual([...fr.values].sort((x, y) => x - y), sorted, `${name} permutation`);
  }
}

const lin = linearFrames();
assert.equal(lin.at(-1)!.steps, 9);
assert.equal(lin.at(-1)!.found, 8);
const bin = binaryFrames();
assert.equal(bin.at(-1)!.steps, 4);
assert.equal(bin.at(-1)!.found, 10);
const bfs = bfsFrames();
assert.deepEqual(bfs.at(-1)!.order, [0, 1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(bfs.at(-1)!.list, []);
const dfs = dfsFrames();
assert.deepEqual(dfs.at(-1)!.order, [0, 1, 3, 4, 7, 5, 2, 6]);
assert.deepEqual(dfs.at(-1)!.list, []);
assert.equal(Math.max(...dfs.map(f => f.list.length)), 8);
