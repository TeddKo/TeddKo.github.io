export type Cell = "empty" | "drop" | "keep";

export type Panel = {
  map: (number | null)[];
  filter: { v: number | null; cell: Cell }[];
  ops: number;
  note: string;
  /** first() 결과가 정해진 뒤 강조. */
  done: boolean;
  /** 손대지 않은 원소(4..6) 표시. */
  untouched: boolean;
};

export type SeqFrame = { iter: Panel; seq: Panel };

export const INPUT = [1, 2, 3, 4, 5, 6];
const MAP = INPUT.map(x => x * 2);

const E = (): Panel["filter"] => INPUT.map(() => ({ v: null, cell: "empty" }));

function iterable(stage: 0 | 1 | 2 | 3): Panel {
  const notes = [
    "단계별: 연산자마다 리스트 전체 처리",
    "map 이 6개 모두 처리 → 새 List",
    "filter 도 6개 모두 처리 → 또 새 List",
    "first() = 6 인데 연산은 12번 실행",
  ];
  return {
    map: stage ? [...MAP] : INPUT.map(() => null),
    filter:
      stage >= 2 ? MAP.map(v => ({ v, cell: v > 4 ? "keep" : "drop" })) : E(),
    ops: [0, 6, 12, 12][stage],
    note: notes[stage],
    done: stage === 3,
    untouched: false,
  };
}

/** step: 지금까지 처리한 단계 수 (1=map(1), 2=filter(1), ... 6=filter(3) 에서 멈춤), 7=손대지 않음 */
function sequence(step: number): Panel {
  const ops = Math.min(step, 6);
  const mapped = Math.ceil(ops / 2);
  const filtered = Math.floor(ops / 2);
  const untouched = step === 7;
  let note = "원소 단위 지연 처리: 하나씩";
  if (ops > 0) note = `원소 ${Math.ceil(ops / 2)} 이 map, filter 를 통과`;
  if (ops === 6) note = "6 이 filter 통과 → first() 가 여기서 멈춤";
  if (untouched) note = "원소 4..6 은 손대지 않음";
  return {
    map: INPUT.map((_, i) => (i < mapped ? MAP[i] : null)),
    filter: INPUT.map((_, i) => {
      if (i >= filtered) return { v: null, cell: "empty" as Cell };
      return {
        v: MAP[i],
        cell: MAP[i] > 4 ? ("keep" as Cell) : ("drop" as Cell),
      };
    }),
    ops,
    note,
    done: ops === 6,
    untouched,
  };
}

/** 문서화된 GIF 의 (Iterable, Sequence) 상태 쌍과 같은 순서. */
export function seqFrames(): SeqFrame[] {
  const pairs: [0 | 1 | 2 | 3, number][] = [
    [0, 0],
    [1, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [3, 5],
    [3, 6],
    [3, 7],
  ];
  return pairs.map(([i, s]) => ({ iter: iterable(i), seq: sequence(s) }));
}
