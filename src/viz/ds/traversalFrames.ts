import { buildTree, KEYS, type Kids } from "./bstInsertFrames.ts";

export type TravFrame = {
  kind: "pre" | "in" | "post" | "level";
  title: string;
  visited: number[];
  cur: number | null;
  caption: string;
};

const KINDS = [
  { kind: "pre", title: "전위 순회 (pre-order)", rule: "루트, 왼쪽, 오른쪽" },
  { kind: "in", title: "중위 순회 (in-order)", rule: "왼쪽, 루트, 오른쪽" },
  { kind: "post", title: "후위 순회 (post-order)", rule: "왼쪽, 오른쪽, 루트" },
  {
    kind: "level",
    title: "레벨 순회 (level-order)",
    rule: "위층부터, 왼쪽에서 오른쪽",
  },
] as const;

export function order(
  kind: TravFrame["kind"],
  kids: Kids,
  root: number
): number[] {
  const out: number[] = [];
  const dfs = (n: number | null) => {
    if (n === null) return;
    if (kind === "pre") out.push(n);
    dfs(kids[n][0]);
    if (kind === "in") out.push(n);
    dfs(kids[n][1]);
    if (kind === "post") out.push(n);
  };
  if (kind === "level") {
    const q = [root];
    for (let i = 0; i < q.length; i++) {
      for (const c of kids[q[i]]) if (c !== null) q.push(c);
    }
    return q;
  }
  dfs(root);
  return out;
}

export function traversalFrames(keys = KEYS): TravFrame[] {
  const kids = buildTree(keys);
  const frames: TravFrame[] = [];
  for (const { kind, title, rule } of KINDS) {
    const ord = order(kind, kids, keys[0]);
    frames.push({
      kind,
      title,
      visited: [],
      cur: null,
      caption: `${title}: ${rule}`,
    });
    ord.forEach((k, i) =>
      frames.push({
        kind,
        title,
        visited: ord.slice(0, i + 1),
        cur: k,
        caption: `${title}: ${i + 1}번째 방문 = ${k}`,
      })
    );
  }
  return frames;
}
