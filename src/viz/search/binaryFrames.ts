import { ARR } from "./arrayData.ts";

export type BinaryFrame = {
  lo: number;
  hi: number;
  /** Probed index, -1 when none. */
  mid: number;
  found: number;
  steps: number;
  caption: string;
};

export const TARGET = 52;

export function binaryFrames(
  a: number[] = ARR,
  target = TARGET
): BinaryFrame[] {
  const frames: BinaryFrame[] = [];
  let lo = 0;
  let hi = a.length - 1;
  let steps = 0;
  const push = (mid: number, found: number, caption: string) =>
    frames.push({ lo, hi, mid, found, steps, caption });
  push(-1, -1, "정렬된 배열, 범위 = 전체");
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    steps++;
    if (a[mid] === target) {
      push(
        mid,
        mid,
        `arr[${mid}] = ${a[mid]} == ${target} -> 인덱스 ${mid} 에서 발견`
      );
      break;
    }
    if (a[mid] < target) {
      push(mid, -1, `arr[${mid}] = ${a[mid]} < ${target} -> lo = mid + 1`);
      lo = mid + 1;
    } else {
      push(mid, -1, `arr[${mid}] = ${a[mid]} > ${target} -> hi = mid - 1`);
      hi = mid - 1;
    }
    push(-1, -1, `새 범위: ${lo}..${hi}`);
  }
  return frames;
}
