export const REFS = [
  7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1,
];
export const FRAMES = 3;

export type LruFrame = {
  /** 현재 참조 위치 (-1 = 시작 전, REFS.length = 완료). */
  t: number;
  /** 시간 0..t 각 시점의 프레임 3 칸 (빈 칸 = null). */
  grid: (number | null)[][];
  /** 시간 0..t 의 결과. */
  result: ("F" | "H")[];
  /** 이번 참조로 새로 들어온 칸 / 히트한 칸. */
  slot: number;
  hit: boolean;
  /** 최근 사용 오래된 순 → 최신. 첫 원소가 교체 후보. */
  recency: number[];
  faults: number;
  caption: string;
};

export function lruFrames(): LruFrame[] {
  const slots: (number | null)[] = [null, null, null];
  const recency: number[] = [];
  const grid: (number | null)[][] = [];
  const result: ("F" | "H")[] = [];
  let faults = 0;
  const frames: LruFrame[] = [];
  const push = (t: number, slot: number, hit: boolean, caption: string) =>
    frames.push({
      t,
      grid: grid.map(c => [...c]),
      result: [...result],
      slot,
      hit,
      recency: [...recency],
      faults,
      caption,
    });

  push(
    -1,
    -1,
    false,
    "참조열 20 개를 프레임 3 개에 차례로 넣습니다. 처음에는 모두 비어 있습니다"
  );
  REFS.forEach((p, t) => {
    const at = slots.indexOf(p);
    let slot: number;
    let caption: string;
    if (at >= 0) {
      slot = at;
      recency.splice(recency.indexOf(p), 1);
      result.push("H");
      caption = `참조 ${p}: 히트`;
    } else {
      faults++;
      result.push("F");
      const free = slots.indexOf(null);
      if (free >= 0) {
        slot = free;
        caption = `참조 ${p}: 폴트, 빈 프레임 사용`;
      } else {
        const victim = recency.shift()!;
        slot = slots.indexOf(victim);
        caption = `참조 ${p}: 폴트, ${victim} 을 내보냄 (가장 오래 사용되지 않음)`;
      }
      slots[slot] = p;
    }
    recency.push(p);
    grid.push([...slots]);
    push(t, slot, at >= 0, caption);
  });
  push(
    REFS.length,
    -1,
    false,
    `완료: 참조 ${REFS.length} 번 중 폴트 ${faults} 번 (FIFO ${fifoFaults()}, OPT ${optFaults()})`
  );
  return frames;
}

export function fifoFaults(refs = REFS, n = FRAMES): number {
  const q: number[] = [];
  let f = 0;
  for (const p of refs) {
    if (q.includes(p)) continue;
    f++;
    if (q.length === n) q.shift();
    q.push(p);
  }
  return f;
}

export function optFaults(refs = REFS, n = FRAMES): number {
  const mem: number[] = [];
  let f = 0;
  refs.forEach((p, i) => {
    if (mem.includes(p)) return;
    f++;
    if (mem.length < n) return void mem.push(p);
    const next = (q: number) => {
      const j = refs.indexOf(q, i + 1);
      return j < 0 ? Infinity : j;
    };
    const victim = mem.reduce((a, b) => (next(b) > next(a) ? b : a));
    mem[mem.indexOf(victim)] = p;
  });
  return f;
}
