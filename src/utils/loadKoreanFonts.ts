import { readFile } from "node:fs/promises";

const load = (file: string) =>
  readFile(`${process.cwd()}/src/assets/fonts/${file}`);

export async function loadKoreanFonts() {
  const [regular, bold] = await Promise.all([
    load("Pretendard-Regular.otf"),
    load("Pretendard-Bold.otf"),
  ]);
  return [
    {
      name: "Pretendard",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Pretendard",
      data: bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}
