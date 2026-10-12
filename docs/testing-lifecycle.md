# Test ownership and component runtime

## Nest test modules

The suite or test that compiles a `TestingModule` owns its teardown. Await `module.close()` in `afterEach` for modules created in `beforeEach`, or in `afterAll` for modules shared by a suite. Close a module created by an individual test in `finally`, or register it in a suite-owned collection closed by `afterEach`, so assertion failures also release it. Factories that create more than one module per test must retain every instance. An application created from the module owns that teardown through `app.close()`; do not close the same module twice.

Close the module before restoring mocks or removing its database fixtures, so lifecycle hooks can use their dependencies. Order fake timer cleanup deliberately when a shutdown hook needs real timers. Teardown failures should fail the test. Do not use `forceExit` to conceal timers, listeners, or open connections.

For a reused setup binding, take its current module and clear the binding before awaiting `close()`. A later failed compilation must not close the previous test's module again. Drain per-test module collections before awaiting their close operations for the same reason.

## Admin component budgets

Keep Vitest's default 5-second timeout for ordinary tests. Two component suites retain a 15-second per-test exception:

- `virtual-wizard-mapping-step.spec.ts` mounts the real mapping component, Element Plus selects, expanded category slots, and compatibility requests.
- `view-virtual-device-wizard.spec.ts` drives the real four-step wizard, including mapping, creation, and navigation guards.

Every wrapper owned by these suites is unmounted after each test. The mapping fixture imports the production error decoder directly instead of loading the entire common UI/service barrel. The real component flows and compatibility assertions remain covered.

The exception absorbs parallel machine load; it is not a license to grow test work. Investigate any case approaching 15 seconds before changing its budget. A new exception requires measurements of individual case durations both in a focused run and the complete suite, plus a check for missing teardown and unnecessary setup/import work. Do not raise the global timeout or every suite's budget.

### Measurements

Recorded on 2026-10-12 using Node 24.15.0 and Vitest 4.1.0. These are wall-clock observations on a development machine with concurrent agent work, rather than isolated performance benchmarks.

| Run                                                                      | Mapping: 39 cases, longest case | Wizard: 18 cases, longest case |
| ------------------------------------------------------------------------ | ------------------------------- | ------------------------------ |
| Before fixture changes, two-file run                                     | 4.80 s                          | 3.70 s                         |
| After cleanup/import changes, two workers under concurrent type checking | 6.86 s                          | 8.67 s                         |
| Complete admin suite, four workers                                       | 11.41 s                         | 7.54 s                         |

The complete admin run passed all 3,635 tests. The loaded measurements exceed the default 5-second budget and fit within the existing 15-second bound. Teardown adds deliberate cleanup work; the table does not claim a speed improvement from this change.

Reproduce the focused measurement with:

```bash
pnpm --filter ./apps/admin exec vitest run \
  src/plugins/devices-virtual/components/wizard/virtual-wizard-mapping-step.spec.ts \
  src/plugins/devices-virtual/views/view-virtual-device-wizard.spec.ts \
  --maxWorkers=2 --reporter=json --outputFile=/tmp/admin-heavy-tests.json
```

Use `assertionResults[].duration` in the JSON report to examine individual cases. Validate the complete suite with a bounded worker count suitable for the host (four workers were used for the completion check); excessive worker contention can obscure a test's own runtime. CI keeps its existing coverage command and worker configuration.
