# Automations spike (AU-0)

Throwaway code from the spike for the automations epic (GitHub #1556). It is kept as reference for the people
implementing AU-3, AU-4, AU-10 and AU-15. Nothing here is built, linted or shipped, and no production code may
import from this folder.

Results and the decisions taken from them: [`docs/adr/0003-automations-spike-and-decisions.md`](../../adr/0003-automations-spike-and-decisions.md).

## `engine/` — engine semantics prototype

Plain TypeScript, no dependencies, about 1,300 lines of prototype and 1,400 lines of tests. It models the graph
validator, the state tracker, the token walk, run modes, guards, joins, wait-until and the safety hook against a
fake event bus and fake devices. It was run with Node's type stripping and has never been through `tsc`.

```bash
cd docs/work/automations-spike/engine
node --test tracker.test.ts engine.test.ts reference.test.ts   # Node >= 24; 99 tests
```

Test names prefixed `RULE:` or `SPIKE RULE:` mark rules chosen where the design was silent. `FINDING:` marks
behaviour that follows from the design as first written and is probably unwanted. `reference.test.ts` holds the
motion-light scenario in both modellings and the run-mode matrix.

## `canvas/` — Vue Flow in the admin build

The admin spike as it was when measured: `@vue-flow/core` 1.48.2, `@vue-flow/background` 1.3.2,
`@vue-flow/controls` 1.1.3, a standalone `spike.html` entry built through the admin's own Vite config, and the
Playwright scripts that produced the evidence.

- `src/` was `apps/admin/src/modules/automations-spike/`; `spike.html`, `spike.main.ts` and `vite.spike.config.ts`
  sat in `apps/admin/` and `apps/admin/src/`.
- `tests/` are plain Node scripts using the globally installed Playwright (`desktop.cjs`, `touch.cjs`,
  `modes.cjs`, with `serve.cjs` as a static server).
- `screenshots/` shows the reference scenario in light mode, in dark mode with the configuration drawer open, and
  read-only at phone width.

To run it again, copy the files back to those locations, add the three packages at the versions above with
`pnpm --filter @fastybird/smart-panel-admin add -E`, and follow the commands in the ADR's evidence section. Note
that `pnpm add` also rewrote unrelated lockfile entries during the spike; review the lockfile diff before
committing.
