import data from "./skills.json";

export interface Skill {
  eyebrow: string;
  title: string;
  body: string;
  summary: string;
  metric: {
    top?: string;
    from?: number;
    pre?: string;
    n?: number;
    dec?: number;
    suf?: string;
    text?: string;
    quote?: boolean;
    label: string;
  };
}

export const skills: Skill[] = data;
