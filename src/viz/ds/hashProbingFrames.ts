export type ProbeFrame = {
  slots: (number | null)[];
  key: number | null;
  start: number;
  probes: number[];
  cur: number | null;
  stored: boolean;
  counts: number[];
  caption: string;
};

export const KEYS = [12, 5, 20, 13, 7, 28];
export const CAP = 8;

export function probingFrames(keys = KEYS, cap = CAP): ProbeFrame[] {
  const s: (number | null)[] = Array(cap).fill(null);
  const counts: number[] = [];
  const frames: ProbeFrame[] = [];
  const snap = (
    key: number | null,
    start: number,
    probes: number[],
    cur: number | null,
    stored: boolean,
    caption: string
  ) =>
    frames.push({
      slots: [...s],
      key,
      start,
      probes: [...probes],
      cur,
      stored,
      counts: [...counts],
      caption,
    });

  snap(
    null,
    0,
    [],
    null,
    false,
    `빈 칸 ${cap}개짜리 배열 하나, 연결 리스트 없음`
  );
  for (const k of keys) {
    const start = k % cap;
    const probes: number[] = [];
    let i = start;
    for (;;) {
      probes.push(i);
      if (s[i] === null) {
        snap(k, start, probes, i, false, `${i}번 칸이 비어 있음`);
        break;
      }
      const wrap = (i + 1) % cap === 0 ? ` (${i} 다음은 0)` : "";
      snap(
        k,
        start,
        probes,
        i,
        false,
        `${i}번 칸 점유: ${s[i]} → 충돌, 다음 칸 확인${wrap}`
      );
      i = (i + 1) % cap;
    }
    s[i] = k;
    counts.push(probes.length);
    snap(
      k,
      start,
      probes,
      i,
      true,
      `${k} 저장: ${i}번 칸, 탐사 ${probes.length}회`
    );
  }
  const used = s.filter(v => v !== null).length;
  snap(
    null,
    0,
    [],
    null,
    false,
    `${cap}칸 중 ${used}칸 사용 (로드 ${used / cap}): 이웃끼리 뭉치는 클러스터`
  );
  return frames;
}
