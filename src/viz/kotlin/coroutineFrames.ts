export const CODE = [
  "suspend fun load(): String {",
  "    val a = fetchA()",
  "    val b = fetchB(a)",
  "    return a + b",
  "}",
];

export type CoroutineFrame = {
  line: number;
  label: 0 | 1 | 2;
  /** cont.L$0 (a 가 저장된 필드). null 이면 아직 없음. */
  l0: string | null;
  /** 방금 바뀐 필드. */
  changed: "label" | null;
  /** 스레드 타임라인: 칸마다 running / free. 길이 = 지금까지 그려진 칸 수. */
  timeline: ("running" | "free")[];
  caption: string;
};

const R = "running";
const F = "free";

export function coroutineFrames(): CoroutineFrame[] {
  const mk = (
    line: number,
    label: 0 | 1 | 2,
    l0: string | null,
    changed: "label" | null,
    timeline: ("running" | "free")[],
    caption: string
  ): CoroutineFrame => ({ line, label, l0, changed, timeline, caption });
  return [
    mk(0, 0, null, null, [R], "load(cont) 호출, label = 0"),
    mk(
      1,
      1,
      null,
      "label",
      [R],
      "label = 1; fetchA(cont) 가 COROUTINE_SUSPENDED 를 반환합니다"
    ),
    mk(
      1,
      1,
      null,
      null,
      [R, F],
      "load() 가 COROUTINE_SUSPENDED 를 반환합니다: 스레드는 비어 있습니다"
    ),
    mk(
      2,
      1,
      '"A"',
      null,
      [R, F, R],
      'cont.resume("A") -> invokeSuspend, a = "A"'
    ),
    mk(
      2,
      2,
      '"A"',
      "label",
      [R, F, R],
      "label = 2; fetchB(a, cont) 가 COROUTINE_SUSPENDED 를 반환합니다"
    ),
    mk(
      2,
      2,
      '"A"',
      null,
      [R, F, R, F],
      "load() 가 다시 COROUTINE_SUSPENDED 를 반환합니다: 스레드는 비어 있습니다"
    ),
    mk(
      3,
      2,
      '"A"',
      null,
      [R, F, R, F, R],
      'cont.resume("B") -> invokeSuspend, b = "B" (지역 변수)'
    ),
    mk(
      4,
      2,
      '"A"',
      null,
      [R, F, R, F, R],
      'return "AB": 호출한 쪽의 continuation 이 재개됩니다'
    ),
  ];
}
