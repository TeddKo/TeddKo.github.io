import { INPUT, sortFrame, type SortFrame } from "./types.ts";

/**
 * 구간 [lo, hi] 는 `[이미 합쳐진 앞부분 | 남은 왼쪽 | 남은 오른쪽]` 순서로 그린다.
 * 시작 모양은 입력 구간 그대로이고 끝 모양은 합쳐진 결과다.
 */
export function mergeFrames(input: number[] = INPUT): SortFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let writes = 0;
  let lo0 = 0;
  let hi0 = n - 1;
  const frames: SortFrame[] = [];
  const push = (marks: [number, "compare" | "swap"][], caption: string) =>
    frames.push(
      sortFrame(
        a,
        () => false,
        marks,
        compares,
        writes,
        caption,
        i => i < lo0 || i > hi0
      )
    );

  const sort = (lo: number, hi: number) => {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid + 1, hi);
    lo0 = lo;
    hi0 = hi;
    const left = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);
    let i = 0;
    let j = 0;
    let k = lo;
    const view = () => {
      const rest = [...left.slice(i), ...right.slice(j)];
      rest.forEach((v, x) => (a[k + x] = v));
    };
    const out = (v: number, from: string) => {
      a[k] = v;
      k++;
      writes++;
      view();
      push([[k - 1, "swap"]], `결과 ${k - 1} 번 칸에 ${v} 기록 (${from})`);
    };
    push(
      [],
      `구간 ${lo}..${hi} 병합 시작: 왼쪽 ${left.join(" ")} / 오른쪽 ${right.join(" ")}`
    );
    while (i < left.length && j < right.length) {
      compares++;
      const takeLeft = left[i] <= right[j];
      push(
        [
          [k, "compare"],
          [k + left.length - i, "compare"],
        ],
        `${left[i]}, ${right[j]} 비교: ${takeLeft ? "왼쪽" : "오른쪽"}이 작거나 같음`
      );
      if (takeLeft) {
        const v = left[i++];
        out(v, "왼쪽");
      } else {
        const v = right[j++];
        out(v, "오른쪽");
      }
    }
    while (i < left.length) out(left[i++], "왼쪽 남은 값");
    while (j < right.length) out(right[j++], "오른쪽 남은 값");
  };

  sort(0, n - 1);
  frames.push(sortFrame(a, () => true, [], compares, writes, "정렬 완료"));
  return frames;
}
