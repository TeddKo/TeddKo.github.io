export const GRAPH: number[][] = [
  [1, 2],
  [0, 3, 4],
  [0, 5, 6],
  [1, 4],
  [1, 3, 7],
  [2, 7],
  [2],
  [4, 5],
];

export type GraphFrame = {
  /** Node being processed, -1 when none. */
  cur: number;
  /** Visit order so far. */
  order: number[];
  /** BFS queue or DFS call stack. */
  list: number[];
  caption: string;
};
