<script lang="ts">
  import Player from "../Player.svelte";
  import { mountFrames, type MountFrame } from "./mountFrames";

  const frames = mountFrames();
</script>

{#snippet vt(f: MountFrame, n: string)}
  <span class="v" class:fill={f.hi === n && f.look === "mounted"} class:ring={f.hi === n && f.look !== "mounted"} class:ink={n === "V2"}
    >{n}</span
  >
{/snippet}

{#snippet frame(f: MountFrame)}
  <div class="grid">
    <div class="box dashed">
      <h4>ready queue</h4>
      {#each f.ready as n (n)}
        {@render vt(f, n)}
      {/each}
    </div>
    <div class="box">
      <h4>carrier threads</h4>
      {#each [["carrier-1", f.c1], ["carrier-2", f.c2]] as [name, v]}
        <div class="car">
          <small>{name}</small>
          {#if v}{@render vt(f, v)}{/if}
        </div>
      {/each}
    </div>
    <div class="box dashed">
      <h4>parked (heap)</h4>
      {#each f.parked as n (n)}
        {@render vt(f, n)}
      {/each}
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 2.2fr 1fr;
    gap: 0.4rem;
    font-family: var(--font-mono);
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    min-height: 11rem;
    padding: 0.4rem 0.25rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    min-width: 0;
  }
  .box.dashed {
    border-style: dashed;
  }
  h4 {
    margin: 0;
    color: var(--viz-muted);
    font-size: 0.62rem;
    font-weight: 400;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .car {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 3.2rem;
    border: 1px solid var(--viz-rule);
    border-radius: 4px;
  }
  .car small {
    position: absolute;
    top: 2px;
    left: 4px;
    color: var(--viz-muted);
    font-size: 9.5px;
  }
  .v {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid var(--viz-rule);
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--viz-muted);
  }
  .v.ink {
    border-color: var(--viz-ink);
    color: var(--viz-ink);
  }
  .v.ring {
    border: 2px solid var(--viz-accent);
    color: var(--viz-accent);
  }
  .v.fill {
    background: var(--viz-accent);
    border-color: var(--viz-accent);
    color: var(--background);
  }
</style>
