export type Block = {
  who: "A" | "B" | "C";
  kind: "send" | "resp";
  start: number;
};
export type Wait = { who: "A" | "B" | "C"; start: number; end: number };

export const SEND = ["A", "B", "C"] as const;
/** 단위 시간: 전송 0..3, 유휴 3..4, 응답 4..7. I/O 대기는 각 3 단위. */
export const BLOCKS: Block[] = [
  ...SEND.map((who, i) => ({ who, kind: "send" as const, start: i })),
  ...SEND.map((who, i) => ({ who, kind: "resp" as const, start: 4 + i })),
];
export const WAITS: Wait[] = SEND.map((who, i) => ({
  who,
  start: i + 1,
  end: i + 4,
}));
export const END = 7;

export type LoopFrame = { t: number; caption: string };

const CAPS = [
  "요청 A 가 도착합니다. 이벤트 루프가 논블로킹 DB 호출을 시작합니다.",
  "A 가 I/O 를 기다리는 동안 같은 스레드가 요청 B 를 받습니다.",
  "요청 C 도 같은 방식으로 시작합니다. 막힌 스레드는 없습니다.",
  "셋 모두 I/O 를 기다립니다. 루프 스레드는 다른 일을 할 수 있습니다.",
  "A 의 DB 결과가 준비되면 콜백이 루프에서 실행되어 응답합니다.",
  "B 와 C 도 차례로 완료됩니다. 스레드 하나가 요청 세 개를 처리했습니다.",
  "스레드 하나, 겹치는 요청 세 개.",
];

export function loopFrames(): LoopFrame[] {
  const cap = (i: number) =>
    i <= 1
      ? 0
      : i <= 3
        ? 1
        : i <= 5
          ? 2
          : i <= 7
            ? 3
            : i <= 9
              ? 4
              : i <= 13
                ? 5
                : 6;
  return Array.from({ length: 15 }, (_, i) => ({
    t: i / 2,
    caption: CAPS[cap(i)],
  }));
}
