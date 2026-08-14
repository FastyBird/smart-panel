# Buddy Adaptive Context — Phase 0 Baseline

Date: 2026-08-14
Plan: [plan-buddy-adaptive-context.md](./plan-buddy-adaptive-context.md)

## Purpose

This baseline characterizes the current eager Buddy conversation path before the provider-neutral retrieval work begins.
It is deliberately a green test suite: known budget failures are asserted as measured current behavior, not left as
failing CI tests.

The deterministic corpus covers all 16 message classes from the plan. Today every row— including greetings, general
questions, unsupported requests, and single-domain queries—calls `BuddyContextService.buildContext(...)` exactly once
before provider dispatch. The future strategy/domain expectations are checked in at
`apps/backend/src/modules/buddy/testing/buddy-context-evaluation.matrix.ts` and remain stable through the later phases.

## Measurement Method

- Scale fixtures contain 10, 100, and 1,000 devices; each device has three channels and five realistic boolean/numeric
  properties in both raw entity and flattened `BuddyContext` forms.
- Native request measurements use the same pure payload builders used by the production OpenAI Chat, Anthropic, Ollama,
  and OpenAI Codex adapters.
- Request byte counts use compact JSON and UTF-8 `Buffer.byteLength`.
- The Phase 0 conservative estimate is `ceil(JSON UTF-8 bytes / 3)`. It is intentionally stricter than the legacy
  four-characters-per-token prompt estimate and is not presented as an exact provider tokenizer.
- The measured OpenAI request contains the system prompt, 19 stored history rows, the current user message, four nested
  read/write/trigger tool schemas, provider framing, and a 1,024-token output cap.
- Component byte/token measurements are diagnostic partitions. JSON framing overlaps, so component totals are not
  expected to add exactly to the whole request.

## Complete Native Request Baseline

The table below uses a 128,000-token model window so it records size without rejecting the request.

| Devices | Native JSON bytes | Conservative input tokens | System tokens | History tokens | Current tokens | Tool-schema tokens | Fits 128k |
| ------: | ----------------: | ------------------------: | ------------: | -------------: | -------------: | -----------------: | :-------: |
|      10 |             8,108 |                     2,693 |         1,422 |            674 |             29 |                557 |    yes    |
|     100 |            22,669 |                     7,547 |         6,276 |            674 |             29 |                557 |    yes    |
|   1,000 |             4,853 |                     1,608 |           337 |            674 |             29 |                557 |    yes    |

The 1,000-device request is smaller than the 100-device request because the current renderer drops into coarse space
summaries. That keeps bytes down but loses target/state coverage; it is not evidence that the eager snapshot scales.
The full 1,000-device snapshot is still loaded before this truncation occurs.

### Measured small-window violation

For a 2,000-token window with a 1,024-token output reserve, 32 framing tokens, and a 128-token safety margin:

| Available input | Measured input | Native JSON bytes | Result                      |
| --------------: | -------------: | ----------------: | --------------------------- |
|      816 tokens |   2,693 tokens |       8,108 bytes | over budget by 1,877 tokens |

The legacy system-prompt-only check still reports the prompt at or below its 1,600-token allocation. The complete native
request proves that history, the current message, schemas, framing, and output reserve make the provider call invalid for
the configured window.

## Current Query Footprint

The characterization tests pin service-level calls without pretending that mocks are SQL-query measurements.

| Scope        | Current calls                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Global       | `spaces.findAll` ×1, `spaces.findDevicesBySpace` × number of spaces, `devices.findAll` ×1, `scenes.findAll` ×1, weather ×1, energy ×1 |
| Space-scoped | `spaces.findOne` ×1, `spaces.findDevicesBySpace` ×2 (count plus detail), `scenes.findBySpace` ×1, weather ×1, energy ×1               |

The 1,000-device scoped characterization also proves that the last device, channel, property, and flattened state value
reach the broad snapshot unchanged. Heartbeat forwards that exact `BuddyContext` object to every registered evaluator;
individual evaluators continue to consume only the fields relevant to their rules.

## Opt-in Scale/Latency Soak

Run with `pnpm --filter @fastybird/smart-panel-backend run test:buddy-context-soak`. It is isolated from the normal Jest
test regex and uses in-memory domain mocks, so its latency is a mapping/serialization baseline rather than a database or
production SLA.

| Devices | Properties | Spaces | Serialized snapshot bytes | Build duration | Additional heap | Space-count calls |
| ------: | ---------: | -----: | ------------------------: | -------------: | --------------: | ----------------: |
|      10 |         50 |     10 |                     8,161 |        0.89 ms |    0 B measured |                10 |
|     100 |        500 |     20 |                    73,621 |        0.40 ms |       298,392 B |                20 |
|   1,000 |      5,000 |     20 |                   720,474 |        1.56 ms |     2,451,856 B |                20 |
|   5,000 |     25,000 |     20 |                 3,594,780 |        4.33 ms |    11,703,528 B |                20 |

The opt-in guardrails are 30 seconds and 512 MiB additional heap per row. They are intentionally generous and detect
runaway fixture/query behavior without turning machine-dependent microbenchmarks into normal CI failures.

## Failure and Provider-Cap Characterization

- Optional home-domain failures are omitted by `BuddyContextService` and the provider request continues with partial
  context.
- Provider failure aborts before user/assistant message persistence.
- Current tool feedback carries status and message text only; structured `ToolExecutionResult.data` remains a later-phase
  gap.
- OpenAI Chat and Anthropic payloads enforce the requested native output cap.
- Ollama and OpenAI Codex currently omit a native output cap. Phase 5 must close that gap; Phase 0 records it without
  changing provider behavior.

## Verification Commands

```bash
cd apps/backend
pnpm exec jest --runInBand \
  src/modules/buddy/testing/llm-request-measurement.helper.spec.ts \
  src/modules/buddy/services/buddy-context.service.spec.ts \
  src/modules/buddy/services/heartbeat.service.spec.ts \
  src/modules/buddy/services/buddy-conversation.service.spec.ts
pnpm run test:buddy-context-soak
pnpm run type-check
pnpm run lint:js
```

Phase 7 promotes the measured over-budget fixture into a required passing bounded-request assertion. The production
conversation switch must keep the same message corpus while replacing `currentEagerSnapshot: true` with the expected
strategy/domain assertions.
