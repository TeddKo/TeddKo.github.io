import { GRAPH, type GraphFrame } from "./graphData.ts";

export function dfsFrames(graph: number[][] = GRAPH, start = 0): GraphFrame[] {
  const frames: GraphFrame[] = [];
  const seen = new Set<number>();
  const order: number[] = [];
  const stack: number[] = [];
  const push = (cur: number, caption: string) =>
    frames.push({ cur, order: [...order], list: [...stack], caption });

  const visit = (cur: number) => {
    seen.add(cur);
    order.push(cur);
    stack.push(cur);
    push(cur, `노드 ${cur} 방문, 콜 스택에 쌓음`);
    for (const next of graph[cur]) if (!seen.has(next)) visit(next);
    stack.pop();
    const back = stack.at(-1);
    push(
      back ?? -1,
      back === undefined
        ? `노드 ${cur} 완료, 스택이 비어 탐색 종료`
        : `노드 ${cur} 더 갈 곳 없음, 스택에서 빼고 되돌아감 (노드 ${back})`
    );
  };

  visit(start);
  return frames;
}
