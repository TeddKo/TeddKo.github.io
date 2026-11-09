export type ResizeFrame = {
  old: number[][];
  neu: number[][] | null;
  size: number;
  threshold: number;
  key: number | null;
  oldBucket: number | null;
  newBucket: number | null;
  moved: number[];
  alert: boolean;
  caption: string;
};

export const KEYS = [8, 5, 12, 3];
export const CAP = 4;
export const LOAD = 0.75;

export function resizeFrames(keys = KEYS, cap = CAP): ResizeFrame[] {
  const old: number[][] = Array.from({ length: cap }, () => []);
  let neu: number[][] | null = null;
  let size = 0;
  let threshold = cap * LOAD;
  let moved: number[] = [];
  const frames: ResizeFrame[] = [];
  const snap = (
    key: number | null,
    oldBucket: number | null,
    newBucket: number | null,
    alert: boolean,
    caption: string
  ) =>
    frames.push({
      old: old.map(c => [...c]),
      neu: neu && neu.map(c => [...c]),
      size,
      threshold,
      key,
      oldBucket,
      newBucket,
      moved: [...moved],
      alert,
      caption,
    });

  snap(
    null,
    null,
    null,
    false,
    `용량 ${cap}, 로드 팩터 ${LOAD}: 개수 > ${threshold} 이면 리사이즈`
  );
  for (const k of keys) {
    const idx = k % cap;
    old[idx].push(k);
    size++;
    snap(k, idx, null, false, `put(${k}): ${k} mod ${cap} = ${idx}번 버킷`);
  }
  snap(null, null, null, true, `개수 ${size} > 임계값 ${threshold} → 리사이즈`);
  const ncap = cap * 2;
  neu = Array.from({ length: ncap }, () => []);
  snap(null, null, null, true, `두 배 크기 새 테이블 할당: 용량 ${ncap}`);
  for (let b = 0; b < cap; b++) {
    for (const k of old[b]) {
      const ni = k % ncap;
      neu[ni].push(k);
      moved.push(k);
      snap(
        k,
        b,
        ni,
        true,
        `이동 ${k}: ${k} mod ${ncap} = ${ni} (이전 ${k} mod ${cap} = ${b})`
      );
    }
  }
  threshold = ncap * LOAD;
  snap(
    null,
    null,
    null,
    false,
    `완료: ${keys[0]} 과 ${keys[2]} 는 서로 다른 버킷 (${keys[0] % ncap}번, ${keys[2] % ncap}번)`
  );
  return frames;
}
