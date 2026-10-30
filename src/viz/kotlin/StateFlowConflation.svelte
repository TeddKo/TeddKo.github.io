<script lang="ts">
  import Player from "../Player.svelte";
  import { stateflowFrames, type StateflowFrame } from "./stateflowFrames";

  const frames = stateflowFrames();
</script>

{#snippet frame(f: StateflowFrame)}
  <div class="wrap">
    <div class="row">
      <div class="box">
        <h4>producer</h4>
        <div class="pill" class:on={f.producer !== null}>{f.producer === null ? "-" : `value = ${f.producer}`}</div>
        <small>빠름: 기다리지 않고 값을 대입</small>
      </div>
      <b class="arr" class:on={f.flow === "in"}>→</b>
      <div class="box mid">
        <h4>StateFlow</h4>
        <span class="val">{f.value}</span>
        <small>최신 값 하나만 보관</small>
      </div>
      <b class="arr" class:on={f.flow === "out"}>→</b>
      <div class="box">
        <h4>collector</h4>
        <div class="pill" class:on={f.busy}>{f.busy ? "busy (느린 작업)" : "idle"}</div>
        <small>받은 값</small>
        <div class="dots">
          {#each f.received as v}<span class="d">{v}</span>{/each}
        </div>
        <small>건너뜀</small>
        <div class="dots">
          {#each f.skipped as v}<span class="d dash">{v}</span>{/each}
        </div>
      </div>
    </div>
    <div class="sets">
      <small>생산자가 대입한 값</small>
      <div class="dots">
        {#each f.sets as s}<span class="num" class:ign={s.ignored}>{s.v}</span>{/each}
      </div>
    </div>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .wrap {
    display: grid;
    gap: 0.5rem;
    font-family: var(--font-mono);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1.2fr;
    align-items: center;
    gap: 0.2rem;
  }
  .box {
    display: grid;
    gap: 0.25rem;
    align-content: start;
    justify-items: center;
    min-height: 10.5rem;
    padding: 0.4rem 0.25rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    min-width: 0;
    text-align: center;
  }
  .mid {
    border-color: var(--viz-ink);
  }
  h4 {
    margin: 0;
    font-size: 0.7rem;
    color: var(--viz-ink);
  }
  small {
    color: var(--viz-muted);
    font-size: 9.5px;
    line-height: 1.2;
  }
  .pill {
    max-width: 100%;
    padding: 0.2em 0.35em;
    border: 1px solid var(--viz-rule);
    border-radius: 4px;
    color: var(--viz-muted);
    font-size: 9.5px;
    overflow-wrap: anywhere;
  }
  .pill.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .val {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: 1px solid var(--viz-accent);
    border-radius: 50%;
    background: var(--viz-tint);
    color: var(--viz-ink);
    font-size: 1.4rem;
    font-weight: 700;
  }
  .arr {
    color: var(--viz-muted);
    font-size: 0.9rem;
  }
  .arr.on {
    color: var(--viz-accent);
  }
  .dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
    min-height: 1.5rem;
  }
  .d {
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border: 1px solid var(--viz-ink);
    border-radius: 50%;
    color: var(--viz-ink);
    font-size: 0.65rem;
    font-weight: 700;
  }
  .d.dash {
    border-style: dashed;
    border-color: var(--viz-muted);
    color: var(--viz-muted);
  }
  .sets {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
  }
  .sets .dots {
    justify-content: flex-start;
    gap: 0.6rem;
    min-height: 1.3rem;
  }
  .num {
    color: var(--viz-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .num.ign {
    color: var(--viz-muted);
    font-weight: 400;
  }
</style>
