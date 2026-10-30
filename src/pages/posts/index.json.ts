import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import { toTransitionName } from "@/utils/toTransitionName";
import { slugifyStr } from "@/utils/slugify";
import { useTranslations } from "@/i18n";
import config from "@/config";

dayjs.extend(utc);
dayjs.extend(timezone);

export const GET: APIRoute = async () => {
  const t = useTranslations(config.site.lang);
  const posts = getSortedPosts(
    await getCollection("posts", ({ data }) => !data.draft)
  );
  const index = posts.map(({ id, filePath, data }) => {
    const modified = !!data.modDatetime && data.modDatetime > data.pubDatetime;
    const d = dayjs(modified ? data.modDatetime : data.pubDatetime).tz(
      data.timezone ?? config.site.timezone
    );
    return {
      title: data.title,
      url: getPostUrl(id, filePath),
      tname: toTransitionName(id),
      description: data.description,
      category: data.category,
      categoryLabel: t.categories.labels[data.category],
      featured: !!data.featured,
      tags: data.tags.map(name => ({ slug: slugifyStr(name), name })),
      modified,
      date: d.format("YYYY.MM.DD"),
      iso: d.toISOString(),
    };
  });
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  });
};
