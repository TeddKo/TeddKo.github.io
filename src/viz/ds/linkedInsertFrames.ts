export type InsertFrame = {
  step: 0 | 1 | 2 | 3 | 4;
  next: Record<number, number | null>;
  caption: string;
};

export const LIST = [10, 20, 40];
export const NEW = 30;
export const AFTER = 20;

export function insertFrames(
  list = LIST,
  v = NEW,
  after = AFTER
): InsertFrame[] {
  const next: Record<number, number | null> = {};
  list.forEach((x, i) => (next[x] = list[i + 1] ?? null));
  const frames: InsertFrame[] = [];
  const snap = (step: InsertFrame["step"], caption: string) =>
    frames.push({ step, next: { ...next }, caption });

  snap(0, `${list.join(" → ")} 에서 노드 ${after} 뒤에 ${v} 삽입`);
  next[v] = null;
  snap(1, `1. node = Node(${v})`);
  next[v] = next[after];
  snap(2, "2. node.next = prev.next");
  next[after] = v;
  snap(3, "3. prev.next = node");
  const order: number[] = [list[0]];
  while (next[order[order.length - 1]] !== null)
    order.push(next[order[order.length - 1]] as number);
  snap(4, `완료: ${order.join(" → ")}`);
  return frames;
}
