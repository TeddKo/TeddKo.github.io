import data from "./projects.json";

export interface Project {
  title: string;
  period: string;
  description: string;
  tags: string[];
  url?: string;
  detailUrl?: string;
}

export const projects: Project[] = data;
