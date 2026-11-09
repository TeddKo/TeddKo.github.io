export const CODE = [
  "String? name = getName();",
  "if (name != null) {",
  "  print(name.length);",
  "}",
  "print(name.length);",
];

export type PromotionFrame = {
  line: number;
  type: "String?" | "String";
  promoted: boolean;
  note: string;
  caption: string;
};

export function promotionFrames(): PromotionFrame[] {
  return [
    {
      line: 0,
      type: "String?",
      promoted: false,
      note: "getName() 은 null 일 수 있습니다",
      caption: "name 은 선언 직후 String? 입니다",
    },
    {
      line: 1,
      type: "String?",
      promoted: false,
      note: "name != null 을 검사합니다",
      caption: "null 검사를 거치는 중입니다",
    },
    {
      line: 2,
      type: "String",
      promoted: true,
      note: "if 안에서 승격됩니다 · name.length 사용 가능",
      caption:
        "null 검사 뒤에는 같은 변수가 non-nullable 타입 String 으로 취급됩니다",
    },
    {
      line: 4,
      type: "String?",
      promoted: false,
      note: "승격이 끝났습니다 · String? 에는 length 가 없어 컴파일 오류",
      caption: "if 블록을 벗어나면 name 은 다시 String? 입니다",
    },
  ];
}
