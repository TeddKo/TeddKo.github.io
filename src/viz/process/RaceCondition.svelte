<script lang="ts">
  import Player from "../Player.svelte";
  import { raceFrames, SLOTS, type RaceFrame, type Thread } from "./raceFrames";

  const frames = raceFrames();
  const threads: Thread[] = ["A", "B"];
  const code = ["LOAD  reg <- counter", "ADD   reg <- reg + 1", "STORE counter <- reg"];
</script>

{#snippet frame(f: RaceFrame)}
  <div class="wrap">
    <div class="mem" class:on={f.result}>
      <span>shared memory</span>
      <b>counter</b>
      <strong>{f.counter}</strong>
    </div>
    <div class="threads">
      {#each threads as t}
        <div class="card" class:on={f.running === t}>
          <h4>Thread {t}</h4>
          {#each code as c, i}
            <div class="ins" class:on={f.line[t] === i}>{c}</div>
          {/each}
          <div class="reg">reg = <b>{f.reg[t] ?? "?"}</b></div>
        </div>
      {/each}
    </div>
    <ol class="time" aria-label="시간 순서">
      {#each SLOTS as s, i}
        <li class:past={i < f.done - 1} class:now={i === f.done - 1}>
          <i></i>{s}
        </li>
      {/each}
    </ol>
  </div>
{/snippet}

<Player {frames} {frame} caption={f => f.caption} />

<style>
  .wrap {
    container-type: inline-size;
    display: grid;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: clamp(9.5px, 3.4cqw, 13px);
  }
  .mem {
    justify-self: center;
    min-width: 40%;
    padding: 0.4rem 0.75rem;
    text-align: center;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    background: var(--viz-tint);
    color: var(--viz-muted);
    display: grid;
  }
  .mem.on {
    border-color: var(--viz-accent);
  }
  .mem b {
    color: var(--viz-ink);
  }
  .mem strong {
    font-size: 2.4em;
    line-height: 1.1;
    color: var(--viz-ink);
  }
  .mem.on strong {
    color: var(--viz-accent);
  }
  .threads {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13.5rem), 1fr));
    gap: 0.4rem;
  }
  .card {
    padding: 0.35rem;
    border: 1px solid var(--viz-rule);
    border-radius: 6px;
    min-width: 0;
  }
  .card.on {
    border-color: var(--viz-accent);
  }
  h4 {
    margin: 0 0 0.25rem;
    font-size: 1.05em;
    color: var(--viz-ink);
  }
  .ins {
    padding: 0.2em 0.3em;
    margin-bottom: 2px;
    border: 1px solid var(--viz-rule);
    border-radius: 3px;
    white-space: pre;
    overflow: hidden;
    color: var(--viz-ink);
  }
  .ins.on {
    border-color: var(--viz-accent);
    background: var(--viz-tint);
    color: var(--viz-accent);
  }
  .reg {
    margin-top: 0.3rem;
    text-align: center;
    color: var(--viz-muted);
  }
  .reg b {
    font-size: 1.3em;
    color: var(--viz-ink);
  }
  .time {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--viz-muted);
    font-size: 0.9em;
    text-align: center;
  }
  .time li {
    position: relative;
    padding-top: 1.1em;
  }
  .time i {
    position: absolute;
    top: 0;
    left: 50%;
    width: 0.7em;
    height: 0.7em;
    margin-left: -0.35em;
    border: 1px solid var(--viz-rule);
    border-radius: 50%;
    background: var(--background);
  }
  .time .past i {
    background: var(--viz-muted);
    border-color: var(--viz-muted);
  }
  .time .now {
    color: var(--viz-accent);
  }
  .time .now i {
    background: var(--viz-accent);
    border-color: var(--viz-accent);
  }
</style>
