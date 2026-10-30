import assert from "node:assert/strict";
import { chainingFrames } from "../src/viz/ds/hashChainingFrames.ts";
import { probingFrames } from "../src/viz/ds/hashProbingFrames.ts";
import { resizeFrames } from "../src/viz/ds/hashResizeFrames.ts";
import { heapInsertFrames, heapPollFrames } from "../src/viz/ds/heapFrames.ts";
import { stackFrames } from "../src/viz/ds/stackFrames.ts";
import { queueFrames } from "../src/viz/ds/queueFrames.ts";
import { insertFrames } from "../src/viz/ds/linkedInsertFrames.ts";
import { reverseFrames } from "../src/viz/ds/linkedReverseFrames.ts";
import { cycleFrames } from "../src/viz/ds/linkedCycleFrames.ts";
import { bstInsertFrames, buildTree } from "../src/viz/ds/bstInsertFrames.ts";
import { order, traversalFrames } from "../src/viz/ds/traversalFrames.ts";

const c = chainingFrames().at(-1)!;
assert.deepEqual(c.buckets[4], [12, 20, 28]);
assert.deepEqual(c.buckets[5], [5, 13]);
assert.deepEqual(c.buckets[7], [7]);

const p = probingFrames().at(-1)!;
assert.deepEqual(p.slots, [7, 28, null, null, 12, 5, 20, 13]);
assert.deepEqual(p.counts, [1, 1, 3, 3, 2, 6]);

const r = resizeFrames().at(-1)!;
assert.equal(r.neu!.length, 8);
assert.deepEqual(r.neu![0], [8]);
assert.deepEqual(r.neu![4], [12]);
assert.deepEqual(r.neu![3], [3]);
assert.deepEqual(r.neu![5], [5]);
assert.equal(r.size, 4);
assert.equal(r.threshold, 6);

const hi = heapInsertFrames().at(-1)!;
assert.deepEqual(hi.a, [2, 3, 4, 5, 7, 8, 6, 9]);
assert.equal(hi.compares, 3);
assert.equal(hi.swaps, 2);
const hp = heapPollFrames().at(-1)!;
assert.deepEqual(hp.a, [3, 5, 4, 9, 7, 8, 6, null]);
assert.equal(hp.label, "poll() → 2");
assert.equal(hp.swaps, 2);

const st = stackFrames();
assert.deepEqual(st.at(-1)!.items, [4]);
assert.deepEqual(st.at(-1)!.pushed, [4, 7, 2, 9]);
assert.deepEqual(st.at(-1)!.popped, [2, 9, 7]);
for (const f of st) if (f.op.startsWith("push") || f.op === "done") assert.equal(f.ret, null);

const q = queueFrames();
const ql = q.at(-1)!;
assert.deepEqual(ql.slots, ["G", "H", "C", "D", "E", "F"]);
assert.equal(ql.head, 2);
assert.equal(ql.tail, 2);
assert.equal(ql.size, 6);
for (const f of q) if (f.op.startsWith("enqueue") || f.op === "done") assert.equal(f.ret, null);
assert.ok(q.some(f => f.caption === "tail 이 0 으로 돌아감"));

const li = insertFrames().at(-1)!;
assert.deepEqual(li.next, { 10: 20, 20: 30, 40: null, 30: 40 });

const lr = reverseFrames().at(-1)!;
assert.equal(lr.head, 4);
assert.deepEqual(lr.nxt.slice(1, 5), [0, 1, 2, 3]);

const lc = cycleFrames();
const lcl = lc.at(-1)!;
assert.equal(lcl.found, true);
assert.equal(lcl.round, 6);
assert.equal(lcl.slow, 7);
assert.equal(lcl.fast, 7);

const bf = bstInsertFrames().at(-1)!;
assert.deepEqual(bf.present, [8, 3, 10, 1, 6, 14, 4]);
const kids = buildTree([8, 3, 10, 1, 6, 14, 4]);
assert.deepEqual(order("in", kids, 8), [1, 3, 4, 6, 8, 10, 14]);
assert.deepEqual(order("pre", kids, 8), [8, 3, 1, 6, 4, 10, 14]);
assert.deepEqual(order("post", kids, 8), [1, 4, 6, 3, 14, 10, 8]);
assert.deepEqual(order("level", kids, 8), [8, 3, 10, 1, 6, 14, 4]);
const tf = traversalFrames();
assert.equal(tf.length, 32);
assert.deepEqual(tf.at(-1)!.visited, [8, 3, 10, 1, 6, 14, 4]);
