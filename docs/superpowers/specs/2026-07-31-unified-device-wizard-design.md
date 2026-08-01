# Unified Device Adoption Wizard — Design

**Status:** Approved
**Date:** 2026-07-31
**Author:** Adam Kadlec
**Related:** `docs/superpowers/specs/2026-04-30-zigbee2mqtt-device-wizard-design.md`

## Goal

Replace the three independently-written device adoption wizards (`devices-shelly-v1`, `devices-shelly-ng`, `devices-zigbee2mqtt`) with a single generic wizard owned by the devices module. Plugins stop shipping wizard UI entirely and instead register an **adapter** that describes their discovery mechanics in a declarative vocabulary. A user adopting Shelly devices and a user adopting Zigbee devices see the same flow, the same buttons in the same places, and the same wording.

## Non-Goals

- **No backend or OpenAPI changes.** The three backends keep their own session shapes (`POST /discovery` + manual add vs. `POST /wizard` + permit-join). Absorbing that difference is exactly the adapter's job. Unifying the backend contracts would be a separate spec.
- No Panel (Flutter) wizard UI.
- No wizards for plugins that don't have one today (`devices-home-assistant`, `devices-wled`, `devices-reterminal`). The contract is designed so adding one is cheap, but none are built here.
- No change to the single-device add forms (`*-device-add-form.vue`), which remain the path for fine-grained per-device control.
- No change to device mapping, descriptors, or spec generators.

## Current State

All three wizards already share identical page chrome — mobile `app-bar-heading` + back button, `app-breadcrumbs`, `view-header` with desktop actions in `#extra`, an `el-card` whose header is an `el-steps`, and a mobile footer action bar — and the same three-step spine. Everything below that is divergent:

| | Shelly v1 / NG | Zigbee2MQTT |
|---|---|---|
| Step 2 name | `categories` | `categorize` |
| Where devices are selected | step 2 (checkbox column) | step 1 (checkbox + auto-pick-all / clear) |
| Category selector | on **both** steps (redundant) | step 2 only |
| Discovery controls | scan progress, restart scan, manual add form | bridge-online gate, permit-join toggle + countdown |
| Results actions | "Finish" in the wizard footer | "Add more" + "Done" inside the step body, footer hidden |
| Code shape | one ~640-line monolith each; v1 is a near copy of NG | thin host + 3 extracted step components |
| i18n keys | `headings.wizard.*`, `buttons.wizard.*`, `statuses.wizard.*` | `wizard.steps.*`, `wizard.actions.*`, `wizard.columns.*` |
| Busy state | `formResult === FormResult.WORKING` | local `isAdopting` ref |
| `already_registered` tag | `warning` | `info` |
| Wizard spec coverage | NG: 660 lines · **v1: none** | 306 lines |

Critically, the session-reconciliation logic in the composables (auto-preselect `ready` devices, deselect on `already_registered`, prefill name and category, the `readyHostnames` / `readyAddresses` guard) is near-identical comment-for-comment between Shelly and Z2M — roughly 60 lines of subtle, race-sensitive logic duplicated three times and tested once.

## Unified Flow

Three steps. Discovery is read-only; selection happens on the confirm step.

```
Step 1: Discover              Step 2: Confirm               Step 3: Results
──────────────────           ──────────────────            ──────────────────
Plugin controls              Table of adoptable            Table of outcomes:
(declarative descriptors):     devices:                    - Status tag
- banners                    - checkbox (+ select-all        (created/updated/
- progress bar                 in the header)                failed)
- action buttons             - Name (editable)             - Name
- input form                 - Identifier (read-only)      - Identifier
                             - Will create / will update   - Error
Read-only table of           - Category (dropdown)
found devices:               - plugin extra columns        Summary alert
- Name + sub-label                                         (success / warning)
- Identifier
- Status tag

[Cancel] [Next]              [Back] [Cancel] [Adopt]       [Add more]* [Done]
                                                            * capability-gated
```

**Rationale for read-only discovery.** Discovery is live: rows appear, change status, and get auto-adopted by the background connector mid-scan. Asking the user to commit to a selection on a moving list, then re-presenting it, produced the redundant category column Shelly has today. Selecting on a settled list, with everything editable in one place, is the simpler mental model.

**"Add more" is capability-gated**, not universal. Z2M declares it (`restart()` tears down the session and reopens pairing for the next batch, which is how Zigbee pairing actually works). Shelly does not — its `startDiscovery()` could support it, so enabling it later is a one-flag change.

## Shared Code

New files under `apps/admin/src/modules/devices/`:

```
components/wizard/
  device-wizard.vue                  renders all three steps, chrome, action bar, adapter lifecycle
  device-wizard-discover-step.vue    control descriptors + found-devices table
  device-wizard-confirm-step.vue     checkbox + name + category table
  device-wizard-results-step.vue     status + name + error table
  device-wizard.types.ts             all contracts below
composables/
  useDeviceWizardState.ts            step machine, selection/name/category state, reconciliation
```

`components/wizard/*` is exported from `modules/devices/components/components.ts`; `useDeviceWizardState` from `modules/devices/composables/composables.ts`, following the module's existing barrel convention.

### Registration

Plugins register an adapter **factory** instead of a component:

```ts
// modules/devices/devices.types.ts
export type IDevicePluginsComponents = {
	deviceAddForm?: DefineComponent<…>;
	deviceEditForm?: DefineComponent<…>;
	deviceWizardAdapter?: () => IDeviceWizardAdapter;   // replaces deviceWizard
};
```

`deviceWizardAdapter` lives in the existing `components` bag rather than a new `adapters` bag: `IDevicePluginsComponents` is a module-owned generic parameter of `IPluginElement`, so nothing outside the devices module is affected, and `useDevicesPlugins` already scans that bag. The slight naming impurity is the accepted cost of not touching the shared plugin-element type.

`view-devices-wizard.vue` renders the shared shell directly:

```vue
<device-wizard
	v-if="element?.components?.deviceWizardAdapter"
	:key="type"
	:adapter-factory="element.components.deviceWizardAdapter"
/>

<entity-not-found
	v-else
	icon="mdi:wizard-hat"
	:message="t('devicesModule.texts.devices.noWizardForDevicePlugin', { type })"
	:button-label="t('devicesModule.buttons.back.title')"
	@back="router.push({ name: RouteNames.DEVICES })"
/>
```

Two details that are load-bearing:

- It passes the **factory, not the result**. Adapters are composables (`useI18n`, `useBackend`, `injectStoresManager`) and must be invoked inside a `setup()`. Calling the factory in the host's `computed` would run it outside the injection context. `device-wizard.vue` calls it in its own `setup()`.
- `:key="type"` forces a remount when the user switches plugin type, so the outgoing adapter's `dispose()` runs and no state bleeds across.

`useDevicesPlugins.ts` needs the matching rename in two places: the `pluginComponents` scan list (line 17) and the `wizardOptions` filter (line 78) that populates the "add devices from…" chooser.

## Contracts

### Row status

Z2M's status set is a strict subset of Shelly's, so no lossy mapping is required. The union is Shelly's six with one rename for generality:

```ts
export type IWizardRowStatus = 'checking' | 'ready' | 'needs_credentials' | 'already_registered' | 'unsupported' | 'failed';
```

Shelly's `needs_password` maps 1:1 to `needs_credentials`, which also fits a future plugin needing a token or PIN.

The shell owns tag colour, so a status can't render two different ways in two plugins:

| Status | Tag type |
|---|---|
| `ready` | `success` |
| `checking` | `info` |
| `already_registered` | `info` |
| `needs_credentials` | `warning` |
| `unsupported` | `warning` |
| `failed` | `danger` |

This adopts Z2M's `info` for `already_registered` over Shelly's `warning` — "already known" is not a problem state. Default labels come from `devicesModule.wizard.statuses.*`; a row may override the text (not the colour) via `statusLabel`.

### Row

```ts
export interface IWizardRow {
	key: string;                    // stable identity — hostname / ieeeAddress
	label: string;                  // primary display name
	subLabel: string | null;        // model / "manufacturer · model"
	identifier: string;             // value for the identifier column
	status: IWizardRowStatus;
	statusLabel?: string;           // optional text override
	adoptable: boolean;             // adapter decides; the shell never infers it from status
	willUpdate: boolean;            // true → "will update" tag, false → "will create"
	suggestedName: string;
	suggestedCategory: DevicesModuleDeviceCategory | null;
	categoryOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	cells?: Record<string, IWizardCell>;   // values for adapter-declared extra columns
}
```

`categoryOptions` is per-row because Shelly narrows the list by model (a Plus 1 offers both `lighting` and `switcher`; a dimmer offers only `lighting`). Z2M returns the same full list for every row.

### Columns

Built-in columns, so plugins declare only what is genuinely extra:

| Step | Columns |
|---|---|
| Discover | Name (`label` + `subLabel`), *Identifier*, Status |
| Confirm | ☑, Name (input), *Identifier*, Will create/update, Category |
| Results | Status, Name, *Identifier*, Error |

*Identifier* is labelled by `adapter.identifierLabel` — "Hostname" for Shelly, "Friendly name" for Z2M. Empty-state text for all three tables comes from the shell (`devicesModule.wizard.*`), not the adapter.

```ts
export type IWizardStep = 'discover' | 'confirm' | 'results';

export interface IWizardColumn {
	key: string;
	label: string;              // already translated by the adapter
	steps: IWizardStep[];       // which steps it appears on
	width?: number;
	minWidth?: number;
	sortable?: boolean;
}

export type IWizardCell =
	| { render: 'text'; value: string; muted?: boolean }
	| { render: 'code'; value: string }
	| { render: 'tag'; value: string; variant?: 'info' | 'success' | 'warning' | 'danger'; tooltip?: string };
```

Sorting on extra columns compares cell `value` through the existing `compareLocale` helper, promoted from `plugins/devices-zigbee2mqtt/utils/wizard.sort.ts` to the shared wizard code. Built-in columns keep the comparators the current wizards use: name sorts by the edited value in `nameByKey`, status groups will-create ahead of will-update then falls back to identifier, category sorts by translated label.

Zigbee2MQTT declares exactly one extra column: **Channels** (confirm step, `tag` render, tooltip listing channel identifiers). Shelly declares none.

### Discovery controls

The discovery step renders a closed vocabulary of four descriptors. This is the part of the abstraction most at risk of leaking, so the vocabulary is deliberately small and the extension rule is explicit.

```ts
export type IWizardControl =
	| {
			type: 'banner';
			id: string;
			severity: 'info' | 'warning' | 'error';
			title: string;
			message?: string;
			link?: { label: string; to: RouteLocationRaw };
	  }
	| {
			type: 'progress';
			id: string;
			label: string;
			percentage: number;
			state?: 'success' | 'warning';
			visible: boolean;     // false keeps the layout slot but hides content
	  }
	| {
			type: 'action';
			id: string;
			label: string;
			icon: string;
			variant?: 'default' | 'primary' | 'warning';
			disabled?: boolean;
			loading?: boolean;
			handler: () => void | Promise<void>;
	  }
	| {
			type: 'form';
			id: string;
			fields: { key: string; label: string; placeholder?: string; secret?: boolean }[];
			submitLabel: string;
			submitIcon?: string;
			submitDisabled: boolean;
			loading?: boolean;
			handler: (values: Record<string, string>) => Promise<void>;
	  };
```

Coverage of the existing plugins:

| | Shelly v1 / NG | Zigbee2MQTT |
|---|---|---|
| `banner` | the discovery info alert | bridge-offline warning + link to plugin config |
| `progress` | scan percentage; `state: 'success'` once the session finishes | permit-join countdown; `visible: false` when inactive; `state: 'warning'` past 75% |
| `action` | "Restart scan" | a single button whose label, icon and variant flip between "Pair new device" and "Cancel pairing" |
| `form` | manual add — `hostname` plus `password` (`secret: true`) | none |

Layout, matching what both plugins render today: banners stack full-width at the top; `progress` and `action` controls share one row with progress growing and actions right-aligned; `form` controls sit below in a responsive grid. Within each group, controls render in adapter-declared order.

**Extension rule:** if a future plugin needs something these four cannot express, the fix is a fifth descriptor type — never an escape-hatch slot. A slot would silently reintroduce the per-plugin UI divergence this design exists to remove.

The form's `handler` receives the field values and the shell clears the inputs on a resolved promise, leaving them intact on rejection so the user can correct and retry.

### Adapter

```ts
export interface IWizardAdoptSelection {
	key: string;
	name: string;
	category: DevicesModuleDeviceCategory;
}

export interface IWizardResult {
	key: string;
	name: string;
	identifier: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
	cells?: Record<string, IWizardCell>;
}


export interface IDeviceWizardCapabilities {
	addMore: boolean;
}

export interface IDeviceWizardAdapter {
	// identity and labels — all already translated
	title: string;
	subtitle: string;
	breadcrumbLabel: string;
	pluginType: string;             // breadcrumb route param, e.g. 'devices-shelly-ng-plugin'
	identifierLabel: string;

	// data
	rows: ComputedRef<IWizardRow[]>;
	results: ComputedRef<IWizardResult[]>;
	columns: IWizardColumn[];
	controls: ComputedRef<IWizardControl[]>;

	// state
	ready: ComputedRef<boolean>;    // false → loading overlay on the discover step
	busy: ComputedRef<boolean>;

	capabilities: IDeviceWizardCapabilities;

	// lifecycle
	start: () => Promise<void>;
	adopt: (selection: IWizardAdoptSelection[]) => Promise<IWizardResult[]>;
	beforeLeaveDiscover?: () => Promise<void>;
	restart?: () => Promise<void>;  // required when capabilities.addMore is true
	dispose?: () => Promise<void>;
}
```

**The shell owns the lifecycle.** It calls `start()` on mount and `dispose()` on unmount, so the adapters drop their own `tryOnMounted` / `tryOnUnmounted` hooks. Polling, session generation counters, and race guards stay entirely inside the adapter — the shell only reads `rows`. Plugin-private state stays inside too: Shelly keeps `passwordByHostname` keyed by the same `key` the shell hands back in `adopt`.

Neither plugin declares a results-step extra column today. `cells` exists on `IWizardResult` so that an `IWizardColumn` whose `steps` includes `'results'` has a data source, rather than silently rendering blank.

`ready` exists for Z2M's `sessionReady`, which prevents a misleading "bridge offline" flash before the first session response. Shelly's adapter returns `true` once `start()` resolves.

`beforeLeaveDiscover` covers Z2M silently disabling permit-join (and flashing "pairing disabled") when the user advances. Shelly omits it.

## State Ownership

`useDeviceWizardState.ts` owns `activeStep`, `selected`, `nameByKey`, `categoryByKey`, `everReady`, and `canContinue`. The three plugin composables shed their `selected` / `nameBy*` / `categoryBy*` maps entirely.

### Reconciliation

Runs whenever `adapter.rows` changes, per row, comparing against the previous snapshot:

```ts
const firstTimeReady = row.status === 'ready' && !everReady.has(row.key);
const becameAlreadyRegistered = previous !== undefined && previous.status !== 'already_registered' && row.status === 'already_registered';
const becameAdoptable = previous !== undefined && !previous.adoptable && row.adoptable;

// Selection: pre-select ready devices on first sight and on their first transition to ready,
// but never re-select something the user has already deselected.
if (selected[row.key] === undefined || firstTimeReady) {
	selected[row.key] = row.status === 'ready';
} else if (becameAlreadyRegistered) {
	selected[row.key] = false;
}

// Name: fill from the adapter's suggestion, and refresh it when a device finishes inspection
// while the field still shows the raw identifier placeholder (i.e. the user hasn't typed).
if (nameByKey[row.key] === undefined || (becameAdoptable && nameByKey[row.key] === row.identifier)) {
	nameByKey[row.key] = row.suggestedName;
}

// Category: fill in a late-arriving suggestion, never overwrite a real choice.
if (categoryByKey[row.key] === undefined || (categoryByKey[row.key] === null && row.suggestedCategory !== null)) {
	categoryByKey[row.key] = row.suggestedCategory;
}

if (row.status === 'ready') {
	everReady.add(row.key);
}
```

This is Shelly's rule set, which strictly subsumes Z2M's — Z2M's weaker third selection branch existed only because it has no `checking` status and therefore no `checking → ready` transition to handle. The plugin-specific parts move into the adapter: `suggestedName` is Z2M's `humanize(friendlyName)` or Shelly's `registeredDeviceName ?? name ?? displayName ?? hostname`; `suggestedCategory` is `registeredDeviceCategory ?? suggestedCategory` in both.

`canContinue` is true when at least one selected row is adoptable and every selected row has a non-blank trimmed name and a non-null category.

### Action bar

One model, rendered twice — desktop `view-header` `#extra` and the mobile footer — so the button logic is written once instead of the four copies that exist today:

```ts
export interface IWizardAction {
	id: string;
	label: string;
	variant: 'link' | 'default' | 'primary';
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}
```

| Step | Actions |
|---|---|
| Discover | Cancel *(link)* · Next *(primary; disabled when no adoptable rows)* |
| Confirm | Back · Cancel *(link)* · Adopt *(primary; disabled unless `canContinue`; loading while `busy`)* |
| Results | Add more *(default; only when `capabilities.addMore`)* · Done *(primary)* |

This also removes today's inconsistency where Z2M's results buttons sit inside the step body and the footer disappears entirely.

## Error Handling

Adapters keep surfacing their own errors via `flashMessage` — the existing pattern — and reject. The shell decides navigation:

- **Next** awaits `beforeLeaveDiscover()` and advances **even if it rejects**. Failing to close a pairing window must not trap the user on the discover step; this preserves Z2M's current behaviour.
- **Adopt** awaits `adopt()`. Rejection keeps the user on the confirm step with their input intact; resolution advances to results. Shelly is unaffected — its adapter collects per-device failures into `status: 'failed'` rows rather than throwing.
- **Add more** awaits `restart()` **fully** before switching to the discover step. Reversing that order is what caused the bridge-offline flash the current Z2M code carries a comment about. It then clears `selected`, `nameByKey`, `categoryByKey` and `everReady`.
- **`dispose()`** runs on unmount, best-effort, errors swallowed.
- **Cancel** navigates back to the devices list — `router.replace` on large screens, `router.push` otherwise, matching current behaviour. `dispose()` still runs via unmount.
- The **results summary alert** (`success`, or `warning` when any row failed) is computed by the shell from `results`. Shelly has this today; Z2M gains it.

## Accepted Losses

Visible behaviours removed rather than preserved:

1. Z2M's sortable **Manufacturer** column folds into `subLabel` beneath the device name on the discover and confirm steps, which is how Shelly presents the same information. Same content, one less column, better on narrow screens. The **results step also loses the Manufacturer column outright** — `IWizardResult` has no `subLabel` (or any equivalent field), so nothing carries the manufacturer that far. This is a second, undocumented-until-now loss riding on the back of the first: folding into `subLabel` was sanctioned for the rows that have one, but the results step's rows never did.
2. Z2M's **"Auto-pick all" / "Clear selection"** buttons are removed. Selection now lives on the confirm step, which carries Shelly's select-all header checkbox — an indeterminate-state tri-toggle that does both jobs.
3. The **results table's columns are no longer sortable**. The deleted Z2M results table had four sortable columns; the shared `device-wizard-results-step.vue` renders a fixed order instead — failed rows first, then created, then updated, with name as the tiebreaker within each group. Surfacing failures first is arguably more useful than free sorting, but it is still a capability loss for a user trying to, say, sort by name to find one device in a long results list.

## i18n

Shell chrome, step titles, buttons and status labels become one canonical `devicesModule.wizard.*` set, translated once across 6 locales. Everything plugin-flavoured — `title`, `subtitle`, `breadcrumbLabel`, `identifierLabel`, control labels, banner copy, extra-column labels — is supplied already-translated by the adapter from the plugin's own locale files.

Dead keys to remove across 6 locales × 3 plugins:

- Shelly v1 / NG: `headings.wizard.*`, `buttons.wizard.*` (except keys the adapter still uses for control labels), `statuses.wizard.*`, `texts.wizard.results.*`, `breadcrumbs.wizard`
- Zigbee2MQTT: `wizard.steps.*`, `wizard.actions.*`, `wizard.columns.*` (except `channels`), `wizard.status.*`

All plugin wizard strings that survive are consolidated under a single `<pluginI18nRoot>.wizard.*` namespace — so Shelly's surviving control labels move from `buttons.wizard.addManual.title` to `wizard.controls.addManual`, matching the shape Z2M already uses.

**Amendment (post-ship): this rename was not carried out.** Shelly v1 and NG's surviving control labels stayed at their original paths — `buttons.wizard.restart.title`, `buttons.wizard.addManual.title`, `texts.wizard.discovery`, `texts.wizard.scanStatus` — rather than moving to a `wizard.controls.*` / `wizard.*` shape matching Z2M. The keys were already scoped under `buttons.wizard.*` / `texts.wizard.*` with no stray top-level pollution, so the practical naming inconsistency is minor; renaming them now would only delete and recreate live, working keys across 12 locale files (6 locales × 2 plugins) for a cosmetic shape difference with no user-visible benefit. This spec is amended to describe what shipped rather than performing the rename retroactively.

## Migration Sequence

Each phase leaves the branch green and lints clean.

| # | Step | Notes |
|---|---|---|
| 1 | `device-wizard.types.ts` | every contract above |
| 2 | `useDeviceWizardState.ts` + spec | pure logic; TDD against fake rows |
| 3 | `device-wizard-discover-step.vue`, `-confirm-step.vue`, `-results-step.vue` | |
| 4 | `device-wizard.vue` | chrome, `el-steps`, action bar, adapter lifecycle |
| 5 | `devices.types.ts` | add `deviceWizardAdapter`, drop `deviceWizard` |
| 6 | `useDevicesPlugins.ts` + spec | lines 17 and 78 |
| 7 | `view-devices-wizard.vue` + spec | factory + `:key="type"` |
| 8 | **Zigbee2MQTT adapter** | delete 4 `.vue` files |
| 9 | **Shelly NG adapter** | delete 1 `.vue` file |
| 10 | **Shelly v1 adapter** | delete 1 `.vue` file |
| 11 | i18n | add `devicesModule.wizard.*`; strip dead keys |
| 12 | test consolidation | move reconciliation cases into the shared spec |

**Zigbee2MQTT is migrated first, deliberately.** It is the only plugin that exercises every optional part of the contract — `capabilities.addMore`, `restart`, `dispose`, `beforeLeaveDiscover`, an extra column, and a banner carrying a route link. If the abstraction leaks, it leaks there, while only one plugin is committed to it and the other two still run on their existing components.

2,397 lines of plugin wizard `.vue` files are deleted (639 + 639 + 385 + 320 + 227 + 187); each plugin ends up with a single `useDevicesWizard.ts` returning an `IDeviceWizardAdapter`.

## Testing

Current coverage is lopsided: `devices-shelly-ng` has a 660-line wizard spec, `devices-zigbee2mqtt` 306, and `devices-shelly-v1` has **none**. Much of the shelly-ng suite tests reconciliation logic that becomes shared, so those cases **move** rather than get rewritten — and all three plugins inherit them.

**`useDeviceWizardState.spec.ts`** (new, the largest suite):

- reconciliation: first sight of a `ready` row pre-selects it; first sight of a non-`ready` row does not; `checking → ready` selects on first transition only; a user-deselected row is not re-selected on later polls; `→ already_registered` deselects; a user-typed name survives refresh; a name still equal to the identifier refreshes when the row becomes adoptable; a null category is filled by a late `suggestedCategory`; a user-chosen category is never overwritten
- `canContinue` across empty selection, blank name, whitespace-only name, null category
- step transitions and per-step action model
- `addMore` gating of the results action
- restart clearing `selected` / `nameByKey` / `categoryByKey` / `everReady`

**`device-wizard.spec.ts`**:

- renders adapter `title`, `subtitle`, `breadcrumbLabel`
- renders each of the four control types with correct props; `visible: false` hides progress content
- extra columns appear only on their declared steps
- "Add more" hidden when `capabilities.addMore` is false
- `adopt()` rejection keeps the user on confirm; resolution advances to results
- `beforeLeaveDiscover()` rejection still advances to confirm
- `dispose()` fires on unmount

**Per-plugin `useDevicesWizard.spec.ts`** shrink to adapter concerns — row mapping (status mapping, `suggestedName`, `suggestedCategory`, `cells`), `controls` shape under each state (scanning vs. finished; bridge offline; permit-join active vs. inactive), and the `adopt` payload. Existing transport and race-condition tests stay as they are. `devices-shelly-v1` gains its first wizard spec.

**`useDevicesPlugins.spec.ts`** and **`view-devices-wizard.spec.ts`**: rename `deviceWizard` → `deviceWizardAdapter`, assert the factory is passed rather than invoked by the host, and assert the `:key` remount on type change.

**`modules/devices/locales/locales.spec.ts`** gains a parity case asserting every `IWizardRowStatus` value has a non-empty translation in all six locales. This follows the file's existing `CATEGORY_GROUPS` pattern and prevents a status rendering as a raw key in one language.

Verification: `pnpm --filter ./apps/admin run test:unit`, `pnpm run lint:js`, and a manual pass through all three wizards.

## Risks

| Risk | Mitigation |
|---|---|
| The four control descriptors prove insufficient for a plugin | Retired at step 8 by migrating Z2M first. The fix is a fifth descriptor type, never a slot. |
| Regressions in the subtle race handling around selection and prefill | Existing shelly-ng test cases are moved, not rewritten; they then cover all three plugins. |
| Translation churn across 24 locale files (6 locales × 3 plugins + the devices module) | Confined to step 11, after behaviour is verified. Shell strings are added before plugin strings are removed. |
| Adapter factory invoked outside an injection context | The host passes the factory; only `device-wizard.vue`'s `setup()` calls it. Covered by a `view-devices-wizard` spec assertion. |

## Out of Scope

- Unifying the backend discovery/adoption REST contracts.
- Wizards for `devices-home-assistant`, `devices-wled`, `devices-reterminal`.
- Bulk re-mapping or device removal from inside the wizard.
- Any Panel (Flutter) work.
