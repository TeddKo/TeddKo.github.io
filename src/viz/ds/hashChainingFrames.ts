export type ChainFrame = {
  buckets: number[][];
  bucket: number | null;
  key: number | null;
  put: { key: number; idx: number; collision: boolean } | null;
  caption: string;
};

export const KEYS = [12, 5, 20, 13, 7, 28];
export const CAP = 8;

export function chainingFrames(keys = KEYS, cap = CAP): ChainFrame[] {
  const b: number[][] = Array.from({ length: cap }, () => []);
  const frames: ChainFrame[] = [];
  const snap = (
    bucket: number | null,
    key: number | null,
    put: ChainFrame["put"],
    caption: string
  ) => frames.push({ buckets: b.map(c => [...c]), bucket, key, put, caption });

  snap(null, null, null, `빈 버킷 ${cap}개: index = hash mod ${cap}`);
  for (const k of keys) {
    const idx = k % cap;
    const put = { key: k, idx, collision: b[idx].length > 0 };
    snap(
      idx,
      null,
      put,
      `키 ${k}: ${k} mod ${cap} = ${idx}번 버킷${put.collision ? " (이미 차 있음: 충돌)" : ""}`
    );
    b[idx].push(k);
    snap(
      idx,
      k,
      put,
      put.collision
        ? `충돌: ${idx}번 버킷 사슬 끝에 ${k} 연결`
        : `${idx}번 버킷이 비어 있음: ${k} 저장`
    );
  }
  const last = keys[keys.length - 1];
  const longest = last % cap;
  snap(
    longest,
    null,
    null,
    `${longest}번 버킷 사슬 길이 ${b[longest].length}: ${last} 조회는 ${b[longest].join(" → ")} 순서로 비교`
  );
  return frames;
}
