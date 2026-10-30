import { ARR } from "./arrayData.ts";

export type LinearFrame = {
  /** Index being checked. */
  at: number;
  /** Index of the match, -1 until found. */
  found: number;
  steps: number;
  caption: string;
};

export const TARGET = 41;

export function linearFrames(
  a: number[] = ARR,
  target = TARGET
): LinearFrame[] {
  const frames: LinearFrame[] = [];
  for (let i = 0; i < a.length; i++) {
    const hit = a[i] === target;
    frames.push({
      at: i,
      found: hit ? i : -1,
      steps: i + 1,
      caption: hit
        ? `arr[${i}] = ${a[i]} == ${target} -> 인덱스 ${i} 에서 발견`
        : `arr[${i}] = ${a[i]} != ${target} -> 다음 칸`,
    });
    if (hit) break;
  }
  return frames;
}
