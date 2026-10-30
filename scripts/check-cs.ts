import assert from "node:assert/strict";
import { stateFrames } from "../src/viz/process/stateFrames.ts";
import { raceFrames } from "../src/viz/process/raceFrames.ts";
import { stackFrames } from "../src/viz/memory/stackFrames.ts";
import { lruFrames, fifoFaults, optFaults } from "../src/viz/vm/lruFrames.ts";
import { mountFrames } from "../src/viz/java/mountFrames.ts";
import { coroutineFrames } from "../src/viz/kotlin/coroutineFrames.ts";
import { flowOperatorFrames } from "../src/viz/kotlin/flowOperatorFrames.ts";
import { stateflowFrames } from "../src/viz/kotlin/stateflowFrames.ts";
import { promotionFrames } from "../src/viz/dart/promotionFrames.ts";
import { seqFrames } from "../src/viz/kotlin/seqFrames.ts";
import { projectionFrames } from "../src/viz/server/projectionFrames.ts";
import { loopFrames, BLOCKS, WAITS } from "../src/viz/server/eventLoopFrames.ts";

// process-state: new -> ready -> running -> ready -> running -> waiting -> ready -> running -> terminated
assert.deepEqual(
  stateFrames().map(f => f.state),
  ["new", "ready", "running", "ready", "running", "waiting", "ready", "running", "terminated"]
);

// race: lost update, counter 1 instead of 2
{
  const r = raceFrames();
  const last = r.at(-1)!;
  assert.equal(last.counter, 1);
  assert.equal(last.reg.A, 1);
  assert.equal(last.reg.B, 1);
  assert.equal(last.result, true);
  assert.equal(r.length, 8);
}

// stack: ends with main r = 6, depth peaks at 4 frames
{
  const s = stackFrames();
  assert.equal(s.length, 11);
  assert.equal(Math.max(...s.map(f => f.stack.length)), 4);
  assert.deepEqual(s.at(-1)!.stack, [{ name: "main", r: 6 }]);
}

// LRU 12 / FIFO 15 / OPT 9
{
  const l = lruFrames();
  assert.equal(l.length, 22);
  assert.equal(l.at(-1)!.faults, 12);
  assert.equal(l.at(-1)!.result.filter(x => x === "F").length, 12);
  assert.equal(fifoFaults(), 15);
  assert.equal(optFaults(), 9);
  assert.equal(fifoFaults([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], 3), 9);
  assert.equal(fifoFaults([1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], 4), 10);
}

// virtual thread mount: V1 ends on carrier-2
{
  const m = mountFrames();
  assert.equal(m.length, 6);
  assert.equal(m.at(-1)!.c1, null);
  assert.equal(m.at(-1)!.c2, "V1");
}

// coroutine state machine: label 0 -> 1 -> 2, only L$0 saved
{
  const c = coroutineFrames();
  assert.deepEqual([...new Set(c.map(f => f.label))], [0, 1, 2]);
  assert.equal(c[3].caption, 'cont.resume("A") -> invokeSuspend, a = "A"');
  assert.equal(c[6].caption, 'cont.resume("B") -> invokeSuspend, b = "B" (지역 변수)');
  assert.equal(c.at(-1)!.timeline.length, 5);
}

// flow operators: [20, 40, 60], filtered values are dropped
{
  const f = flowOperatorFrames();
  const last = f.at(-1)!;
  assert.equal(f.length, 15);
  assert.deepEqual(last.collected, [20, 40, 60]);
  assert.deepEqual(last.filter.filter(x => !x.pass).map(x => x.v), [1, 3, 5]);
}

// stateflow conflation: collector sees 0, 1, 3, 4; 2 skipped; repeated 3 ignored
{
  const s = stateflowFrames();
  const last = s.at(-1)!;
  assert.deepEqual(last.received, [0, 1, 3, 4]);
  assert.deepEqual(last.skipped, [2]);
  assert.deepEqual(last.sets.filter(x => x.ignored), [{ v: 3, ignored: true }]);
  assert.equal(s.length, 7);
}

// dart: promoted only inside the if
{
  const p = promotionFrames();
  assert.deepEqual(p.map(f => f.type), ["String?", "String?", "String", "String?"]);
}

// Iterable 12 ops vs Sequence 6, elements 4..6 untouched
{
  const s = seqFrames();
  const last = s.at(-1)!;
  assert.equal(last.iter.ops, 12);
  assert.equal(last.seq.ops, 6);
  assert.equal(last.seq.untouched, true);
  assert.deepEqual(last.seq.map, [2, 4, 6, null, null, null]);
}

// event projection: 0, 100, 70, 120, 100, replay gives same 100
{
  const p = projectionFrames();
  const bal = (a: number, b: number) => p.slice(a, b).map(f => f.balance);
  assert.deepEqual(bal(0, 6), [0, 0, 100, 70, 120, 100]);
  assert.equal(p[7].balance, null);
  assert.deepEqual(bal(9, 14), [0, 100, 70, 120, 100]);
  assert.equal(p.at(-1)!.balance, 100);
}

// event loop: one thread, three overlapping requests
{
  const f = loopFrames();
  assert.equal(f.at(-1)!.t, 7);
  assert.equal(BLOCKS.length, 6);
  assert.deepEqual(WAITS.map(w => w.end - w.start), [3, 3, 3]);
}

