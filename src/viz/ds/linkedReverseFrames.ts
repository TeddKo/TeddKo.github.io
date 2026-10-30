/** 위치 0 = 왼쪽 null, 1..n = 노드, n+1 = 오른쪽 null. */
export type ReverseFrame = {
  nxt: number[];
  head: number;
  prev: number | null;
  curr: number | null;
  next: number | null;
  hot: number | null;
  caption: string;
};

export const N = 4;

export function reverseFrames(n = N): ReverseFrame[] {
  const nxt = Array.from({ length: n + 2 }, (_, p) => p + 1);
  let head = 1;
  let prev: number | null = 0;
  let curr: number | null = 1;
  let next: number | null = null;
  let hot: number | null = null;
  const frames: ReverseFrame[] = [];
  const snap = (caption: string) =>
    frames.push({ nxt: [...nxt], head, prev, curr, next, hot, caption });

  snap("prev = null, curr = head");
  while (curr !== null && curr <= n) {
    next = nxt[curr];
    snap("next = curr.next");
    nxt[curr] = prev as number;
    hot = curr;
    snap("curr.next = prev");
    hot = null;
    prev = curr;
    curr = next;
    next = null;
    snap("prev = curr; curr = next");
  }
  head = prev as number;
  snap("curr 가 null: head = prev");
  return frames;
}
