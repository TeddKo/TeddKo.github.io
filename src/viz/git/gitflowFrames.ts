export type Lane = "main" | "hotfix" | "release" | "develop" | "feature";
export const LANES: Lane[] = [
  "main",
  "hotfix",
  "release",
  "develop",
  "feature",
];
export const LANE_NAMES: Record<Lane, string> = {
  main: "main",
  hotfix: "hotfix/1.0.1",
  release: "release/1.0",
  develop: "develop",
  feature: "feature/login",
};

export type GNode = { id: string; lane: Lane; x: number; step: number };
export type GEdge = { from: string; to: string; merge: boolean; step: number };
export type GTag = { node: string; name: string; step: number };

/** 각 요소는 등장 단계(step)를 갖고, 프레임은 step 이하 요소만 보여 준다. */
export const NODES: GNode[] = [
  { id: "m0", lane: "main", x: 0, step: 0 },
  { id: "d0", lane: "develop", x: 1, step: 1 },
  { id: "f1", lane: "feature", x: 2, step: 2 },
  { id: "f2", lane: "feature", x: 3, step: 2 },
  { id: "d1", lane: "develop", x: 4, step: 3 },
  { id: "r1", lane: "release", x: 5, step: 4 },
  { id: "r2", lane: "release", x: 6, step: 5 },
  { id: "m1", lane: "main", x: 7, step: 6 },
  { id: "d2", lane: "develop", x: 8, step: 7 },
  { id: "h1", lane: "hotfix", x: 9, step: 8 },
  { id: "m2", lane: "main", x: 10, step: 9 },
  { id: "d3", lane: "develop", x: 11, step: 10 },
];

export const EDGES: GEdge[] = [
  { from: "m0", to: "d0", merge: false, step: 1 },
  { from: "d0", to: "f1", merge: false, step: 2 },
  { from: "f1", to: "f2", merge: false, step: 2 },
  { from: "d0", to: "d1", merge: false, step: 3 },
  { from: "f2", to: "d1", merge: true, step: 3 },
  { from: "d1", to: "r1", merge: false, step: 4 },
  { from: "r1", to: "r2", merge: false, step: 5 },
  { from: "m0", to: "m1", merge: false, step: 6 },
  { from: "r2", to: "m1", merge: true, step: 6 },
  { from: "d1", to: "d2", merge: false, step: 7 },
  { from: "r2", to: "d2", merge: true, step: 7 },
  { from: "m1", to: "h1", merge: false, step: 8 },
  { from: "m1", to: "m2", merge: false, step: 9 },
  { from: "h1", to: "m2", merge: true, step: 9 },
  { from: "d2", to: "d3", merge: false, step: 10 },
  { from: "h1", to: "d3", merge: true, step: 10 },
];

export const TAGS: GTag[] = [
  { node: "m1", name: "v1.0", step: 6 },
  { node: "m2", name: "v1.0.1", step: 9 },
];

export type GitFrame = {
  step: number;
  nodes: GNode[];
  edges: GEdge[];
  tags: GTag[];
  /** 이번 프레임에서 새로 생긴 노드 id */
  fresh: string[];
  caption: string;
};

const CAPS = [
  "main 에는 첫 커밋만 있습니다. main 은 늘 배포할 수 있는 상태를 가리킵니다.",
  "main 에서 develop 을 갈라냅니다. 다음 릴리스에 들어갈 변경이 여기로 모입니다.",
  "develop 에서 feature/login 을 만들어 커밋을 쌓습니다.",
  "git merge --no-ff 로 develop 에 합칩니다. 합류 지점이 merge 커밋으로 남습니다.",
  "릴리스할 기능이 모이면 develop 에서 release/1.0 을 만듭니다. develop 은 다음 기능을 계속 받을 수 있습니다.",
  "release/1.0 에서는 버전 번호 수정과 마지막 버그 수정 같은 마무리 커밋만 합니다.",
  "release/1.0 을 main 에 --no-ff 로 합치고 v1.0 태그를 붙입니다.",
  "release 에서 고친 내용이 develop 에도 있어야 하므로 develop 에도 합칩니다.",
  "운영에서 버그가 나면 main 에서 hotfix/1.0.1 을 만들어 바로 고칩니다.",
  "hotfix/1.0.1 을 main 에 합치고 v1.0.1 태그를 붙입니다.",
  "같은 수정을 develop 에도 합칩니다. 끝난 release 와 hotfix 브랜치는 지웁니다.",
  "main 에는 v1.0 과 v1.0.1 태그가 남았고, develop 은 release 와 hotfix 를 모두 받았습니다.",
];

export function gitflowFrames(): GitFrame[] {
  return CAPS.map((caption, i) => {
    const step = Math.min(i, 10);
    return {
      step,
      nodes: NODES.filter(n => n.step <= step),
      edges: EDGES.filter(e => e.step <= step),
      tags: TAGS.filter(t => t.step <= step),
      fresh: i > 10 ? [] : NODES.filter(n => n.step === step).map(n => n.id),
      caption,
    };
  });
}
