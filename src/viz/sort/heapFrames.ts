import { INPUT, sortFrame, type SortFrame } from "./types.ts";

export function heapFrames(input: number[] = INPUT): SortFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let swaps = 0;
  let heapSize = n;
  const frames: SortFrame[] = [];
  const push = (marks: [number, "compare" | "swap"][], caption: string) =>
    frames.push(
      sortFrame(a, i => i >= heapSize, marks, compares, swaps, caption)
    );
  const swap = (x: number, y: number, caption: string) => {
    [a[x], a[y]] = [a[y], a[x]];
    swaps++;
    push(
      [
        [x, "swap"],
        [y, "swap"],
      ],
      caption
    );
  };

  const siftDown = (start: number, size: number) => {
    let i = start;
    while (true) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < size) {
        compares++;
        const bigger = a[l] > a[m];
        push(
          [
            [l, "compare"],
            [m, "compare"],
          ],
          `왼쪽 자식 ${a[l]}, ${a[m]} 비교`
        );
        if (bigger) m = l;
      }
      if (r < size) {
        compares++;
        const bigger = a[r] > a[m];
        push(
          [
            [r, "compare"],
            [m, "compare"],
          ],
          `오른쪽 자식 ${a[r]}, ${a[m]} 비교`
        );
        if (bigger) m = r;
      }
      if (m === i) return;
      swap(i, m, `큰 자식 ${a[m]} 위로 올리며 교환`);
      i = m;
    }
  };

  for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(i, n);
  for (let end = n - 1; end > 0; end--) {
    swap(0, end, `루트(최댓값) ${a[0]}, ${end} 번 위치로 교환`);
    heapSize = end;
    push([], `${a[end]} 위치 확정`);
    siftDown(0, end);
  }
  heapSize = 0;
  push([], "정렬 완료");
  return frames;
}
