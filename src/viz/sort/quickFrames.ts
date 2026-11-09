import { INPUT, sortFrame, type SortFrame } from "./types.ts";

export function quickFrames(input: number[] = INPUT): SortFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let swaps = 0;
  let lo0 = 0;
  let hi0 = n - 1;
  const fixed = new Set<number>();
  const frames: SortFrame[] = [];
  const push = (
    marks: [number, "compare" | "swap" | "pivot"][],
    caption: string
  ) =>
    frames.push(
      sortFrame(
        a,
        i => fixed.has(i),
        marks,
        compares,
        swaps,
        caption,
        i => !fixed.has(i) && (i < lo0 || i > hi0)
      )
    );

  const sort = (lo: number, hi: number) => {
    if (lo > hi) return;
    lo0 = lo;
    hi0 = hi;
    if (lo === hi) {
      fixed.add(lo);
      push([], `구간에 원소 하나: ${a[lo]} 확정`);
      return;
    }
    const p = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      compares++;
      push(
        [
          [hi, "pivot"],
          [j, "compare"],
        ],
        `${a[j]}, 피벗 ${p} 비교`
      );
      if (a[j] < p) {
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          swaps++;
          push(
            [
              [hi, "pivot"],
              [i, "swap"],
              [j, "swap"],
            ],
            `${a[i]} < ${p} 이므로 ${i} 번 위치로 보냄`
          );
        }
        i++;
      }
    }
    [a[i], a[hi]] = [a[hi], a[i]];
    swaps++;
    push(
      [
        [i, "swap"],
        [hi, "swap"],
      ],
      i === hi
        ? `이미 제자리: 피벗 ${p}, ${i} 번 위치`
        : `피벗 ${p}, ${i} 번 위치와 교환`
    );
    fixed.add(i);
    push([], `${i} 번 위치에 피벗 ${p} 확정`);
    sort(lo, i - 1);
    lo0 = lo;
    hi0 = hi;
    sort(i + 1, hi);
  };

  sort(0, n - 1);
  lo0 = 0;
  hi0 = n - 1;
  push([], "정렬 완료");
  return frames;
}
