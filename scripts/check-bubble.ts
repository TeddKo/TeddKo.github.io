import assert from "node:assert/strict";
import { bubbleFrames } from "../src/viz/sort/bubbleFrames.ts";

const f = bubbleFrames();
const last = f.at(-1)!;
assert.equal(last.compares, 99);
assert.equal(last.swaps, 53);
assert.deepEqual(
  last.values,
  Array.from({ length: 16 }, (_, i) => i + 1)
);
