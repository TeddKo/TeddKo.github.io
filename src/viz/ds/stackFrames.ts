export type StackFrame = {
  items: number[];
  float: number | null;
  hot: boolean;
  ret: number | null;
  op: string;
  size: number;
  pushed: number[];
  popped: number[];
  caption: string;
};

export const CAPACITY = 5;
export const OPS: ("pop" | number)[] = [4, 7, 2, "pop", 9, "pop", "pop"];

export function stackFrames(ops = OPS): StackFrame[] {
  const s: number[] = [];
  const pushed: number[] = [];
  const popped: number[] = [];
  const frames: StackFrame[] = [];
  const snap = (
    op: string,
    float: number | null,
    hot: boolean,
    ret: number | null,
    caption: string,
    items = s
  ) =>
    frames.push({
      items: [...items],
      float,
      hot,
      ret,
      op,
      size: items.length,
      pushed: [...pushed],
      popped: [...popped],
      caption,
    });

  snap(
    "start",
    null,
    false,
    null,
    "후입선출(LIFO): 나중에 넣은 것이 먼저 나옴"
  );
  for (const o of ops) {
    if (o === "pop") {
      const top = s[s.length - 1];
      snap("pop()", null, true, null, "접근할 수 있는 원소는 top 하나뿐");
      s.pop();
      popped.push(top);
      snap("pop()", top, false, top, "맨 위 원소가 먼저 나감", s);
      snap("pop()", null, false, top, "top 이 한 칸 내려감");
    } else {
      snap(`push(${o})`, o, false, null, "새 원소는 맨 위에 놓임");
      s.push(o);
      pushed.push(o);
      snap(`push(${o})`, null, true, null, "top 이 한 칸 올라감");
    }
  }
  snap(
    "done",
    null,
    false,
    null,
    `push ${pushed.join(" ")}, pop ${popped.join(" ")}`
  );
  return frames;
}
