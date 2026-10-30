export const CATEGORIES = [
  "cs",
  "data-structure",
  "algorithm",
  "kotlin",
  "dart",
  "java",
  "swift",
  "android",
  "flutter",
  "cmp",
  "react-native",
  "server",
  "etc",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const MOBILE_SUBS = [
  "android",
  "flutter",
  "cmp",
  "react-native",
] as const satisfies readonly Category[];

export const LANGUAGE_SUBS = [
  "kotlin",
  "dart",
  "java",
  "swift",
] as const satisfies readonly Category[];
