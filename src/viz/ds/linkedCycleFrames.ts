export type CycleFrame = {
  round: number;
  slow: number;
  fast: number;
  found: boolean;
  caption: string;
};

/** 1 → 2 → ... → 8 → 3 */
export const nextOf = (n: number) => (n === 8 ? 3 : n + 1);

export function cycleFrames(): CycleFrame[] {
  let slow = 1;
  let fast = 1;
  const frames: CycleFrame[] = [];
  const snap = (round: number, found: boolean, caption: string) =>
    frames.push({ round, slow, fast, found, caption });

  snap(0, false, "slow = fast = head");
  for (let r = 1; ; r++) {
    slow = nextOf(slow);
    snap(r, false, `round ${r}: slow 한 칸 이동`);
    fast = nextOf(fast);
    snap(r, false, `round ${r}: fast 첫 칸 이동`);
    fast = nextOf(fast);
    if (slow === fast) {
      snap(r, true, `slow == fast: 사이클 발견 (round ${r}, 노드 ${slow})`);
      return frames;
    }
    snap(r, false, `round ${r} 끝: slow = 노드 ${slow}, fast = 노드 ${fast}`);
  }
}
