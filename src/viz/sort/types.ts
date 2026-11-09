export type Role = "idle" | "compare" | "swap" | "sorted" | "pivot";

export type SortFrame = {
  values: number[];
  roles: Role[];
  /** Indices drawn faded (outside the range being worked on). */
  dim: boolean[];
  compares: number;
  swaps: number;
  caption: string;
};

export const INPUT = [11, 16, 5, 7, 3, 9, 2, 8, 1, 15, 10, 4, 12, 6, 13, 14];

export function sortFrame(
  values: number[],
  sorted: (i: number) => boolean,
  marks: [number, Role][],
  compares: number,
  swaps: number,
  caption: string,
  faded: (i: number) => boolean = () => false
): SortFrame {
  const roles: Role[] = values.map((_, i) => (sorted(i) ? "sorted" : "idle"));
  for (const [i, r] of marks) roles[i] = r;
  return {
    values: [...values],
    roles,
    dim: values.map((_, i) => faded(i)),
    compares,
    swaps,
    caption,
  };
}
