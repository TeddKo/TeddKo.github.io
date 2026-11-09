export type Kids = Record<number, [number | null, number | null]>;

export type BstFrame = {
  present: number[];
  kids: Kids;
  cur: number | null;
  fresh: number | null;
  caption: string;
};

export const KEYS = [8, 3, 10, 1, 6, 14, 4];

export function buildTree(keys: number[]): Kids {
  const kids: Kids = {};
  let root: number | null = null;
  for (const k of keys) {
    kids[k] = [null, null];
    if (root === null) {
      root = k;
      continue;
    }
    let n = root;
    for (;;) {
      const s = k < n ? 0 : 1;
      const c = kids[n][s];
      if (c === null) {
        kids[n][s] = k;
        break;
      }
      n = c;
    }
  }
  return kids;
}

export function bstInsertFrames(keys = KEYS): BstFrame[] {
  const kids: Kids = {};
  const present: number[] = [];
  let root: number | null = null;
  const frames: BstFrame[] = [];
  const snap = (cur: number | null, fresh: number | null, caption: string) =>
    frames.push({
      present: [...present],
      kids: Object.fromEntries(
        Object.entries(kids).map(([k, v]) => [k, [...v]])
      ) as Kids,
      cur,
      fresh,
      caption,
    });

  for (const k of keys) {
    if (root === null) {
      root = k;
      kids[k] = [null, null];
      present.push(k);
      snap(null, k, `insert(${k}): 빈 트리, 루트 = ${k}`);
      continue;
    }
    snap(root, null, `insert(${k}): 루트 ${root} 부터 비교 시작`);
    let n = root;
    for (;;) {
      const s = k < n ? 0 : 1;
      const c = kids[n][s];
      const dir = s === 0 ? "왼쪽" : "오른쪽";
      if (c === null) {
        snap(
          n,
          null,
          `비교 ${k} ${s === 0 ? "<" : ">"} ${n}: ${dir}으로, 빈 자리`
        );
        kids[k] = [null, null];
        kids[n][s] = k;
        present.push(k);
        snap(null, k, `빈 자리에 리프 ${k} 부착`);
        break;
      }
      snap(n, null, `비교 ${k} ${s === 0 ? "<" : ">"} ${n}: ${dir}으로 이동`);
      n = c;
    }
  }
  snap(null, null, "모든 노드에서 left < node < right 성립");
  return frames;
}
