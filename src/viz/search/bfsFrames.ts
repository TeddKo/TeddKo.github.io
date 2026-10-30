import { GRAPH, type GraphFrame } from "./graphData.ts";

export function bfsFrames(graph: number[][] = GRAPH, start = 0): GraphFrame[] {
  const frames: GraphFrame[] = [];
  const seen = new Set([start]);
  const order: number[] = [];
  const queue = [start];
  const push = (cur: number, caption: string) =>
    frames.push({ cur, order: [...order], list: [...queue], caption });

  push(-1, `시작 노드 ${start} 큐에 넣고 방문 표시`);
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    push(cur, `큐에서 ${cur} 꺼내 방문`);
    const fresh = graph[cur].filter(n => !seen.has(n));
    fresh.forEach(n => {
      seen.add(n);
      queue.push(n);
    });
    push(
      cur,
      fresh.length
        ? `방문하지 않은 이웃 ${fresh.join(", ")} 큐에 넣음`
        : "방문하지 않은 이웃 없음"
    );
  }
  push(-1, "큐가 비어 탐색 종료");
  return frames;
}
