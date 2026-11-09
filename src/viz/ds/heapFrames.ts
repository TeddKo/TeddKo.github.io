export type HeapFrame = {
  a: (number | null)[];
  cur: number | null;
  cmp: number | null;
  kind: "start" | "append" | "compare" | "swap" | "stop" | "take" | "done";
  label: string;
  compares: number;
  swaps: number;
  caption: string;
};

export const HEAP = [2, 5, 4, 9, 7, 8, 6];
export const INSERTED = 3;
export const POLL_HEAP = [2, 3, 4, 5, 7, 8, 6, 9];

function recorder(a: (number | null)[], label: () => string) {
  const frames: HeapFrame[] = [];
  const st = { compares: 0, swaps: 0 };
  const snap = (
    kind: HeapFrame["kind"],
    cur: number | null,
    cmp: number | null,
    caption: string
  ) =>
    frames.push({
      a: [...a],
      cur,
      cmp,
      kind,
      label: label(),
      compares: st.compares,
      swaps: st.swaps,
      caption,
    });
  return { frames, st, snap };
}

export function heapInsertFrames(heap = HEAP, v = INSERTED): HeapFrame[] {
  const a: (number | null)[] = [...heap, null];
  const { frames, st, snap } = recorder(a, () => `insert(${v})`);
  snap("start", null, null, "최소 힙: 모든 부모 ≤ 자식");
  let i = heap.length;
  a[i] = v;
  snap("append", i, null, `${v} 을 배열 끝(인덱스 ${i})에 붙임`);
  while (i > 0) {
    const p = (i - 1) >> 1;
    st.compares++;
    snap("compare", i, p, `부모 인덱스 ${p} 비교: ${v} vs ${a[p]}`);
    if ((a[i] as number) >= (a[p] as number)) {
      snap("stop", i, p, `${v} ≥ ${a[p]}: 멈춤`);
      break;
    }
    [a[i], a[p]] = [a[p], a[i]];
    st.swaps++;
    i = p;
    snap("swap", i, null, `교환: ${v} 인덱스 ${i} 로 상승`);
  }
  snap("done", null, null, "힙 속성 복원");
  return frames;
}

export function heapPollFrames(heap = POLL_HEAP): HeapFrame[] {
  const a: (number | null)[] = [...heap];
  let label = "poll()";
  const { frames, st, snap } = recorder(a, () => label);
  snap("start", null, null, "루트는 항상 최솟값");
  const n = heap.length;
  const min = a[0] as number;
  const last = a[n - 1] as number;
  label = `poll() → ${min}`;
  snap(
    "take",
    0,
    n - 1,
    `루트 ${min} 반환 · 마지막 원소 ${last} → 루트로 이동`
  );
  a[0] = last;
  a[n - 1] = null;
  const len = n - 1;
  snap("take", 0, null, `배열 길이 1 감소: 새 루트 ${last} 내려보내기`);
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    if (l >= len) {
      snap("stop", i, null, `인덱스 ${i} 는 자식이 없음: 멈춤`);
      break;
    }
    const c = r < len && (a[r] as number) < (a[l] as number) ? r : l;
    st.compares++;
    snap(
      "compare",
      i,
      c,
      `작은 자식 ${a[c]} (인덱스 ${c}): ${last} vs ${a[c]}`
    );
    if ((a[i] as number) <= (a[c] as number)) {
      snap("stop", i, c, `${last} ≤ ${a[c]}: 멈춤`);
      break;
    }
    [a[i], a[c]] = [a[c], a[i]];
    st.swaps++;
    i = c;
    snap("swap", i, null, `교환: ${last} 인덱스 ${i} 로 하강`);
  }
  snap("done", null, null, "힙 속성 복원");
  return frames;
}
