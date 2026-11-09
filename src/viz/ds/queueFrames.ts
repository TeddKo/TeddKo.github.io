export type QueueFrame = {
  slots: (string | null)[];
  head: number;
  tail: number;
  size: number;
  op: string;
  ret: string | null;
  hot: number | null;
  caption: string;
};

export const CAP = 6;
export const OPS: string[] = ["A", "B", "C", "D", "-", "-", "E", "F", "G", "H"];

export function queueFrames(ops = OPS, cap = CAP): QueueFrame[] {
  const s: (string | null)[] = Array(cap).fill(null);
  let head = 0;
  let tail = 0;
  let size = 0;
  const frames: QueueFrame[] = [];
  const snap = (
    op: string,
    ret: string | null,
    hot: number | null,
    caption: string
  ) => frames.push({ slots: [...s], head, tail, size, op, ret, hot, caption });

  snap("start", null, null, "head = 가장 오래된 원소, tail = 다음 빈 칸");
  for (const o of ops) {
    if (o === "-") {
      snap("dequeue()", null, head, "head 위치에서 읽기");
      const v = s[head];
      s[head] = null;
      head = (head + 1) % cap;
      size--;
      snap("dequeue()", v, null, "head 가 한 칸 이동");
    } else {
      const op = `enqueue(${o})`;
      s[tail] = o;
      snap(op, null, tail, "tail 위치에 기록");
      tail = (tail + 1) % cap;
      size++;
      snap(
        op,
        null,
        null,
        tail === 0 ? "tail 이 0 으로 돌아감" : "tail 이 한 칸 이동"
      );
    }
  }
  snap(
    "done",
    null,
    null,
    "head == tail 이 다시 성립: 가득 찬 것과 빈 것은 size 로 구분"
  );
  return frames;
}
