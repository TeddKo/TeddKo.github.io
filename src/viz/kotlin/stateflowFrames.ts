export type StateflowFrame = {
  producer: number | null;
  value: number;
  busy: boolean;
  received: number[];
  skipped: number[];
  /** 생산자가 대입한 값 (ignored = 현재 값과 같아 무시됨). */
  sets: { v: number; ignored: boolean }[];
  /** 방금 움직인 화살표. */
  flow: "in" | "out" | null;
  caption: string;
};

type S = Omit<StateflowFrame, "caption">;

export function stateflowFrames(): StateflowFrame[] {
  const f = (s: Partial<S>, caption: string, prev?: S): StateflowFrame => ({
    value: 0,
    busy: false,
    received: [],
    skipped: [],
    sets: [],
    ...prev,
    producer: null,
    flow: null,
    ...s,
    caption,
  });
  const a = f(
    { value: 0, received: [0], flow: "out" },
    "collect 시작: 현재 값 0 이 전달됩니다"
  );
  const b = f(
    {
      producer: 1,
      value: 1,
      busy: true,
      received: [0, 1],
      sets: [{ v: 1, ignored: false }],
      flow: "in",
    },
    "수집자가 1 을 받고 느린 작업을 시작합니다",
    a
  );
  const c = f(
    { producer: 2, value: 2, sets: [...b.sets, { v: 2, ignored: false }] },
    "수집자가 바쁩니다: 2 는 value 에서 대기합니다",
    b
  );
  const d = f(
    {
      producer: 3,
      value: 3,
      skipped: [2],
      sets: [...c.sets, { v: 3, ignored: false }],
    },
    "3 이 읽히기 전의 2 를 덮어씁니다 (conflation)",
    c
  );
  const e = f(
    { producer: 3, sets: [...d.sets, { v: 3, ignored: true }] },
    "현재 값과 같아서 무시됩니다",
    d
  );
  const g = f(
    { producer: null, received: [0, 1, 3], flow: "out" },
    "수집자가 다시 비어 최신 값 3 을 읽습니다",
    e
  );
  const h = f(
    {
      producer: 4,
      value: 4,
      busy: false,
      received: [0, 1, 3, 4],
      sets: [...g.sets, { v: 4, ignored: false }],
      flow: "in",
    },
    "대기 중인 수집자는 4 를 바로 받습니다",
    g
  );
  return [a, b, c, d, e, g, h];
}
