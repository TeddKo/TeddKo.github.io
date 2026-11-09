export type Lane = "source" | "filter" | "map";

export type FlowOpFrame = {
  /** source 레인에 나온 값. */
  source: number[];
  /** filter 레인: 통과(pass) / 걸러짐(drop). */
  filter: { v: number; pass: boolean }[];
  /** map 레인 값. */
  map: number[];
  /** collect 에 모인 값. */
  collected: number[];
  /** 이번 단계에서 강조할 (레인, 값). */
  active: { lane: Lane; v: number };
  caption: string;
};

export const INPUT = [1, 2, 3, 4, 5, 6];

export function flowOperatorFrames(input = INPUT): FlowOpFrame[] {
  const source: number[] = [];
  const filter: FlowOpFrame["filter"] = [];
  const map: number[] = [];
  const collected: number[] = [];
  const out: FlowOpFrame[] = [];
  const push = (active: FlowOpFrame["active"], caption: string) =>
    out.push({
      source: [...source],
      filter: [...filter],
      map: [...map],
      collected: [...collected],
      active,
      caption,
    });
  for (const v of input) {
    source.push(v);
    push({ lane: "source", v }, `flowOf: ${v} 방출`);
    const pass = v % 2 === 0;
    filter.push({ v, pass });
    push(
      { lane: "filter", v },
      pass
        ? `filter: ${v} → 짝수여서 통과합니다`
        : `filter: ${v} → 짝수가 아니므로 걸러집니다`
    );
    if (!pass) continue;
    map.push(v * 10);
    collected.push(v * 10);
    push(
      { lane: "map", v: v * 10 },
      `map: ${v} → ${v * 10}, collect 로 전달됩니다`
    );
  }
  return out;
}
