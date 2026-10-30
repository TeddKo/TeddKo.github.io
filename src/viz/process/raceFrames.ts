export type Thread = "A" | "B";

export type RaceFrame = {
  counter: number;
  reg: Record<Thread, number | null>;
  /** 이번 단계를 실행한 스레드 (없으면 null). */
  running: Thread | null;
  /** 스레드별로 마지막에 실행한 명령어 (0=LOAD, 1=ADD, 2=STORE). */
  line: Record<Thread, number | null>;
  /** 완료한 시간 칸 수 (0~6). */
  done: number;
  result: boolean;
  caption: string;
};

export const SLOTS = [
  "A:load",
  "B:load",
  "A:add",
  "A:store",
  "B:add",
  "B:store",
];

export function raceFrames(): RaceFrame[] {
  let counter = 0;
  const reg: RaceFrame["reg"] = { A: null, B: null };
  const line: RaceFrame["line"] = { A: null, B: null };
  const out: RaceFrame[] = [];
  const push = (running: Thread | null, caption: string, result = false) =>
    out.push({
      counter,
      reg: { ...reg },
      running,
      line: { ...line },
      done: out.length === 0 ? 0 : Math.min(out.length, 6),
      result,
      caption,
    });

  push(null, "두 스레드가 같은 세 명령어를 실행합니다");
  reg.A = counter;
  line.A = 0;
  push("A", `1. A 가 counter 를 읽습니다: ${counter}`);
  reg.B = counter;
  line.B = 0;
  push("B", `2. 문맥 교환: B 도 counter 를 읽습니다, 역시 ${counter}`);
  reg.A! += 1;
  line.A = 1;
  push("A", `3. A 가 1 을 더합니다: A.reg = ${reg.A}`);
  counter = reg.A!;
  line.A = 2;
  push("A", `4. A 가 counter 에 ${counter} 을 저장합니다`);
  reg.B! += 1;
  line.B = 1;
  push("B", `5. B 는 오래된 값에 1 을 더합니다: B.reg = 0 + 1 = ${reg.B}`);
  counter = reg.B!;
  line.B = 2;
  push("B", `6. B 가 counter 에 ${counter} 을 저장해 A 의 갱신을 덮어씁니다`);
  out.push({
    ...out[6],
    running: null,
    done: 6,
    result: true,
    caption: `결과: counter = ${counter}, 기대값은 2 (갱신 손실)`,
  });
  return out;
}
