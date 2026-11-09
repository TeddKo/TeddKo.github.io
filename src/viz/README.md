# Interactive visualizations

Replace an animated GIF in a post with a Svelte player. The post stays `.md`
and its prose is untouched; the GIF `<img>` remains in the DOM as a fallback.

## Add one

1. **Frames** (`src/viz/<group>/<name>Frames.ts`): pure TS, no DOM. Return an
   array of frames (state + counters + a caption string). The data must match
   the fact-checked GIF: same input, same legend, same final counters.
   Add a `scripts/check-<name>.ts` that asserts the final counters, run with
   `node --experimental-strip-types scripts/check-<name>.ts`.
2. **Component** (`src/viz/<group>/<Name>.svelte`): build the frames, then render
   `<Player {frames} {frame} caption={f => f.caption} />` with a `frame`
   snippet drawing one frame (SVG with a `viewBox`, so it scales to width).
   Colors come from the `--viz-*` vars set by `Player.svelte`
   (`--viz-accent` compare, `--viz-blue` swap/write, `--viz-muted` sorted,
   `--viz-rule` idle, `--viz-ink`). Never hardcode colors, so dark mode works.
3. **Registry** (`src/viz/registry.ts`): one line, the GIF basename without
   hash or extension:
   `"sort-quick": () => import("./sort/Quick.svelte"),`

That is all. `src/scripts/viz.ts` (loaded by `PostLayout.astro`) finds
`#article img` whose src starts with `/<basename>.`, lazy-loads the component
near the viewport, mounts it before the img and hides the img. It unmounts on
`astro:before-swap` and re-inits on `astro:page-load`.
