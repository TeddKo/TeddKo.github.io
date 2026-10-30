import { INPUT, sortFrame, type SortFrame } from "./types.ts";

export function insertionFrames(input: number[] = INPUT): SortFrame[] {
  const a = [...input];
  const n = a.length;
  let compares = 0;
  let swaps = 0;
  let end = 0;
  const frames: SortFrame[] = [];
  const push = (marks: [number, "compare" | "swap"][], caption: string) =>
    frames.push(
      sortFrame(
        a,
        () => false,
        marks,
        compares,
        swaps,
        caption,
        i => i > end
      )
    );

  for (let i = 1; i < n; i++) {
    end = i;
    for (let j = i; j > 0; j--) {
      compares++;
      const marks: [number, "compare"][] = [
        [j - 1, "compare"],
        [j, "compare"],
      ];
      if (a[j - 1] <= a[j]) {
        push(marks, `${a[j - 1]}, ${a[j]} 비교: 순서가 맞아 멈춤`);
        break;
      }
      push(marks, `${a[j - 1]}, ${a[j]} 비교`);
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      swaps++;
      push(
        [
          [j - 1, "swap"],
          [j, "swap"],
        ],
        `${a[j]} > ${a[j - 1]} 이므로 교환`
      );
    }
  }
  end = n;
  frames.push(sortFrame(a, () => true, [], compares, swaps, "정렬 완료"));
  return frames;
}
