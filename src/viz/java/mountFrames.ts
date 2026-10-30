export type Look = "mounted" | "blocked" | "idle";

export type MountFrame = {
  ready: string[];
  c1: string | null;
  c2: string | null;
  parked: string[];
  /** 강조(accent) 대상 가상 스레드와 그 표시 방식. */
  hi: string;
  look: Look;
  caption: string;
};

export function mountFrames(): MountFrame[] {
  const base = { hi: "V1" };
  return [
    {
      ...base,
      ready: ["V3", "V4"],
      c1: "V1",
      c2: "V2",
      parked: [],
      look: "mounted",
      caption: "V1 은 carrier-1 에, V2 는 carrier-2 에 mount 되어 있습니다",
    },
    {
      ...base,
      ready: ["V3", "V4"],
      c1: "V1",
      c2: "V2",
      parked: [],
      look: "blocked",
      caption: "V1 이 read() 를 호출해 I/O 로 블로킹됩니다",
    },
    {
      ...base,
      ready: ["V3", "V4"],
      c1: null,
      c2: "V2",
      parked: ["V1"],
      look: "idle",
      caption: "V1 이 unmount 되어 parked 로 가고 carrier-1 이 비게 됩니다",
    },
    {
      ...base,
      ready: ["V3", "V4"],
      c1: null,
      c2: null,
      parked: ["V1"],
      look: "idle",
      caption: "V2 가 끝나 carrier-2 도 비게 됩니다",
    },
    {
      ...base,
      ready: ["V3", "V4", "V1"],
      c1: null,
      c2: null,
      parked: [],
      look: "idle",
      caption: "V1 의 I/O 가 끝나 ready queue 로 돌아옵니다",
    },
    {
      ...base,
      ready: ["V3", "V4"],
      c1: null,
      c2: "V1",
      parked: [],
      look: "mounted",
      caption:
        "V1 이 비어 있는 carrier-2 에 mount 됩니다 (이전과 다른 carrier)",
    },
  ];
}
