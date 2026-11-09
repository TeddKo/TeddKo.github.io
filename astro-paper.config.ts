import { defineAstroPaperConfig } from "./src/types/config";
import raw from "./src/data/site.json";

export default defineAstroPaperConfig({
  ...raw,
  site: { ...raw.site, dir: raw.site.dir as "ltr" | "rtl" | "auto" },
  features: {
    ...raw.features,
    editPost: raw.features.editPost as
      | { enabled: true; url: string }
      | { enabled: false },
    search: raw.features.search as "pagefind" | false,
  },
});
