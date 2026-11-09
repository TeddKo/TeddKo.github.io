import assert from "node:assert/strict";
import { gitflowFrames } from "../src/viz/git/gitflowFrames.ts";

// git flow: 12 frames, tags v1.0 / v1.0.1 on main, develop receives both merges
{
  const f = gitflowFrames();
  const last = f.at(-1)!;
  assert.equal(f.length, 12);
  assert.ok(f.every(x => x.caption.length > 0));

  const lane = (id: string) => last.nodes.find(n => n.id === id)!.lane;
  assert.deepEqual(
    last.tags.map(t => [t.name, lane(t.node)]),
    [
      ["v1.0", "main"],
      ["v1.0.1", "main"],
    ]
  );

  const mergesIntoDevelop = last.edges.filter(
    e => e.merge && lane(e.to) === "develop"
  );
  assert.deepEqual(
    mergesIntoDevelop.map(e => lane(e.from)),
    ["feature", "release", "hotfix"]
  );

  const mergesIntoMain = last.edges.filter(
    e => e.merge && lane(e.to) === "main"
  );
  assert.deepEqual(
    mergesIntoMain.map(e => lane(e.from)),
    ["release", "hotfix"]
  );

  const ids = new Set(last.nodes.map(n => n.id));
  assert.ok(last.edges.every(e => ids.has(e.from) && ids.has(e.to)));
  assert.ok(f.every((x, i) => i === 0 || x.nodes.length >= f[i - 1].nodes.length));
}
