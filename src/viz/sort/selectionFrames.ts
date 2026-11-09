import { INPUT, sortFrame, type SortFrame } from "./types.ts";

export function selectionFrames(input: number[] = INPUT): SortFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let swaps = 0;
  let done = 0;
  const frames: SortFrame[] = [];
  const push = (
    marks: [number, "compare" | "swap" | "pivot"][],
    caption: string
  ) =>
    frames.push(sortFrame(a, i => i < done, marks, compares, swaps, caption));

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      compares++;
      const less = a[j] < a[min];
      push(
        [
          [min, "pivot"],
          [j, "compare"],
        ],
        `${a[j]}, 최솟값 후보 ${a[min]} 비교: ${less ? "새 최솟값" : "후보 유지"}`
      );
      if (less) min = j;
    }
    if (min !== i) {
      [a[i], a[min]] = [a[min], a[i]];
      swaps++;
      push(
        [
          [i, "swap"],
          [min, "swap"],
        ],
        `최솟값 ${a[i]} 교환: ${i} 번 위치로`
      );
    }
    done = i + 1;
    push(
      [],
      min === i
        ? `이미 최솟값 ${a[i]}, 교환 없이 ${i} 번 확정`
        : `${a[i]} 위치 확정`
    );
  }
  done = n;
  push([], "정렬 완료");
  return frames;
}
