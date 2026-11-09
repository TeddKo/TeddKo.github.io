export type BubbleFrame = {
  values: number[];
  /** Indices highlighted this step (compare = purple, swap = blue). */
  active: [number, number] | null;
  kind: "start" | "compare" | "swap" | "sorted";
  /** Indices from this one to the end are final. */
  sortedFrom: number;
  compares: number;
  swaps: number;
  caption: string;
};

export const INPUT = [11, 16, 5, 7, 3, 9, 2, 8, 1, 15, 10, 4, 12, 6, 13, 14];

export function bubbleFrames(input: number[] = INPUT): BubbleFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let swaps = 0;
  let sortedFrom = n;
  const frames: BubbleFrame[] = [];
  const push = (
    kind: BubbleFrame["kind"],
    active: [number, number] | null,
    caption: string
  ) =>
    frames.push({
      values: [...a],
      active,
      kind,
      sortedFrom,
      compares,
      swaps,
      caption,
    });

  for (let end = n - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      compares++;
      push("compare", [i, i + 1], `${a[i]}, ${a[i + 1]} 비교`);
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        swaps++;
        swapped = true;
        push("swap", [i, i + 1], `${a[i + 1]} > ${a[i]} 이므로 교환`);
      }
    }
    sortedFrom = end;
    push("sorted", null, `${a[end]} 위치 확정`);
    if (!swapped) break;
  }
  sortedFrom = 0;
  push("sorted", null, "정렬 완료");
  return frames;
}
