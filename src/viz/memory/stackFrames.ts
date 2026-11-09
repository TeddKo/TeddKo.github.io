export type Frame = { name: string; n?: number; r?: number | null };

export type StackFrame = {
  /** 강조할 코드 줄 (CODE 의 인덱스). */
  line: number;
  stack: Frame[];
  caption: string;
};

export const CODE = [
  "int fact(int n) {",
  "  if (n <= 1) return 1;",
  "  return n * fact(n - 1);",
  "}",
  "int main() {",
  "  int r = fact(3);",
  "}",
];
const MAIN_OPEN = 4;
const CALL = 5;
const IF = 1;
const RET = 2;

export function stackFrames(): StackFrame[] {
  const main = (r: number | null): Frame => ({ name: "main", r });
  const f = (n: number): Frame => ({ name: `fact(${n})`, n });
  const out: [number, Frame[], string][] = [
    [MAIN_OPEN, [main(null)], "main 이 실행됩니다: 프레임이 쌓입니다"],
    [CALL, [main(null)], "main 이 fact(3) 을 호출합니다"],
    [RET, [main(null), f(3)], "fact(3) 프레임 PUSH"],
    [RET, [main(null), f(3)], "n = 3 이라 1 이하가 아닙니다: fact(2) 호출"],
    [RET, [main(null), f(3), f(2)], "fact(2) 프레임 PUSH"],
    [RET, [main(null), f(3), f(2)], "n = 2 라 1 이하가 아닙니다: fact(1) 호출"],
    [
      IF,
      [main(null), f(3), f(2), f(1)],
      "fact(1) 프레임 PUSH: n <= 1 이므로 1 반환",
    ],
    [RET, [main(null), f(3), f(2)], "fact(1) POP: 1 반환"],
    [RET, [main(null), f(3)], "fact(2) POP: 2 * 1 = 2 반환"],
    [RET, [main(null)], "fact(3) POP: 3 * 2 = 6 반환"],
    [CALL, [main(6)], "main 으로 돌아왔습니다: r = 6"],
  ];
  return out.map(([line, stack, caption]) => ({ line, stack, caption }));
}
