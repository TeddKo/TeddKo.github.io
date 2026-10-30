export const EVENTS = [
  { name: "AccountOpened", delta: 0 },
  { name: "Deposited +100", delta: 100 },
  { name: "Withdrawn -30", delta: -30 },
  { name: "Deposited +50", delta: 50 },
  { name: "Withdrawn -20", delta: -20 },
];

export type ProjectionFrame = {
  /** 로그에 보이는 이벤트 수. */
  shown: number;
  /** 방금 적용한 이벤트 번호 (1 기준, 0 = 없음). */
  active: number;
  /** 프로젝션 잔액 (null = 유실). */
  balance: number | null;
  applied: number;
  caption: string;
};

const fold = (n: number) => EVENTS.slice(0, n).reduce((b, e) => b + e.delta, 0);

export function projectionFrames(): ProjectionFrame[] {
  const out: ProjectionFrame[] = [];
  const all = EVENTS.length;
  const c1 = "1. 이벤트를 추가하고 하나씩 프로젝션에 fold 합니다";
  out.push({ shown: 0, active: 0, balance: 0, applied: 0, caption: c1 });
  for (let i = 1; i <= all; i++)
    out.push({
      shown: i,
      active: i,
      balance: fold(i),
      applied: i,
      caption: c1,
    });
  out.push({
    shown: all,
    active: 0,
    balance: fold(all),
    applied: all,
    caption: "상태 = fold(events). 진실의 원천은 로그입니다",
  });
  out.push({
    shown: all,
    active: 0,
    balance: null,
    applied: 0,
    caption:
      "2. 프로젝션을 잃었거나 스키마가 바뀌었습니다: 상태를 초기화합니다",
  });
  const c3 = "3. 로그를 #1 부터 다시 재생합니다";
  out.push({ shown: all, active: 0, balance: 0, applied: 0, caption: c3 });
  for (let i = 1; i <= all; i++)
    out.push({
      shown: all,
      active: i,
      balance: fold(i),
      applied: i,
      caption: c3,
    });
  out.push({
    shown: all,
    active: 0,
    balance: fold(all),
    applied: all,
    caption: `같은 이벤트, 같은 상태: 복원한 잔액 = ${fold(all)}`,
  });
  return out;
}
