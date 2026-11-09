export type PState = "new" | "ready" | "running" | "waiting" | "terminated";
export type Edge =
  "admitted" | "dispatch" | "interrupt" | "ioWait" | "ioDone" | "exit";

export type StateFrame = {
  state: PState;
  /** 직전에 지난 전이 (없으면 null). */
  via: Edge | null;
  caption: string;
};

const STEPS: [PState, Edge | null, string][] = [
  ["new", null, "새 프로세스가 생성됩니다 (new)"],
  ["ready", "admitted", "admitted: 프로세스가 ready 큐에 들어갑니다"],
  ["running", "dispatch", "dispatch: 스케줄러가 CPU 를 배정합니다"],
  ["ready", "interrupt", "interrupt: 타임 슬라이스가 끝나 ready 로 돌아갑니다"],
  ["running", "dispatch", "dispatch: 스케줄러가 CPU 를 배정합니다"],
  ["waiting", "ioWait", "I/O 요청: 프로세스가 막혀 waiting 으로 갑니다"],
  [
    "ready",
    "ioDone",
    "I/O 완료: 다시 ready 가 됩니다 (바로 running 은 아닙니다)",
  ],
  ["running", "dispatch", "dispatch: 스케줄러가 CPU 를 배정합니다"],
  ["terminated", "exit", "exit: 프로세스가 끝납니다"],
];

export function stateFrames(): StateFrame[] {
  return STEPS.map(([state, via, caption]) => ({ state, via, caption }));
}
