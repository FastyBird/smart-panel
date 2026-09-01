# Managed Extension Services — Implementation Plan

**Goal:** Make the Extensions → Services view a reliable inventory and control surface for every independently
restartable backend runtime owned by either a module or a plugin.

**Architecture:** Generalize the plugin-only lifecycle manager into an extension-owned service manager. Every managed
service identifies an owner kind (`module` or `plugin`), owner type, service ID, and activation policy. Existing startup
ordering, readiness validation, runtime counters, health checks, config reactions, CLI controls, API controls, and
factory-reset shutdown remain centralized. Internal cleanup timers, request handlers, registry-only providers, and
subcomponents already owned by a parent managed service remain outside the inventory.

**Audit basis:** The repository currently registers 15 plugin services. Missing independent runtimes are the mDNS
advertisement, Buddy heartbeat, Weather refresh job, Spaces Home Control suggestion heartbeat, and Home Assistant mDNS
discovery. Module services cannot currently participate because the manager always resolves plugin configuration and
ignores module configuration events.

## Global constraints

- Do not edit generated OpenAPI, admin API, panel API, or panel spec files manually. Change backend Swagger sources and
  run the repository generators.
- Preserve tab indentation, import ordering, response envelopes, schema naming, and controller decorator ordering.
- Do not register ordinary caches, debounce timers, one-shot loaders, Nest cron handlers, HTTP request handlers, or
  subordinate adapters already controlled by a parent managed service.
- Keep start, stop, and restart idempotent and safe during transitional states.
- Keep CLI mode from starting managed runtimes.
- Preserve reverse-order shutdown and factory-reset behavior.
- Do not push to `main`; implementation remains in the current feature worktree unless the user asks otherwise.
- Add no dependencies.

## Managed-service admission rule

A component belongs in the service manager only when all of these are true:

1. It owns a persistent connection, server, external resource, hardware poller, discovery browser, or business heartbeat.
2. It has a meaningful independent start/stop boundary.
3. An administrator can reasonably remediate a fault by starting or restarting it.
4. Its desired state can be derived from an extension owner or an explicit activation policy.

The Shelly WebSocket server, Shellies adapter, WLED discoverer, Zigbee transports, reTerminal button handler, and
simulator behavior timer remain children of their existing managed parent service.

## Delivery and delegation map

| Task | Outcome | Dependencies | Model / effort | File ownership |
| --- | --- | --- | --- | --- |
| MS-1 | Generic module/plugin service registry, API, CLI, stats, and manager tests | none | `gpt-5.6-sol` / high | Extensions backend and existing service identity call sites |
| MS-2 | mDNS, Buddy, and Weather managed module runtimes | MS-1 | `gpt-5.6-terra` / high | mDNS, Buddy, Weather, bootstrap files |
| MS-3 | Spaces heartbeat and HA discovery managed plugin runtimes | MS-1 | `gpt-5.6-terra` / high | Spaces Home Control and Home Assistant plugin files |
| MS-4 | Health checks and registration/inventory regression coverage | MS-1 | `gpt-5.6-luna` / medium | Existing managed service implementations and focused tests |
| MS-5 | Admin UI, OpenAPI generation, panel client regeneration, cross-surface tests | MS-1–MS-4 | `gpt-5.6-terra` / high | Admin extensions UI/store, generated outputs via commands |
| MS-6 | Integrated verification and targeted fixes | MS-1–MS-5 | coordinator | Any file only after worker handoff |

Workers must not broaden scope, overwrite unrelated changes, commit, or modify files assigned to another running worker.

---

## MS-1: Generalize managed-service ownership

### Contract

Introduce a generic managed extension service contract with:

```typescript
type ManagedServiceOwnerKind = 'module' | 'plugin';
type ManagedServiceActivationPolicy = 'owner-enabled' | 'always';

interface ManagedServiceOwner {
	kind: ManagedServiceOwnerKind;
	type: string;
}

interface IManagedExtensionService {
	readonly owner: ManagedServiceOwner;
	readonly serviceId: string;
	readonly activationPolicy?: ManagedServiceActivationPolicy;
	start(): Promise<void>;
	stop(): Promise<void>;
	getState(): ServiceState;
	getPriority?(): number;
	getDependencies?(): string[];
	isHealthy?(): Promise<boolean>;
	onConfigChanged?(): Promise<void | ConfigChangeResult>;
}
```

Implementation may retain deprecated aliases temporarily inside the backend, but the authoritative runtime key is:

```text
<owner-kind>:<owner-type>:<service-id>
```

Dependency keys must use the same format.

### Manager behavior

- Rename/generalize the manager and base service without losing existing lifecycle protections.
- Resolve desired state using `getModuleConfig()` or `getPluginConfig()` according to owner kind.
- `owner-enabled` services follow the extension's `enabled` value.
- `always` services start regardless of owner enabled state and may be manually restarted.
- Route config events only to services with the matching owner kind and type.
- Validate plugin configuration with the existing plugin validator. Module services do not use the plugin validator.
- Preserve late registration, startup levels, priorities, dependency sorting, retry handling, runtime counters, manual
  actions, shutdown, and factory reset.
- Ensure old plugin registrations are fully migrated or covered by a short-lived compatibility adapter with deprecation
  tests. Do not leave mixed external API semantics.

### API and CLI

- Replace `plugin_name` with `extension_kind` and `extension_type` in the service status model.
- Add `activation_policy` and `desired_state` (`started` or `stopped`).
- Change item/action routes to include owner kind:

```text
GET  /modules/extensions/services
GET  /modules/extensions/services/:extensionKind/:extensionType/:serviceId
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/start
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/stop
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/restart
```

- Update CLI arguments/output and extension service statistics labels.
- Use standard response models and Swagger schema conventions.

### Tests

- Module and plugin owner registration.
- Both activation policies.
- Matching and non-matching module/plugin config events.
- Manual actions and disabled-owner behavior.
- Duplicate key detection across owner kinds.
- Dependencies and startup ordering with the new key format.
- CLI-mode behavior, shutdown, and factory-reset behavior.
- Controller and CLI route/argument coverage.

**Verification:** Targeted Extensions Jest tests and backend TypeScript lint/type checking.

---

## MS-2: Register module-owned runtimes

### mDNS advertisement

- Convert `MdnsService` or wrap it as a managed extension service.
- Owner: `{ kind: 'module', type: MDNS_MODULE_NAME }`.
- Service ID: `advertisement`.
- Activation policy: `owner-enabled`.
- Start with the configured backend port and stop with the existing Bonjour cleanup.
- Health means the advertisement is active and has a published service record.
- Return `restartRequired: true` when service name or service type changes.
- Remove direct unmanaged advertisement startup from `main.ts`.
- Because the advertisement should not publish before the HTTP server is ready, introduce the smallest explicit readiness
  signal necessary. Do not delay every managed connector solely for mDNS.
- Remove mDNS from `NON_TOGGLEABLE_MODULES` so its existing enabled configuration controls advertisement while the Nest
  module itself remains loaded.

### Buddy heartbeat

- Owner: `{ kind: 'module', type: BUDDY_MODULE_NAME }`.
- Service ID: `heartbeat`.
- Activation policy: `owner-enabled`.
- Move interval creation/deletion into idempotent `start()` and `stop()` methods.
- Do not allocate an interval while Buddy is disabled.
- Restart when `heartbeatIntervalMs` changes.
- Health means the expected SchedulerRegistry interval exists and no cycle is permanently wedged.
- Keep evaluator registration independent of runtime start.

### Weather refresh

- Owner: `{ kind: 'module', type: WEATHER_MODULE_NAME }`.
- Service ID: `refresh`.
- Activation policy: `owner-enabled`.
- Move the hourly CronJob start/stop boundary out of `OnApplicationBootstrap` into idempotent managed lifecycle methods.
- Keep the existing fixed hourly schedule and refresh behavior unchanged.
- Health means the managed service is started and the registered CronJob is active; do not call weather providers from
  a health check.
- A primary-location configuration change does not require a restart because it does not alter the schedule.

### Tests

- Registration from each module.
- Disabled startup and enable/disable config transitions.
- mDNS advertise/stop/reconfigure/readiness behavior.
- Buddy interval start/stop/reconfigure and overlapping-cycle protection.
- Weather CronJob start/stop/idempotency and health behavior.
- Shutdown cleanup.

**Verification:** Targeted mDNS, Buddy, Weather, and manager tests.

---

## MS-3: Register missing plugin-owned runtimes

### Spaces Home Control suggestion heartbeat

- Owner: `{ kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME }`.
- Service ID: `suggestion-heartbeat`.
- Activation policy: `owner-enabled`.
- Convert bootstrap interval creation into idempotent `start()` and `stop()`.
- Register from `SpacesHomeControlPlugin.onModuleInit()`.
- Health means the SchedulerRegistry interval exists and the service is not stuck in a transitional state.
- Disabling the plugin must remove the interval.

### Home Assistant mDNS discovery

- Owner: `{ kind: 'plugin', type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME }`.
- Service ID: `discovery`.
- Activation policy: `always`, because discovery is needed before connector configuration/enabling.
- Remove automatic `OnModuleInit` startup and register it beside the existing `connector` service.
- Make start/stop asynchronous and idempotent as required by the generic contract.
- Preserve the manual discovery refresh endpoint by routing refresh through stop/start or the manager.
- Health means the Bonjour browser is active.
- A disabled HA plugin must show `connector` stopped and `discovery` started without disabling discovery controls.

### Tests

- Plugin registration assertions for both services.
- Enable/disable behavior for owner-enabled heartbeat.
- Always-active discovery startup while the plugin is disabled.
- Discovery manual restart and shutdown cleanup.
- Status response distinguishes the two HA services and their activation policies.

**Verification:** Targeted Spaces Home Control and Home Assistant Jest tests.

---

## MS-4: Health coverage and inventory regression protection

Add meaningful, bounded `isHealthy()` checks to registered services that currently expose only lifecycle state:

- Home Assistant connector: authenticated open WebSocket.
- reTerminal: initialized device plus active polling/hardware runtime.
- Shelly NG: manager initialized and required timers/server active.
- Shelly V1: Shellies adapter started.
- WLED: connector state plus required discovery/polling runtime.
- Zigbee2MQTT: active adapter connected.
- Discord, Telegram, WhatsApp: provider-specific ready/connected state.
- Rotating file logger: writable active transport.
- Simulator: initialized runtime and required timers consistent with configuration.

Health checks must not perform slow network probes on every services-list request. Use live transport state or a short,
bounded probe only where no reliable state exists.

Add an integration-level registration inventory test asserting all expected keys:

- 15 existing managed plugin services migrated to generic owner keys.
- mDNS advertisement.
- Buddy heartbeat.
- Weather refresh.
- Spaces suggestion heartbeat.
- Home Assistant discovery.

Also add plugin/module bootstrap registration assertions where practical so omission is caught close to the owner.

**Verification:** Targeted service tests and the new inventory test.

---

## MS-5: Admin, OpenAPI, and generated clients

- Update the admin services store, schemas, transformers, composables, actions, and keys for extension kind/type.
- Update action calls to the new routes.
- Group the Services view into Modules and Plugins.
- Show friendly extension names where available, with internal type and service ID secondary.
- Display activation policy and desired state.
- Explain that an `always` service can run while its owning extension is disabled.
- Preserve loading, polling, action semaphores, transition disabling, error display, uptime, and toast behavior.
- Add tests for module/plugin grouping, route parameters, always-active services, unhealthy states, and actions.
- Run `pnpm run generate:openapi` from backend Swagger sources.
- Run the required panel client rebuild command if OpenAPI generation changes `apps/panel/lib/api/`.
- Never hand-edit generated output.

**Verification:** Admin unit tests, backend OpenAPI generation checks, and generated-client consistency.

---

## MS-6: Integrated verification

Run, in increasing scope:

```bash
pnpm --filter ./apps/backend exec jest --runInBand <targeted specs>
pnpm --filter ./apps/admin run test:unit -- <targeted specs>
pnpm run lint:js
pnpm run test:unit
pnpm --filter ./apps/admin run test:unit
```

Run `melos analyze` when generated panel API code changes and the Flutter toolchain is available.

Manual acceptance matrix:

- Enabled plugin service starts at boot and is visible.
- Disabled plugin service stays stopped.
- Enabled module service starts at boot and is visible.
- Disabling Buddy stops and removes its heartbeat interval.
- Disabling Spaces Home Control stops and removes its heartbeat interval.
- HA discovery remains running while its connector/plugin is disabled.
- mDNS disable removes the advertisement; re-enable republishes it after HTTP readiness.
- Weather refresh can be stopped and restarted without duplicating its hourly CronJob.
- Config changes restart only services owned by the changed extension.
- Manual restart updates runtime timestamps, count, state, error, and health.
- Shutdown and factory reset stop every non-stopped service in reverse order.

## Completion criteria

- The service inventory contains 20 expected managed runtimes with module/plugin ownership.
- No admitted runtime starts outside the manager except an explicit manager readiness trigger.
- Every listed service has a meaningful health result.
- Module and plugin config changes drive only their owned services.
- Admin controls work for both owner kinds and both activation policies.
- Generated artifacts are current and all available verification commands pass.
