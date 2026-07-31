# Unified Device Adoption Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three independently-written device adoption wizards (`devices-shelly-v1`, `devices-shelly-ng`, `devices-zigbee2mqtt`) with one generic wizard owned by the devices module, driven by a per-plugin adapter.

**Architecture:** The devices module gains a wizard shell (`device-wizard.vue`) that owns page chrome, the three-step machine, selection/name/category state, and the action bar. Plugins no longer ship wizard UI — they register a `deviceWizardAdapter` factory returning an `IDeviceWizardAdapter`, which exposes normalized rows plus a closed vocabulary of four declarative discovery controls (`banner`, `progress`, `action`, `form`). Transport, polling and race handling stay inside each adapter.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Element Plus, Vitest + `@vue/test-utils`, `vue-i18n`, `natural-orderby`, `@iconify/vue`.

**Spec:** `docs/superpowers/specs/2026-07-31-unified-device-wizard-design.md`

## Global Constraints

- **Indentation: tabs.** Print width 120. Single quotes. Semicolons always. Trailing commas on multiline.
- **Import order:** external imports first, then relative (`../` then `./`), with a blank line between groups.
- Variables/functions `camelCase`; classes/interfaces/enums/types `PascalCase`; Vue component filenames `kebab-case` with `PascalCase` in `defineOptions({ name })`; folders `kebab-case`.
- Interface names are prefixed `I` (`IWizardRow`, `IDeviceWizardAdapter`) — the codebase convention.
- **Never edit generated files:** `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`, `apps/backend/src/spec/`, `spec/api/v1/openapi.json`.
- **No backend, OpenAPI or Panel changes in this plan.** Admin app only.
- **No new dependencies.**
- All work happens on branch `feat/unified-device-wizard`. Never push to `main`.
- Admin unit tests: `pnpm --filter ./apps/admin run test:unit`. Lint: `pnpm run lint:js`.
- Every task ends with a commit. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Incremental Migration Strategy

Tasks 9–12 migrate three plugins one at a time. To keep the branch green throughout, **Task 9 keeps the legacy `deviceWizard` component registration alongside the new `deviceWizardAdapter`**, and `view-devices-wizard.vue` prefers the adapter with a fallback to the component. Task 13 deletes the legacy path once all three plugins have migrated. Do not remove `deviceWizard` before Task 13.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts` | Every contract: rows, columns, cells, controls, adapter, actions |
| `apps/admin/src/modules/devices/components/wizard/device-wizard.sort.ts` | `compareLocale` comparator shared by all wizard tables |
| `apps/admin/src/modules/devices/components/wizard/device-wizard.actions.ts` | `buildWizardActions` — pure step → action-bar model |
| `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.vue` | Control descriptors + read-only found-devices table |
| `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.vue` | Checkbox + name + category table |
| `apps/admin/src/modules/devices/components/wizard/device-wizard-results-step.vue` | Outcome table |
| `apps/admin/src/modules/devices/components/wizard/device-wizard.vue` | Shell: chrome, steps, action bar, adapter lifecycle |
| `apps/admin/src/modules/devices/components/wizard/components.ts` | Barrel |
| `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts` | Step machine, selection/name/category state, reconciliation |

**Modified:** `modules/devices/components/components.ts`, `modules/devices/composables/composables.ts`, `modules/devices/devices.types.ts`, `modules/devices/composables/useDevicesPlugins.ts`, `modules/devices/views/view-devices-wizard.vue`, the 6 `modules/devices/locales/*.json`, `modules/devices/locales/locales.spec.ts`, and each plugin's `useDevicesWizard.ts`, `*.plugin.ts`, `components/components.ts` and locale files.

**Deleted (Tasks 10–12):** `shelly-ng-devices-wizard.vue` (639), `shelly-v1-devices-wizard.vue` (639), `zigbee2mqtt-devices-wizard.vue` (385), `zigbee2mqtt-wizard-discovery-step.vue` (320), `zigbee2mqtt-wizard-categorize-step.vue` (227), `zigbee2mqtt-wizard-results-step.vue` (187) — 2,397 lines.

---

### Task 1: Wizard contracts and shared comparator

**Files:**
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.sort.ts`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.sort.spec.ts`
- Create: `apps/admin/src/modules/devices/components/wizard/components.ts`
- Modify: `apps/admin/src/modules/devices/components/components.ts`

**Interfaces:**
- Consumes: `DevicesModuleDeviceCategory` from `apps/admin/src/openapi.constants`.
- Produces: `IWizardStep`, `IWizardRowStatus`, `IWizardCell`, `IWizardColumn`, `IWizardRow`, `IWizardControl`, `IWizardAdoptSelection`, `IWizardResult`, `IDeviceWizardCapabilities`, `IDeviceWizardAdapter`, `IWizardAction`, `compareLocale`. Every later task imports from these two files.

- [ ] **Step 1: Write the failing comparator test**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.sort.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { compareLocale } from './device-wizard.sort';

describe('compareLocale', () => {
	it('sorts numbers naturally rather than lexicographically', () => {
		expect(compareLocale('device 2', 'device 10')).toBeLessThan(0);
	});

	it('ignores case differences', () => {
		expect(compareLocale('Kitchen', 'kitchen')).toBe(0);
	});

	it('treats null and undefined as empty strings', () => {
		expect(compareLocale(null, '')).toBe(0);
		expect(compareLocale(undefined, 'a')).toBeLessThan(0);
	});

	it('sorts alphabetically', () => {
		expect(compareLocale('alpha', 'beta')).toBeLessThan(0);
		expect(compareLocale('beta', 'alpha')).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.sort`
Expected: FAIL — cannot resolve `./device-wizard.sort`.

- [ ] **Step 3: Create the comparator**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.sort.ts` — this is `plugins/devices-zigbee2mqtt/utils/wizard.sort.ts` promoted to the module, unchanged:

```ts
/**
 * Locale-aware comparator used by the wizard step tables. Treats null/undefined as empty
 * strings, sorts numbers naturally (so `device 2` sorts before `device 10`), and ignores
 * case differences.
 */
export const compareLocale = (a: string | null | undefined, b: string | null | undefined): number => {
	const left = (a ?? '').toString();
	const right = (b ?? '').toString();

	return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.sort`
Expected: PASS, 4 tests.

- [ ] **Step 5: Create the contracts file**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts`:

```ts
import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

export type IWizardStep = 'discover' | 'confirm' | 'results';

export type IWizardRowStatus = 'checking' | 'ready' | 'needs_credentials' | 'already_registered' | 'unsupported' | 'failed';

export type IWizardCell =
	| { render: 'text'; value: string; muted?: boolean }
	| { render: 'code'; value: string }
	| { render: 'tag'; value: string; variant?: 'info' | 'success' | 'warning' | 'danger'; tooltip?: string };

export interface IWizardColumn {
	key: string;
	/** Already translated by the adapter. */
	label: string;
	steps: IWizardStep[];
	width?: number;
	minWidth?: number;
	sortable?: boolean;
}

export interface IWizardRow {
	/** Stable identity — hostname for Shelly, ieeeAddress for Zigbee2MQTT. */
	key: string;
	label: string;
	subLabel: string | null;
	identifier: string;
	status: IWizardRowStatus;
	/** Optional text override. Never overrides the tag colour. */
	statusLabel?: string;
	/** The adapter decides; the shell never infers adoptability from status. */
	adoptable: boolean;
	willUpdate: boolean;
	suggestedName: string;
	suggestedCategory: DevicesModuleDeviceCategory | null;
	categoryOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	cells?: Record<string, IWizardCell>;
}

export interface IWizardBannerControl {
	type: 'banner';
	id: string;
	severity: 'info' | 'warning' | 'error';
	title: string;
	message?: string;
	link?: { label: string; to: RouteLocationRaw };
}

export interface IWizardProgressControl {
	type: 'progress';
	id: string;
	label: string;
	percentage: number;
	state?: 'success' | 'warning';
	/** false keeps the layout slot but hides the content, avoiding a reflow. */
	visible: boolean;
}

export interface IWizardActionControl {
	type: 'action';
	id: string;
	label: string;
	icon: string;
	variant?: 'default' | 'primary' | 'warning';
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}

export interface IWizardFormField {
	key: string;
	label: string;
	placeholder?: string;
	secret?: boolean;
}

export interface IWizardFormControl {
	type: 'form';
	id: string;
	fields: IWizardFormField[];
	submitLabel: string;
	submitIcon?: string;
	submitDisabled: boolean;
	loading?: boolean;
	/** Resolving clears the inputs; rejecting leaves them intact for correction. */
	handler: (values: Record<string, string>) => Promise<void>;
}

export type IWizardControl = IWizardBannerControl | IWizardProgressControl | IWizardActionControl | IWizardFormControl;

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
	/** Data source for an IWizardColumn whose `steps` includes 'results'. */
	cells?: Record<string, IWizardCell>;
}

export interface IDeviceWizardCapabilities {
	addMore: boolean;
}

export interface IDeviceWizardAdapter {
	// Identity and labels — all already translated by the adapter.
	title: string;
	subtitle: string;
	breadcrumbLabel: string;
	/** Breadcrumb route param, e.g. 'devices-shelly-ng-plugin'. */
	pluginType: string;
	identifierLabel: string;

	rows: ComputedRef<IWizardRow[]>;
	results: ComputedRef<IWizardResult[]>;
	columns: IWizardColumn[];
	controls: ComputedRef<IWizardControl[]>;

	/** false renders the loading overlay on the discover step. */
	ready: ComputedRef<boolean>;
	busy: ComputedRef<boolean>;

	capabilities: IDeviceWizardCapabilities;

	// The shell calls start() on mount and dispose() on unmount — adapters must not
	// register their own tryOnMounted / tryOnUnmounted hooks.
	start: () => Promise<void>;
	adopt: (selection: IWizardAdoptSelection[]) => Promise<IWizardResult[]>;
	beforeLeaveDiscover?: () => Promise<void>;
	/** Required when capabilities.addMore is true. */
	restart?: () => Promise<void>;
	dispose?: () => Promise<void>;
}

export interface IWizardAction {
	id: string;
	label: string;
	variant: 'link' | 'default' | 'primary';
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}

export interface IDeviceWizardProps {
	adapterFactory: () => IDeviceWizardAdapter;
}
```

- [ ] **Step 6: Create the barrel and wire it up**

Create `apps/admin/src/modules/devices/components/wizard/components.ts`:

```ts
export * from './device-wizard.types';
export * from './device-wizard.sort';
```

Modify `apps/admin/src/modules/devices/components/components.ts` to add the new barrel (keep existing lines):

```ts
export * from './channels/components';
export * from './devices/components';
export * from './wizard/components';
```

- [ ] **Step 7: Run the full admin suite and lint**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: PASS — no regressions.

Run: `pnpm run lint:js`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/modules/devices/components/wizard apps/admin/src/modules/devices/components/components.ts
git commit -m "$(cat <<'EOF'
feat(admin): device wizard contracts and shared comparator

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Shell translations and status parity guard

**Files:**
- Modify: `apps/admin/src/modules/devices/locales/en-US.json`, `cs-CZ.json`, `de-DE.json`, `es-ES.json`, `pl-PL.json`, `sk-SK.json`
- Modify: `apps/admin/src/modules/devices/locales/locales.spec.ts`

**Interfaces:**
- Consumes: `IWizardRowStatus` from Task 1.
- Produces: the `devicesModule.wizard.*` key namespace used by every component in Tasks 5–8.

Locale JSON files have root-level key groups (`buttons`, `texts`, `categories`, …); the `devicesModule.` prefix comes from locale registration. Add a new root-level `wizard` object to each.

- [ ] **Step 1: Write the failing parity test**

Modify `apps/admin/src/modules/devices/locales/locales.spec.ts`. Add this import alongside the existing ones:

```ts
import type { IWizardRowStatus } from '../components/wizard/device-wizard.types';
```

Add this constant below the existing `CATEGORY_GROUPS` declaration:

```ts
const WIZARD_STATUSES: IWizardRowStatus[] = [
	'checking',
	'ready',
	'needs_credentials',
	'already_registered',
	'unsupported',
	'failed',
];
```

Add this `describe.each` block inside the existing `describe('Devices module locales', …)`, after the category block:

```ts
	describe.each(Object.keys(locales))('%s wizard', (locale: string): void => {
		it('translates every wizard row status', (): void => {
			const wizard = locales[locale].wizard as Record<string, unknown> | undefined;
			const statuses = (wizard?.statuses as Record<string, unknown> | undefined) ?? {};

			const missing = WIZARD_STATUSES.filter((status) => typeof statuses[status] !== 'string' || statuses[status] === '');

			expect(missing, `Missing wizard status translations in ${locale}: ${missing.join(', ')}`).toEqual([]);
		});
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- locales`
Expected: FAIL — 6 failures listing all six missing statuses per locale.

- [ ] **Step 3: Add the `wizard` block to `en-US.json`**

Insert as a new root-level key (JSON key order does not matter; append before the closing brace of the object):

```json
	"wizard": {
		"steps": {
			"discover": "Discovery",
			"confirm": "Confirm",
			"results": "Results"
		},
		"actions": {
			"cancel": "Cancel",
			"back": "Back",
			"next": "Next",
			"adopt": "Add devices",
			"addMore": "Add more",
			"done": "Done"
		},
		"statuses": {
			"checking": "Checking",
			"ready": "Ready",
			"needs_credentials": "Credentials required",
			"already_registered": "Already added",
			"unsupported": "Unsupported",
			"failed": "Failed",
			"willCreate": "Will create",
			"willUpdate": "Will update",
			"created": "Created",
			"updated": "Updated"
		},
		"columns": {
			"name": "Name",
			"status": "Status",
			"category": "Category",
			"change": "Action",
			"error": "Error"
		},
		"texts": {
			"empty": "No devices found yet",
			"noSelection": "No devices were selected",
			"resultsSuccess": "All selected devices were added successfully",
			"resultsFailed": "Some devices could not be added"
		}
	}
```

- [ ] **Step 4: Add the `wizard` block to `cs-CZ.json`**

```json
	"wizard": {
		"steps": { "discover": "Vyhledávání", "confirm": "Potvrzení", "results": "Výsledky" },
		"actions": {
			"cancel": "Zrušit",
			"back": "Zpět",
			"next": "Další",
			"adopt": "Přidat zařízení",
			"addMore": "Přidat další",
			"done": "Hotovo"
		},
		"statuses": {
			"checking": "Ověřování",
			"ready": "Připraveno",
			"needs_credentials": "Vyžaduje přihlašovací údaje",
			"already_registered": "Již přidáno",
			"unsupported": "Nepodporováno",
			"failed": "Selhalo",
			"willCreate": "Bude vytvořeno",
			"willUpdate": "Bude aktualizováno",
			"created": "Vytvořeno",
			"updated": "Aktualizováno"
		},
		"columns": { "name": "Název", "status": "Stav", "category": "Kategorie", "change": "Akce", "error": "Chyba" },
		"texts": {
			"empty": "Zatím nebyla nalezena žádná zařízení",
			"noSelection": "Nebyla vybrána žádná zařízení",
			"resultsSuccess": "Všechna vybraná zařízení byla úspěšně přidána",
			"resultsFailed": "Některá zařízení se nepodařilo přidat"
		}
	}
```

- [ ] **Step 5: Add the `wizard` block to `de-DE.json`**

```json
	"wizard": {
		"steps": { "discover": "Suche", "confirm": "Bestätigung", "results": "Ergebnisse" },
		"actions": {
			"cancel": "Abbrechen",
			"back": "Zurück",
			"next": "Weiter",
			"adopt": "Geräte hinzufügen",
			"addMore": "Weitere hinzufügen",
			"done": "Fertig"
		},
		"statuses": {
			"checking": "Wird geprüft",
			"ready": "Bereit",
			"needs_credentials": "Anmeldedaten erforderlich",
			"already_registered": "Bereits hinzugefügt",
			"unsupported": "Nicht unterstützt",
			"failed": "Fehlgeschlagen",
			"willCreate": "Wird erstellt",
			"willUpdate": "Wird aktualisiert",
			"created": "Erstellt",
			"updated": "Aktualisiert"
		},
		"columns": { "name": "Name", "status": "Status", "category": "Kategorie", "change": "Aktion", "error": "Fehler" },
		"texts": {
			"empty": "Noch keine Geräte gefunden",
			"noSelection": "Es wurden keine Geräte ausgewählt",
			"resultsSuccess": "Alle ausgewählten Geräte wurden erfolgreich hinzugefügt",
			"resultsFailed": "Einige Geräte konnten nicht hinzugefügt werden"
		}
	}
```

- [ ] **Step 6: Add the `wizard` block to `es-ES.json`**

```json
	"wizard": {
		"steps": { "discover": "Búsqueda", "confirm": "Confirmación", "results": "Resultados" },
		"actions": {
			"cancel": "Cancelar",
			"back": "Atrás",
			"next": "Siguiente",
			"adopt": "Añadir dispositivos",
			"addMore": "Añadir más",
			"done": "Hecho"
		},
		"statuses": {
			"checking": "Comprobando",
			"ready": "Listo",
			"needs_credentials": "Credenciales necesarias",
			"already_registered": "Ya añadido",
			"unsupported": "No compatible",
			"failed": "Fallido",
			"willCreate": "Se creará",
			"willUpdate": "Se actualizará",
			"created": "Creado",
			"updated": "Actualizado"
		},
		"columns": { "name": "Nombre", "status": "Estado", "category": "Categoría", "change": "Acción", "error": "Error" },
		"texts": {
			"empty": "Todavía no se han encontrado dispositivos",
			"noSelection": "No se seleccionó ningún dispositivo",
			"resultsSuccess": "Todos los dispositivos seleccionados se añadieron correctamente",
			"resultsFailed": "Algunos dispositivos no se pudieron añadir"
		}
	}
```

- [ ] **Step 7: Add the `wizard` block to `pl-PL.json`**

```json
	"wizard": {
		"steps": { "discover": "Wyszukiwanie", "confirm": "Potwierdzenie", "results": "Wyniki" },
		"actions": {
			"cancel": "Anuluj",
			"back": "Wstecz",
			"next": "Dalej",
			"adopt": "Dodaj urządzenia",
			"addMore": "Dodaj kolejne",
			"done": "Zakończ"
		},
		"statuses": {
			"checking": "Sprawdzanie",
			"ready": "Gotowe",
			"needs_credentials": "Wymagane dane logowania",
			"already_registered": "Już dodane",
			"unsupported": "Nieobsługiwane",
			"failed": "Niepowodzenie",
			"willCreate": "Zostanie utworzone",
			"willUpdate": "Zostanie zaktualizowane",
			"created": "Utworzono",
			"updated": "Zaktualizowano"
		},
		"columns": { "name": "Nazwa", "status": "Status", "category": "Kategoria", "change": "Akcja", "error": "Błąd" },
		"texts": {
			"empty": "Nie znaleziono jeszcze żadnych urządzeń",
			"noSelection": "Nie wybrano żadnych urządzeń",
			"resultsSuccess": "Wszystkie wybrane urządzenia zostały pomyślnie dodane",
			"resultsFailed": "Niektórych urządzeń nie udało się dodać"
		}
	}
```

- [ ] **Step 8: Add the `wizard` block to `sk-SK.json`**

```json
	"wizard": {
		"steps": { "discover": "Vyhľadávanie", "confirm": "Potvrdenie", "results": "Výsledky" },
		"actions": {
			"cancel": "Zrušiť",
			"back": "Späť",
			"next": "Ďalej",
			"adopt": "Pridať zariadenia",
			"addMore": "Pridať ďalšie",
			"done": "Hotovo"
		},
		"statuses": {
			"checking": "Overuje sa",
			"ready": "Pripravené",
			"needs_credentials": "Vyžaduje prihlasovacie údaje",
			"already_registered": "Už pridané",
			"unsupported": "Nepodporované",
			"failed": "Zlyhalo",
			"willCreate": "Bude vytvorené",
			"willUpdate": "Bude aktualizované",
			"created": "Vytvorené",
			"updated": "Aktualizované"
		},
		"columns": { "name": "Názov", "status": "Stav", "category": "Kategória", "change": "Akcia", "error": "Chyba" },
		"texts": {
			"empty": "Zatiaľ neboli nájdené žiadne zariadenia",
			"noSelection": "Neboli vybrané žiadne zariadenia",
			"resultsSuccess": "Všetky vybrané zariadenia boli úspešne pridané",
			"resultsFailed": "Niektoré zariadenia sa nepodarilo pridať"
		}
	}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- locales`
Expected: PASS.

Run: `pnpm run lint:js`
Expected: clean (prettier formats the JSON — run `pnpm run pretty` if it complains).

- [ ] **Step 10: Commit**

```bash
git add apps/admin/src/modules/devices/locales
git commit -m "$(cat <<'EOF'
feat(admin): shell translations for the unified device wizard

Adds devicesModule.wizard.* across all six locales and a parity guard
asserting every IWizardRowStatus is translated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wizard state — reconciliation

**Files:**
- Create: `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts`
- Create: `apps/admin/src/modules/devices/composables/useDeviceWizardState.spec.ts`
- Modify: `apps/admin/src/modules/devices/composables/composables.ts`

**Interfaces:**
- Consumes: `IWizardRow`, `IWizardStep`, `IWizardAdoptSelection` from Task 1.
- Produces: `useDeviceWizardState(): IUseDeviceWizardState` with `activeStep`, `activeStepIndex`, `selected`, `nameByKey`, `categoryByKey`, `adoptableRows`, `selectedRows`, `canContinue`, `allSelected`, `someSelected`, `toggleAll(value)`, `reconcile(rows)`, `reset()`, `buildSelection()`. Tasks 4, 6 and 8 consume these exact names.

This task implements `reconcile` and the row-derived computeds. Task 4 adds the step machine and action model to the same file.

- [ ] **Step 1: Write the failing reconciliation tests**

Create `apps/admin/src/modules/devices/composables/useDeviceWizardState.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { IWizardRow } from '../components/wizard/device-wizard.types';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

import { useDeviceWizardState } from './useDeviceWizardState';

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: 'Shelly Plus 1',
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

describe('useDeviceWizardState — reconciliation', () => {
	it('pre-selects a ready row on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(true);
	});

	it('does not pre-select a non-ready row on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'already_registered', willUpdate: true })]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('selects a row on its first transition to ready', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false })]);
		expect(state.selected['shelly-1.local']).toBe(false);

		state.reconcile([row({ status: 'ready' })]);
		expect(state.selected['shelly-1.local']).toBe(true);
	});

	it('never re-selects a row the user deselected', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.selected['shelly-1.local'] = false;
		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('deselects a row that becomes already_registered', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.reconcile([row({ status: 'already_registered', willUpdate: true })]);

		expect(state.selected['shelly-1.local']).toBe(false);
	});

	it('fills the name from the adapter suggestion on first sight', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedName: 'Kitchen dimmer' })]);

		expect(state.nameByKey['shelly-1.local']).toBe('Kitchen dimmer');
	});

	it('preserves a name the user typed', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false })]);
		state.nameByKey['shelly-1.local'] = 'My name';
		state.reconcile([row({ status: 'ready', suggestedName: 'Suggested' })]);

		expect(state.nameByKey['shelly-1.local']).toBe('My name');
	});

	it('refreshes a name still showing the raw identifier once the row becomes adoptable', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ status: 'checking', adoptable: false, suggestedName: 'shelly-1.local' })]);
		expect(state.nameByKey['shelly-1.local']).toBe('shelly-1.local');

		state.reconcile([row({ status: 'ready', adoptable: true, suggestedName: 'Living room switch' })]);
		expect(state.nameByKey['shelly-1.local']).toBe('Living room switch');
	});

	it('fills a null category from a late-arriving suggestion', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedCategory: null })]);
		expect(state.categoryByKey['shelly-1.local']).toBeNull();

		state.reconcile([row({ suggestedCategory: DevicesModuleDeviceCategory.switcher })]);
		expect(state.categoryByKey['shelly-1.local']).toBe(DevicesModuleDeviceCategory.switcher);
	});

	it('never overwrites a category the user chose', () => {
		const state = useDeviceWizardState();

		state.reconcile([row({ suggestedCategory: null })]);
		state.categoryByKey['shelly-1.local'] = DevicesModuleDeviceCategory.lighting;
		state.reconcile([row({ suggestedCategory: DevicesModuleDeviceCategory.switcher })]);

		expect(state.categoryByKey['shelly-1.local']).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('reset clears every map', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.reset();

		expect(state.selected).toEqual({});
		expect(state.nameByKey).toEqual({});
		expect(state.categoryByKey).toEqual({});
	});

	it('reset lets a previously-deselected row be pre-selected again', () => {
		const state = useDeviceWizardState();

		state.reconcile([row()]);
		state.selected['shelly-1.local'] = false;
		state.reset();
		state.reconcile([row()]);

		expect(state.selected['shelly-1.local']).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- useDeviceWizardState`
Expected: FAIL — cannot resolve `./useDeviceWizardState`.

- [ ] **Step 3: Implement reconciliation**

Create `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts`:

```ts
import { type Reactive, reactive, ref } from 'vue';

import type { IWizardRow } from '../components/wizard/device-wizard.types';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export interface IUseDeviceWizardState {
	selected: Reactive<Record<string, boolean>>;
	nameByKey: Reactive<Record<string, string>>;
	categoryByKey: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	reconcile: (rows: IWizardRow[]) => void;
	reset: () => void;
}

export const useDeviceWizardState = (): IUseDeviceWizardState => {
	const selected = reactive<Record<string, boolean>>({});
	const nameByKey = reactive<Record<string, string>>({});
	const categoryByKey = reactive<Record<string, DevicesModuleDeviceCategory | null>>({});

	// Rows observed on the previous reconcile, used to detect status transitions.
	const previousRows = ref<IWizardRow[]>([]);

	// Keys that have been seen in the `ready` state at least once. Guards against
	// re-selecting a device the user deliberately deselected: without it, every poll
	// that reports the device as still `ready` would flip the checkbox back on.
	const everReady = new Set<string>();

	const reconcile = (rows: IWizardRow[]): void => {
		for (const row of rows) {
			const previous = previousRows.value.find((item) => item.key === row.key);

			const firstTimeReady = row.status === 'ready' && !everReady.has(row.key);
			const becameAlreadyRegistered = previous !== undefined && previous.status !== 'already_registered' && row.status === 'already_registered';
			const becameAdoptable = previous !== undefined && !previous.adoptable && row.adoptable;

			// Pre-select ready devices on first sight and on their first transition to ready,
			// but never resurrect a selection the user cleared.
			if (selected[row.key] === undefined || firstTimeReady) {
				selected[row.key] = row.status === 'ready';
			} else if (becameAlreadyRegistered) {
				// The background connector adopted this device mid-session. Updating it is now
				// an explicit opt-in rather than the default.
				selected[row.key] = false;
			}

			// Fill the editable name from the adapter's suggestion. Refresh it when a device
			// finishes inspection while the field still shows the raw identifier placeholder —
			// otherwise an `already_registered` device would keep the placeholder and overwrite
			// the existing registered name on update.
			if (nameByKey[row.key] === undefined || (becameAdoptable && nameByKey[row.key] === row.identifier)) {
				nameByKey[row.key] = row.suggestedName;
			}

			// Fill in a late-arriving suggestion, but never overwrite a real choice.
			if (categoryByKey[row.key] === undefined || (categoryByKey[row.key] === null && row.suggestedCategory !== null)) {
				categoryByKey[row.key] = row.suggestedCategory;
			}

			if (row.status === 'ready') {
				everReady.add(row.key);
			}
		}

		previousRows.value = rows.slice();
	};

	const reset = (): void => {
		for (const key of Object.keys(selected)) {
			delete selected[key];
		}

		for (const key of Object.keys(nameByKey)) {
			delete nameByKey[key];
		}

		for (const key of Object.keys(categoryByKey)) {
			delete categoryByKey[key];
		}

		everReady.clear();
		previousRows.value = [];
	};

	return {
		selected,
		nameByKey,
		categoryByKey,
		reconcile,
		reset,
	};
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- useDeviceWizardState`
Expected: PASS, 12 tests.

- [ ] **Step 5: Export from the composables barrel**

Modify `apps/admin/src/modules/devices/composables/composables.ts` — add before the trailing `export * from './types';`:

```ts
export * from './useDeviceWizardState';
```

- [ ] **Step 6: Run lint**

Run: `pnpm run lint:js`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/modules/devices/composables
git commit -m "$(cat <<'EOF'
feat(admin): device wizard selection reconciliation

Consolidates the auto-preselect, name prefill and category prefill logic
that was duplicated across the three plugin wizard composables.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wizard state — derived selection and the action model

**Files:**
- Modify: `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts`
- Modify: `apps/admin/src/modules/devices/composables/useDeviceWizardState.spec.ts`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.actions.ts`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.actions.spec.ts`
- Modify: `apps/admin/src/modules/devices/components/wizard/components.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 and 3.
- Produces:
  - `useDeviceWizardState(rows: ComputedRef<IWizardRow[]> | Ref<IWizardRow[]>)` — now takes the rows ref and additionally returns `activeStep: Ref<IWizardStep>`, `activeStepIndex: ComputedRef<number>`, `adoptableRows: ComputedRef<IWizardRow[]>`, `selectedRows: ComputedRef<IWizardRow[]>`, `canContinue: ComputedRef<boolean>`, `allSelected: ComputedRef<boolean>`, `someSelected: ComputedRef<boolean>`, `toggleAll(value: boolean): void`, `buildSelection(): IWizardAdoptSelection[]`.
  - `buildWizardActions(step: IWizardStep, context: IWizardActionsContext): IWizardAction[]`.

- [ ] **Step 1: Write the failing derived-state tests**

Append to `apps/admin/src/modules/devices/composables/useDeviceWizardState.spec.ts`. Add `computed, ref` to the `vue` import at the top of the file, and `IWizardStep` is not needed here.

```ts
import { ref } from 'vue';
```

```ts
describe('useDeviceWizardState — derived state', () => {
	it('exposes only adoptable rows', () => {
		const rows = ref<IWizardRow[]>([row(), row({ key: 'b', identifier: 'b', status: 'unsupported', adoptable: false })]);
		const state = useDeviceWizardState(rows);

		expect(state.adoptableRows.value.map((item) => item.key)).toEqual(['shelly-1.local']);
	});

	it('canContinue is false with nothing selected', () => {
		const rows = ref<IWizardRow[]>([row()]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.selected['shelly-1.local'] = false;

		expect(state.canContinue.value).toBe(false);
	});

	it('canContinue is false when a selected row has a blank name', () => {
		const rows = ref<IWizardRow[]>([row()]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.nameByKey['shelly-1.local'] = '   ';

		expect(state.canContinue.value).toBe(false);
	});

	it('canContinue is false when a selected row has no category', () => {
		const rows = ref<IWizardRow[]>([row()]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.categoryByKey['shelly-1.local'] = null;

		expect(state.canContinue.value).toBe(false);
	});

	it('canContinue is true when every selected row has a name and category', () => {
		const rows = ref<IWizardRow[]>([row()]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);

		expect(state.canContinue.value).toBe(true);
	});

	it('toggleAll selects and clears every adoptable row', () => {
		const rows = ref<IWizardRow[]>([row(), row({ key: 'b', identifier: 'b' }), row({ key: 'c', identifier: 'c', adoptable: false, status: 'failed' })]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.toggleAll(false);
		expect(state.allSelected.value).toBe(false);
		expect(state.someSelected.value).toBe(false);

		state.toggleAll(true);
		expect(state.allSelected.value).toBe(true);
		expect(state.selected['c']).toBeUndefined();
	});

	it('someSelected is true and allSelected false on a partial selection', () => {
		const rows = ref<IWizardRow[]>([row(), row({ key: 'b', identifier: 'b' })]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.selected['b'] = false;

		expect(state.someSelected.value).toBe(true);
		expect(state.allSelected.value).toBe(false);
	});

	it('buildSelection returns trimmed names and resolved categories for selected rows only', () => {
		const rows = ref<IWizardRow[]>([row(), row({ key: 'b', identifier: 'b' })]);
		const state = useDeviceWizardState(rows);

		state.reconcile(rows.value);
		state.selected['b'] = false;
		state.nameByKey['shelly-1.local'] = '  Trimmed  ';

		expect(state.buildSelection()).toEqual([
			{ key: 'shelly-1.local', name: 'Trimmed', category: DevicesModuleDeviceCategory.lighting },
		]);
	});

	it('activeStepIndex maps each step to its el-steps index', () => {
		const rows = ref<IWizardRow[]>([]);
		const state = useDeviceWizardState(rows);

		expect(state.activeStepIndex.value).toBe(0);

		state.activeStep.value = 'confirm';
		expect(state.activeStepIndex.value).toBe(1);

		state.activeStep.value = 'results';
		expect(state.activeStepIndex.value).toBe(2);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- useDeviceWizardState`
Expected: FAIL — `state.adoptableRows` is undefined; `useDeviceWizardState` takes no argument.

- [ ] **Step 3: Extend the composable**

Modify `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts`. Replace the import block, interface and signature; keep `reconcile` and `reset` exactly as written in Task 3 and add the new members.

Replace the imports with:

```ts
import { type ComputedRef, type Reactive, type Ref, computed, reactive, ref } from 'vue';

import type { IWizardAdoptSelection, IWizardRow, IWizardStep } from '../components/wizard/device-wizard.types';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
```

Replace the interface with:

```ts
export interface IUseDeviceWizardState {
	activeStep: Ref<IWizardStep>;
	activeStepIndex: ComputedRef<number>;
	selected: Reactive<Record<string, boolean>>;
	nameByKey: Reactive<Record<string, string>>;
	categoryByKey: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	adoptableRows: ComputedRef<IWizardRow[]>;
	selectedRows: ComputedRef<IWizardRow[]>;
	canContinue: ComputedRef<boolean>;
	allSelected: ComputedRef<boolean>;
	someSelected: ComputedRef<boolean>;
	toggleAll: (value: boolean) => void;
	reconcile: (rows: IWizardRow[]) => void;
	reset: () => void;
	buildSelection: () => IWizardAdoptSelection[];
}
```

Change the signature to accept the rows ref, defaulting to an empty ref so the Task 3 tests still construct it with no argument:

```ts
export const useDeviceWizardState = (rows: Ref<IWizardRow[]> | ComputedRef<IWizardRow[]> = ref([])): IUseDeviceWizardState => {
```

Add these members inside the composable, after `categoryByKey` is declared and before `reconcile`:

```ts
	const activeStep = ref<IWizardStep>('discover');

	const activeStepIndex = computed<number>(() => {
		if (activeStep.value === 'confirm') {
			return 1;
		}

		if (activeStep.value === 'results') {
			return 2;
		}

		return 0;
	});

	const adoptableRows = computed<IWizardRow[]>(() => rows.value.filter((item) => item.adoptable));

	const selectedRows = computed<IWizardRow[]>(() => adoptableRows.value.filter((item) => selected[item.key] === true));

	const canContinue = computed<boolean>(() => {
		if (selectedRows.value.length === 0) {
			return false;
		}

		return selectedRows.value.every((item) => {
			const name = nameByKey[item.key];
			const category = categoryByKey[item.key];

			return typeof name === 'string' && name.trim().length > 0 && category !== null && category !== undefined;
		});
	});

	const allSelected = computed<boolean>(
		() => adoptableRows.value.length > 0 && adoptableRows.value.every((item) => selected[item.key] === true)
	);

	const someSelected = computed<boolean>(() => adoptableRows.value.some((item) => selected[item.key] === true));

	const toggleAll = (value: boolean): void => {
		for (const item of adoptableRows.value) {
			selected[item.key] = value;
		}
	};

	const buildSelection = (): IWizardAdoptSelection[] =>
		selectedRows.value.map((item) => ({
			key: item.key,
			name: (nameByKey[item.key] ?? item.suggestedName).trim(),
			category: categoryByKey[item.key] as DevicesModuleDeviceCategory,
		}));
```

Extend the returned object to include all new members alongside the existing ones:

```ts
	return {
		activeStep,
		activeStepIndex,
		selected,
		nameByKey,
		categoryByKey,
		adoptableRows,
		selectedRows,
		canContinue,
		allSelected,
		someSelected,
		toggleAll,
		reconcile,
		reset,
		buildSelection,
	};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- useDeviceWizardState`
Expected: PASS, 21 tests.

- [ ] **Step 5: Write the failing action-model tests**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.actions.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { type IWizardActionsContext, buildWizardActions } from './device-wizard.actions';

const context = (overrides: Partial<IWizardActionsContext> = {}): IWizardActionsContext => ({
	t: (key: string) => key,
	capabilities: { addMore: false },
	canContinue: true,
	hasAdoptable: true,
	busy: false,
	onCancel: vi.fn(),
	onBack: vi.fn(),
	onNext: vi.fn(),
	onAdopt: vi.fn(),
	onAddMore: vi.fn(),
	onDone: vi.fn(),
	...overrides,
});

describe('buildWizardActions', () => {
	it('offers cancel and next on the discover step', () => {
		expect(buildWizardActions('discover', context()).map((action) => action.id)).toEqual(['cancel', 'next']);
	});

	it('disables next when there is nothing adoptable', () => {
		const actions = buildWizardActions('discover', context({ hasAdoptable: false }));

		expect(actions.find((action) => action.id === 'next')?.disabled).toBe(true);
	});

	it('offers back, cancel and adopt on the confirm step', () => {
		expect(buildWizardActions('confirm', context()).map((action) => action.id)).toEqual(['back', 'cancel', 'adopt']);
	});

	it('disables adopt unless the selection is complete', () => {
		const actions = buildWizardActions('confirm', context({ canContinue: false }));

		expect(actions.find((action) => action.id === 'adopt')?.disabled).toBe(true);
	});

	it('marks adopt as loading while the adapter is busy', () => {
		const actions = buildWizardActions('confirm', context({ busy: true }));

		expect(actions.find((action) => action.id === 'adopt')?.loading).toBe(true);
	});

	it('offers only done on the results step when addMore is unavailable', () => {
		expect(buildWizardActions('results', context()).map((action) => action.id)).toEqual(['done']);
	});

	it('offers addMore before done when the plugin declares the capability', () => {
		const actions = buildWizardActions('results', context({ capabilities: { addMore: true } }));

		expect(actions.map((action) => action.id)).toEqual(['addMore', 'done']);
	});

	it('wires each action to its handler', () => {
		const onAdopt = vi.fn();
		const actions = buildWizardActions('confirm', context({ onAdopt }));

		actions.find((action) => action.id === 'adopt')?.handler();

		expect(onAdopt).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.actions`
Expected: FAIL — cannot resolve `./device-wizard.actions`.

- [ ] **Step 7: Implement the action model**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.actions.ts`:

```ts
import type { IDeviceWizardCapabilities, IWizardAction, IWizardStep } from './device-wizard.types';

export interface IWizardActionsContext {
	t: (key: string) => string;
	capabilities: IDeviceWizardCapabilities;
	canContinue: boolean;
	hasAdoptable: boolean;
	busy: boolean;
	onCancel: () => void;
	onBack: () => void;
	onNext: () => void | Promise<void>;
	onAdopt: () => void | Promise<void>;
	onAddMore: () => void | Promise<void>;
	onDone: () => void;
}

/**
 * Single source of truth for the wizard action bar. Rendered twice — once in the desktop
 * `view-header` `#extra` slot and once in the mobile footer — so the per-step button logic
 * lives here rather than being duplicated in both templates.
 */
export const buildWizardActions = (step: IWizardStep, context: IWizardActionsContext): IWizardAction[] => {
	const { t } = context;

	if (step === 'discover') {
		return [
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'next',
				label: t('devicesModule.wizard.actions.next'),
				variant: 'primary',
				disabled: !context.hasAdoptable,
				handler: context.onNext,
			},
		];
	}

	if (step === 'confirm') {
		return [
			{ id: 'back', label: t('devicesModule.wizard.actions.back'), variant: 'default', handler: context.onBack },
			{ id: 'cancel', label: t('devicesModule.wizard.actions.cancel'), variant: 'link', handler: context.onCancel },
			{
				id: 'adopt',
				label: t('devicesModule.wizard.actions.adopt'),
				variant: 'primary',
				disabled: !context.canContinue,
				loading: context.busy,
				handler: context.onAdopt,
			},
		];
	}

	const actions: IWizardAction[] = [];

	if (context.capabilities.addMore) {
		actions.push({
			id: 'addMore',
			label: t('devicesModule.wizard.actions.addMore'),
			variant: 'default',
			loading: context.busy,
			handler: context.onAddMore,
		});
	}

	actions.push({ id: 'done', label: t('devicesModule.wizard.actions.done'), variant: 'primary', handler: context.onDone });

	return actions;
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.actions`
Expected: PASS, 8 tests.

- [ ] **Step 9: Export and verify**

Modify `apps/admin/src/modules/devices/components/wizard/components.ts`:

```ts
export * from './device-wizard.types';
export * from './device-wizard.sort';
export * from './device-wizard.actions';
```

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: PASS.

Run: `pnpm run lint:js`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add apps/admin/src/modules/devices/composables apps/admin/src/modules/devices/components/wizard
git commit -m "$(cat <<'EOF'
feat(admin): device wizard derived selection state and action model

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Discover step component

**Files:**
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.vue`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.spec.ts`
- Modify: `apps/admin/src/modules/devices/components/wizard/components.ts`

**Interfaces:**
- Consumes: `IWizardRow`, `IWizardColumn`, `IWizardControl`, `IWizardCell`, `IWizardRowStatus`, `compareLocale` from Task 1.
- Produces: default export `DeviceWizardDiscoverStep` with props `{ rows: IWizardRow[]; columns: IWizardColumn[]; controls: IWizardControl[]; identifierLabel: string; ready: boolean }`. Task 8 mounts it.

Status tag colours are shared across the discover and confirm steps, so this task also adds the exported helper both use.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IWizardControl, IWizardRow } from './device-wizard.types';

import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: 'Shelly Plus 1',
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [],
	...overrides,
});

const mountStep = (controls: IWizardControl[] = [], rows: IWizardRow[] = [row()]) =>
	mount(DeviceWizardDiscoverStep, {
		props: { rows, columns: [], controls, identifierLabel: 'Hostname', ready: true },
		global: { stubs: { 'router-link': true } },
	});

describe('DeviceWizardDiscoverStep', () => {
	it('renders a banner control', () => {
		const wrapper = mountStep([{ type: 'banner', id: 'hint', severity: 'info', title: 'Scanning the network' }]);

		expect(wrapper.find('[data-test-id="wizard-control-hint"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Scanning the network');
	});

	it('renders a visible progress control', () => {
		const wrapper = mountStep([{ type: 'progress', id: 'scan', label: 'Found 3 devices', percentage: 40, visible: true }]);

		expect(wrapper.find('[data-test-id="wizard-control-scan"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Found 3 devices');
	});

	it('hides the content of an invisible progress control but keeps the slot', () => {
		const wrapper = mountStep([{ type: 'progress', id: 'pairing', label: 'Pairing open', percentage: 0, visible: false }]);

		expect(wrapper.find('[data-test-id="wizard-control-pairing"]').classes()).toContain('invisible');
	});

	it('invokes an action control handler on click', async () => {
		const handler = vi.fn();
		const wrapper = mountStep([{ type: 'action', id: 'restart', label: 'Restart scan', icon: 'mdi:radar', handler }]);

		await wrapper.find('[data-test-id="wizard-control-restart"] button').trigger('click');

		expect(handler).toHaveBeenCalledOnce();
	});

	it('submits a form control with its field values and clears them on success', async () => {
		const handler = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountStep([
			{
				type: 'form',
				id: 'manual',
				fields: [{ key: 'hostname', label: 'Hostname' }],
				submitLabel: 'Add',
				submitDisabled: false,
				handler,
			},
		]);

		await wrapper.find('[data-test-id="wizard-control-manual"] input').setValue('shelly-9.local');
		await wrapper.find('[data-test-id="wizard-control-manual"] form').trigger('submit');

		expect(handler).toHaveBeenCalledWith({ hostname: 'shelly-9.local' });
	});

	it('renders a row with its label, sub-label and identifier', () => {
		const wrapper = mountStep([]);

		expect(wrapper.text()).toContain('Living room switch');
		expect(wrapper.text()).toContain('Shelly Plus 1');
		expect(wrapper.text()).toContain('shelly-1.local');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-discover-step`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Add the shared status helper**

Append to `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts`:

```ts
/**
 * Tag colour per normalized status. Owned by the shell so the same status can never render
 * two different ways across plugins.
 */
export const wizardStatusTagType = (status: IWizardRowStatus): 'success' | 'info' | 'warning' | 'danger' => {
	if (status === 'ready') {
		return 'success';
	}

	if (status === 'checking' || status === 'already_registered') {
		return 'info';
	}

	if (status === 'needs_credentials' || status === 'unsupported') {
		return 'warning';
	}

	return 'danger';
};

export const wizardResultTagType = (status: IWizardResult['status']): 'success' | 'info' | 'danger' => {
	if (status === 'created') {
		return 'success';
	}

	if (status === 'updated') {
		return 'info';
	}

	return 'danger';
};
```

- [ ] **Step 4: Implement the discover step**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.vue`:

```vue
<template>
	<div
		v-loading="!ready"
		class="flex flex-col gap-3 h-full overflow-hidden min-h-[200px]"
	>
		<el-alert
			v-for="control in banners"
			:key="control.id"
			:data-test-id="`wizard-control-${control.id}`"
			:type="control.severity"
			:closable="false"
			show-icon
			class="shrink-0"
		>
			<template #title>
				{{ control.title }}
			</template>
			<template
				v-if="control.message || control.link"
				#default
			>
				<div class="flex flex-col gap-2">
					<el-text v-if="control.message">
						{{ control.message }}
					</el-text>
					<router-link
						v-if="control.link"
						:to="control.link.to"
						class="text-primary"
					>
						{{ control.link.label }}
					</router-link>
				</div>
			</template>
		</el-alert>

		<div
			v-if="progressBars.length > 0 || actionButtons.length > 0"
			class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-3">
				<div
					v-for="control in progressBars"
					:key="control.id"
					:data-test-id="`wizard-control-${control.id}`"
					class="flex min-w-0 flex-col gap-1"
					:class="{ invisible: !control.visible }"
					aria-live="polite"
				>
					<el-text>{{ control.label }}</el-text>
					<el-progress
						:percentage="control.percentage"
						:status="control.state"
					/>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				<span
					v-for="control in actionButtons"
					:key="control.id"
					:data-test-id="`wizard-control-${control.id}`"
				>
					<el-button
						:type="control.variant === 'default' ? undefined : control.variant"
						:disabled="control.disabled"
						:loading="control.loading"
						@click="control.handler"
					>
						<template #icon>
							<icon :icon="control.icon" />
						</template>
						{{ control.label }}
					</el-button>
				</span>
			</div>
		</div>

		<el-form
			v-for="control in forms"
			:key="control.id"
			:data-test-id="`wizard-control-${control.id}`"
			label-position="top"
			class="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))_auto] shrink-0"
			@submit.prevent="onSubmitForm(control)"
		>
			<el-form-item
				v-for="field in control.fields"
				:key="field.key"
				:label="field.label"
				class="mb-0!"
			>
				<el-input
					v-model="formValues[control.id][field.key]"
					:placeholder="field.placeholder"
					:name="field.key"
					:show-password="field.secret"
				/>
			</el-form-item>

			<el-form-item class="mb-0! md:self-end">
				<el-button
					type="primary"
					native-type="submit"
					:disabled="control.submitDisabled"
					:loading="control.loading"
				>
					<template
						v-if="control.submitIcon"
						#icon
					>
						<icon :icon="control.submitIcon" />
					</template>
					{{ control.submitLabel }}
				</el-button>
			</el-form-item>
		</el-form>

		<el-table
			:data="rows"
			class="h-full w-full flex-grow"
			table-layout="fixed"
			:empty-text="t('devicesModule.wizard.texts.empty')"
		>
			<el-table-column
				:label="t('devicesModule.wizard.columns.name')"
				min-width="200"
				sortable
				:sort-method="sortByLabel"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<div class="flex flex-col">
						<span class="font-medium">{{ row.label }}</span>
						<span
							v-if="row.subLabel"
							class="text-xs text-gray-500"
						>
							{{ row.subLabel }}
						</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column
				prop="identifier"
				:label="identifierLabel"
				min-width="150"
				sortable
				:sort-method="sortByIdentifier"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<code class="text-sm">{{ row.identifier }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.status')"
				width="180"
				sortable
				:sort-method="sortByStatus"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-tag :type="wizardStatusTagType(row.status)">
						{{ row.statusLabel ?? t(`devicesModule.wizard.statuses.${row.status}`) }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				v-for="column in extraColumns"
				:key="column.key"
				:label="column.label"
				:width="column.width"
				:min-width="column.minWidth"
				:sortable="column.sortable"
				:sort-method="(a: IWizardRow, b: IWizardRow) => sortByCell(column.key, a, b)"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<device-wizard-cell :cell="row.cells?.[column.key]" />
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElProgress, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import DeviceWizardCell from './device-wizard-cell.vue';
import { compareLocale } from './device-wizard.sort';
import {
	type IWizardActionControl,
	type IWizardBannerControl,
	type IWizardColumn,
	type IWizardControl,
	type IWizardFormControl,
	type IWizardProgressControl,
	type IWizardRow,
	wizardStatusTagType,
} from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardDiscoverStep',
});

interface IProps {
	rows: IWizardRow[];
	columns: IWizardColumn[];
	controls: IWizardControl[];
	identifierLabel: string;
	ready: boolean;
}

const props = defineProps<IProps>();

const { t } = useI18n();

const banners = computed<IWizardBannerControl[]>(() => props.controls.filter((item): item is IWizardBannerControl => item.type === 'banner'));

const progressBars = computed<IWizardProgressControl[]>(() =>
	props.controls.filter((item): item is IWizardProgressControl => item.type === 'progress')
);

const actionButtons = computed<IWizardActionControl[]>(() => props.controls.filter((item): item is IWizardActionControl => item.type === 'action'));

const forms = computed<IWizardFormControl[]>(() => props.controls.filter((item): item is IWizardFormControl => item.type === 'form'));

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('discover')));

// Field values are keyed by control id so several forms can coexist. Rebuilt whenever the
// set of form controls changes so a newly-declared form always has a backing record.
const formValues = reactive<Record<string, Record<string, string>>>({});

watch(
	forms,
	(next: IWizardFormControl[]): void => {
		for (const control of next) {
			if (formValues[control.id] === undefined) {
				formValues[control.id] = Object.fromEntries(control.fields.map((field) => [field.key, '']));
			}
		}
	},
	{ immediate: true }
);

// Clear the inputs only when the handler resolves — a rejection leaves what the user typed
// in place so they can correct it and retry.
const onSubmitForm = async (control: IWizardFormControl): Promise<void> => {
	try {
		await control.handler({ ...formValues[control.id] });

		formValues[control.id] = Object.fromEntries(control.fields.map((field) => [field.key, '']));
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}
};

const sortByLabel = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.label, b.label);

const sortByIdentifier = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.identifier, b.identifier);

// Group adoptable rows ahead of unsupported / failed ones, then by identifier inside each
// bucket, so freshly-discovered devices stay at the top.
const sortByStatus = (a: IWizardRow, b: IWizardRow): number => {
	const diff = (a.adoptable ? 0 : 1) - (b.adoptable ? 0 : 1);

	return diff !== 0 ? diff : compareLocale(a.identifier, b.identifier);
};

const sortByCell = (key: string, a: IWizardRow, b: IWizardRow): number => compareLocale(a.cells?.[key]?.value, b.cells?.[key]?.value);
</script>
```

- [ ] **Step 5: Create the shared cell renderer**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-cell.vue` — used by all three step components:

```vue
<template>
	<el-tooltip
		v-if="cell?.render === 'tag' && cell.tooltip"
		:content="cell.tooltip"
		placement="top"
	>
		<el-tag
			size="small"
			:type="cell.variant ?? 'info'"
			effect="plain"
		>
			{{ cell.value }}
		</el-tag>
	</el-tooltip>

	<el-tag
		v-else-if="cell?.render === 'tag'"
		size="small"
		:type="cell.variant ?? 'info'"
		effect="plain"
	>
		{{ cell.value }}
	</el-tag>

	<code
		v-else-if="cell?.render === 'code'"
		class="text-sm"
	>
		{{ cell.value }}
	</code>

	<span
		v-else-if="cell?.render === 'text'"
		:class="cell.muted ? 'text-gray-500' : undefined"
	>
		{{ cell.value }}
	</span>

	<span
		v-else
		class="text-gray-400"
	>
		&mdash;
	</span>
</template>

<script setup lang="ts">
import { ElTag, ElTooltip } from 'element-plus';

import type { IWizardCell } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardCell',
});

defineProps<{
	cell?: IWizardCell;
}>();
</script>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-discover-step`
Expected: PASS, 6 tests.

- [ ] **Step 7: Export and verify**

Modify `apps/admin/src/modules/devices/components/wizard/components.ts` — add above the existing type exports:

```ts
export { default as DeviceWizardCell } from './device-wizard-cell.vue';
export { default as DeviceWizardDiscoverStep } from './device-wizard-discover-step.vue';
```

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/modules/devices/components/wizard
git commit -m "$(cat <<'EOF'
feat(admin): device wizard discover step

Renders the four declarative control descriptors plus the read-only
found-devices table.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Confirm step component

**Files:**
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.vue`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.spec.ts`
- Modify: `apps/admin/src/modules/devices/components/wizard/components.ts`

**Interfaces:**
- Consumes: Task 1 contracts, `DeviceWizardCell` from Task 5.
- Produces: default export `DeviceWizardConfirmStep` with props `{ rows: IWizardRow[]; columns: IWizardColumn[]; selected: Record<string, boolean>; nameByKey: Record<string, string>; categoryByKey: Record<string, DevicesModuleDeviceCategory | null>; identifierLabel: string; allSelected: boolean; someSelected: boolean }` and emits `toggle-all(value: boolean)`, `toggle-row(key: string, value: boolean)`, `update-name(key: string, value: string)`, `update-category(key: string, value: DevicesModuleDeviceCategory | null)`.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IWizardRow } from './device-wizard.types';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: 'Shelly Plus 1',
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

const mountStep = (rows: IWizardRow[] = [row()], props: Record<string, unknown> = {}) =>
	mount(DeviceWizardConfirmStep, {
		props: {
			rows,
			columns: [],
			selected: { 'shelly-1.local': true },
			nameByKey: { 'shelly-1.local': 'Living room switch' },
			categoryByKey: { 'shelly-1.local': DevicesModuleDeviceCategory.lighting },
			identifierLabel: 'Hostname',
			allSelected: true,
			someSelected: true,
			...props,
		},
	});

describe('DeviceWizardConfirmStep', () => {
	it('renders one row per adoptable device', () => {
		const wrapper = mountStep([row(), row({ key: 'b', identifier: 'b' })]);

		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
	});

	it('emits toggle-row when a row checkbox changes', async () => {
		const wrapper = mountStep();

		await wrapper.find('tbody input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('toggle-row')?.[0]).toEqual(['shelly-1.local', false]);
	});

	it('emits toggle-all when the header checkbox changes', async () => {
		const wrapper = mountStep();

		await wrapper.find('thead input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('toggle-all')?.[0]).toEqual([false]);
	});

	it('emits update-name when the name input changes', async () => {
		const wrapper = mountStep();

		await wrapper.find('tbody input[type="text"]').setValue('Renamed');

		expect(wrapper.emitted('update-name')?.[0]).toEqual(['shelly-1.local', 'Renamed']);
	});

	it('shows a will-create tag for a new device', () => {
		const wrapper = mountStep();

		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willCreate');
	});

	it('shows a will-update tag for an already-registered device', () => {
		const wrapper = mountStep([row({ status: 'already_registered', willUpdate: true })]);

		expect(wrapper.text()).toContain('devicesModule.wizard.statuses.willUpdate');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-confirm-step`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement the confirm step**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.vue`:

```vue
<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-table
			:data="rows"
			class="h-full w-full flex-grow"
			table-layout="fixed"
			:empty-text="t('devicesModule.wizard.texts.noSelection')"
			:default-sort="{ prop: 'name', order: 'ascending' }"
		>
			<el-table-column width="60">
				<template #header>
					<el-checkbox
						:model-value="allSelected"
						:indeterminate="someSelected && !allSelected"
						:disabled="rows.length === 0"
						@change="(value: boolean | string | number) => emit('toggle-all', value === true)"
					/>
				</template>
				<template #default="{ row }: { row: IWizardRow }">
					<el-checkbox
						:model-value="selected[row.key] === true"
						@change="(value: boolean | string | number) => emit('toggle-row', row.key, value === true)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				prop="name"
				:label="t('devicesModule.wizard.columns.name')"
				min-width="220"
				sortable
				:sort-method="sortByName"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-input
						:model-value="nameByKey[row.key] ?? ''"
						@update:model-value="(value: string) => emit('update-name', row.key, value)"
					/>
				</template>
			</el-table-column>

			<el-table-column
				prop="identifier"
				:label="identifierLabel"
				min-width="150"
				sortable
				:sort-method="sortByIdentifier"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<code class="text-sm">{{ row.identifier }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.change')"
				width="170"
				sortable
				:sort-method="sortByChange"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-tag
						size="small"
						:type="row.willUpdate ? 'warning' : 'success'"
					>
						{{ row.willUpdate ? t('devicesModule.wizard.statuses.willUpdate') : t('devicesModule.wizard.statuses.willCreate') }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.category')"
				min-width="240"
				sortable
				:sort-method="sortByCategory"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<el-select
						:model-value="categoryByKey[row.key] ?? null"
						filterable
						@update:model-value="(value: DevicesModuleDeviceCategory | null) => emit('update-category', row.key, value)"
					>
						<el-option
							v-for="option in row.categoryOptions"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>
				</template>
			</el-table-column>

			<el-table-column
				v-for="column in extraColumns"
				:key="column.key"
				:label="column.label"
				:width="column.width"
				:min-width="column.minWidth"
				:sortable="column.sortable"
				:sort-method="(a: IWizardRow, b: IWizardRow) => sortByCell(column.key, a, b)"
			>
				<template #default="{ row }: { row: IWizardRow }">
					<device-wizard-cell :cell="row.cells?.[column.key]" />
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElInput, ElOption, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

import DeviceWizardCell from './device-wizard-cell.vue';
import { compareLocale } from './device-wizard.sort';
import type { IWizardColumn, IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardConfirmStep',
});

interface IProps {
	rows: IWizardRow[];
	columns: IWizardColumn[];
	selected: Record<string, boolean>;
	nameByKey: Record<string, string>;
	categoryByKey: Record<string, DevicesModuleDeviceCategory | null>;
	identifierLabel: string;
	allSelected: boolean;
	someSelected: boolean;
}

const props = defineProps<IProps>();

const emit = defineEmits<{
	(e: 'toggle-all', value: boolean): void;
	(e: 'toggle-row', key: string, value: boolean): void;
	(e: 'update-name', key: string, value: string): void;
	(e: 'update-category', key: string, value: DevicesModuleDeviceCategory | null): void;
}>();

const { t } = useI18n();

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('confirm')));

// `prop`-based sorting can't reach into the parent-owned name / category records, so each
// editable column gets a comparator that reads the current value rather than the row field.
const sortByName = (a: IWizardRow, b: IWizardRow): number =>
	compareLocale(props.nameByKey[a.key] ?? a.suggestedName, props.nameByKey[b.key] ?? b.suggestedName);

const sortByIdentifier = (a: IWizardRow, b: IWizardRow): number => compareLocale(a.identifier, b.identifier);

// Group "will create" rows ahead of "will update" ones so new devices are scanned first.
const sortByChange = (a: IWizardRow, b: IWizardRow): number => {
	const diff = (a.willUpdate ? 1 : 0) - (b.willUpdate ? 1 : 0);

	return diff !== 0 ? diff : compareLocale(a.identifier, b.identifier);
};

const sortByCategory = (a: IWizardRow, b: IWizardRow): number => {
	const label = (row: IWizardRow): string => {
		const category = props.categoryByKey[row.key];

		return row.categoryOptions.find((option) => option.value === category)?.label ?? '';
	};

	return compareLocale(label(a), label(b));
};

const sortByCell = (key: string, a: IWizardRow, b: IWizardRow): number => compareLocale(a.cells?.[key]?.value, b.cells?.[key]?.value);
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-confirm-step`
Expected: PASS, 6 tests.

- [ ] **Step 5: Export and verify**

Add to `apps/admin/src/modules/devices/components/wizard/components.ts`:

```ts
export { default as DeviceWizardConfirmStep } from './device-wizard-confirm-step.vue';
```

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/modules/devices/components/wizard
git commit -m "$(cat <<'EOF'
feat(admin): device wizard confirm step

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Results step component

**Files:**
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-results-step.vue`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard-results-step.spec.ts`
- Modify: `apps/admin/src/modules/devices/components/wizard/components.ts`

**Interfaces:**
- Consumes: `IWizardResult`, `IWizardColumn`, `wizardResultTagType`, `compareLocale`, `DeviceWizardCell`.
- Produces: default export `DeviceWizardResultsStep` with props `{ results: IWizardResult[]; columns: IWizardColumn[]; identifierLabel: string }`. No emits — the action bar lives in the shell.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-results-step.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IWizardResult } from './device-wizard.types';

import DeviceWizardResultsStep from './device-wizard-results-step.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const result = (overrides: Partial<IWizardResult> = {}): IWizardResult => ({
	key: 'shelly-1.local',
	name: 'Living room switch',
	identifier: 'shelly-1.local',
	status: 'created',
	error: null,
	...overrides,
});

const mountStep = (results: IWizardResult[]) =>
	mount(DeviceWizardResultsStep, {
		props: { results, columns: [], identifierLabel: 'Hostname' },
	});

describe('DeviceWizardResultsStep', () => {
	it('shows the success summary when nothing failed', () => {
		const wrapper = mountStep([result()]);

		expect(wrapper.text()).toContain('devicesModule.wizard.texts.resultsSuccess');
	});

	it('shows the failure summary when any row failed', () => {
		const wrapper = mountStep([result(), result({ key: 'b', identifier: 'b', status: 'failed', error: 'Unauthorized' })]);

		expect(wrapper.text()).toContain('devicesModule.wizard.texts.resultsFailed');
	});

	it('renders the error message for a failed row', () => {
		const wrapper = mountStep([result({ status: 'failed', error: 'Unauthorized' })]);

		expect(wrapper.text()).toContain('Unauthorized');
	});

	it('renders one row per result', () => {
		const wrapper = mountStep([result(), result({ key: 'b', identifier: 'b' })]);

		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-results-step`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement the results step**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard-results-step.vue`:

```vue
<template>
	<div class="flex flex-col gap-3 h-full overflow-hidden">
		<el-alert
			:title="hasFailures ? t('devicesModule.wizard.texts.resultsFailed') : t('devicesModule.wizard.texts.resultsSuccess')"
			:type="hasFailures ? 'warning' : 'success'"
			:closable="false"
			show-icon
			class="shrink-0"
		/>

		<el-table
			:data="sortedResults"
			class="h-full w-full flex-grow"
			table-layout="fixed"
		>
			<el-table-column
				:label="t('devicesModule.wizard.columns.status')"
				width="140"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<el-tag :type="wizardResultTagType(row.status)">
						{{ t(`devicesModule.wizard.statuses.${row.status}`) }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.name')"
				min-width="200"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<span class="font-medium">{{ row.name }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="identifierLabel"
				min-width="150"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<code class="text-sm">{{ row.identifier }}</code>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModule.wizard.columns.error')"
				min-width="220"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<span
						v-if="row.error"
						class="text-red-500"
					>
						{{ row.error }}
					</span>
					<span
						v-else
						class="text-gray-400"
					>
						&mdash;
					</span>
				</template>
			</el-table-column>

			<el-table-column
				v-for="column in extraColumns"
				:key="column.key"
				:label="column.label"
				:width="column.width"
				:min-width="column.minWidth"
			>
				<template #default="{ row }: { row: IWizardResult }">
					<device-wizard-cell :cell="row.cells?.[column.key]" />
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElTable, ElTableColumn, ElTag } from 'element-plus';

import DeviceWizardCell from './device-wizard-cell.vue';
import { compareLocale } from './device-wizard.sort';
import { type IWizardColumn, type IWizardResult, wizardResultTagType } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizardResultsStep',
});

interface IProps {
	results: IWizardResult[];
	columns: IWizardColumn[];
	identifierLabel: string;
}

const props = defineProps<IProps>();

const { t } = useI18n();

const hasFailures = computed<boolean>(() => props.results.some((item) => item.status === 'failed'));

const extraColumns = computed<IWizardColumn[]>(() => props.columns.filter((column) => column.steps.includes('results')));

// Failures rise to the top so the user immediately sees what needs attention, then created
// devices, then updates, falling back to name within each bucket.
const sortedResults = computed<IWizardResult[]>(() => {
	const rank = (status: IWizardResult['status']): number => {
		if (status === 'failed') {
			return 0;
		}

		return status === 'created' ? 1 : 2;
	};

	return props.results.slice().sort((a, b) => {
		const diff = rank(a.status) - rank(b.status);

		return diff !== 0 ? diff : compareLocale(a.name, b.name);
	});
});
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard-results-step`
Expected: PASS, 4 tests.

- [ ] **Step 5: Export and verify**

Add to `apps/admin/src/modules/devices/components/wizard/components.ts`:

```ts
export { default as DeviceWizardResultsStep } from './device-wizard-results-step.vue';
```

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/modules/devices/components/wizard
git commit -m "$(cat <<'EOF'
feat(admin): device wizard results step

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wizard shell

**Files:**
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.vue`
- Create: `apps/admin/src/modules/devices/components/wizard/device-wizard.spec.ts`
- Modify: `apps/admin/src/modules/devices/components/wizard/components.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: default export `DeviceWizard` with props `IDeviceWizardProps` (`{ adapterFactory: () => IDeviceWizardAdapter }`). Task 9 mounts it from `view-devices-wizard.vue`.

The shell calls `adapterFactory()` inside its own `setup()` — this is the only valid injection context for the adapter's composable calls.

- [ ] **Step 1: Write the failing test**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.spec.ts`:

```ts
import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IDeviceWizardAdapter, IWizardResult, IWizardRow } from './device-wizard.types';

import DeviceWizard from './device-wizard.vue';

const replace = vi.fn();
const push = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		replace,
		push,
		resolve: (location: unknown) => location,
	}),
	RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}));

vi.mock('../../../../common', async () => {
	const { defineComponent } = await import('vue');

	return {
		AppBarButton: defineComponent({ name: 'AppBarButton', template: '<div><slot /></div>' }),
		AppBarButtonAlign: { LEFT: 'left' },
		AppBarHeading: defineComponent({ name: 'AppBarHeading', template: '<div><slot /></div>' }),
		AppBreadcrumbs: defineComponent({ name: 'AppBreadcrumbs', template: '<div />' }),
		ViewHeader: defineComponent({ name: 'ViewHeader', template: '<div><slot name="extra" /></div>' }),
		useBreakpoints: () => ({ isMDDevice: ref(true), isLGDevice: ref(true) }),
	};
});

const row = (overrides: Partial<IWizardRow> = {}): IWizardRow => ({
	key: 'shelly-1.local',
	label: 'Living room switch',
	subLabel: null,
	identifier: 'shelly-1.local',
	status: 'ready',
	adoptable: true,
	willUpdate: false,
	suggestedName: 'Living room switch',
	suggestedCategory: DevicesModuleDeviceCategory.lighting,
	categoryOptions: [{ value: DevicesModuleDeviceCategory.lighting, label: 'Lighting' }],
	...overrides,
});

const buildAdapter = (overrides: Partial<IDeviceWizardAdapter> = {}): IDeviceWizardAdapter => ({
	title: 'Shelly NG',
	subtitle: 'Add Shelly devices',
	breadcrumbLabel: 'Wizard',
	pluginType: 'devices-shelly-ng-plugin',
	identifierLabel: 'Hostname',
	rows: computed(() => [row()]),
	results: computed<IWizardResult[]>(() => []),
	columns: [],
	controls: computed(() => []),
	ready: computed(() => true),
	busy: computed(() => false),
	capabilities: { addMore: false },
	start: vi.fn().mockResolvedValue(undefined),
	adopt: vi.fn().mockResolvedValue([]),
	...overrides,
});

const mountWizard = (adapter: IDeviceWizardAdapter) =>
	mount(DeviceWizard, {
		props: { adapterFactory: () => adapter },
		global: { stubs: { 'router-link': true } },
	});

describe('DeviceWizard', () => {
	it('calls start on mount', async () => {
		const adapter = buildAdapter();
		mountWizard(adapter);
		await flushPromises();

		expect(adapter.start).toHaveBeenCalledOnce();
	});

	it('calls dispose on unmount', async () => {
		const dispose = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ dispose }));
		await flushPromises();

		wrapper.unmount();

		expect(dispose).toHaveBeenCalledOnce();
	});

	it('renders the adapter title', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		expect(wrapper.text()).toContain('Shelly NG');
	});

	it('advances to confirm and reconciles the rows', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
	});

	it('advances even when beforeLeaveDiscover rejects', async () => {
		const beforeLeaveDiscover = vi.fn().mockRejectedValue(new Error('permit-join off failed'));
		const wrapper = mountWizard(buildAdapter({ beforeLeaveDiscover }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();

		expect(beforeLeaveDiscover).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
	});

	it('stays on confirm when adopt rejects', async () => {
		const adopt = vi.fn().mockRejectedValue(new Error('network'));
		const wrapper = mountWizard(buildAdapter({ adopt }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-confirm"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(false);
	});

	it('advances to results when adopt resolves', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-step-results"]').exists()).toBe(true);
	});

	it('hides Add more when the plugin does not declare the capability', async () => {
		const wrapper = mountWizard(buildAdapter());
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="wizard-action-addMore"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-done"]').exists()).toBe(true);
	});

	it('shows Add more and returns to discover after restart resolves', async () => {
		const restart = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountWizard(buildAdapter({ capabilities: { addMore: true }, restart }));
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-adopt"]').trigger('click');
		await flushPromises();
		await wrapper.find('[data-test-id="wizard-action-addMore"]').trigger('click');
		await flushPromises();

		expect(restart).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-test-id="wizard-step-discover"]').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.spec`
Expected: FAIL — cannot resolve `./device-wizard.vue`.

- [ ] **Step 3: Implement the shell**

Create `apps/admin/src/modules/devices/components/wizard/device-wizard.vue`:

```vue
<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ adapter.title }}
		</template>

		<template #subtitle>
			{{ adapter.subtitle }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="adapter.title"
		:sub-heading="adapter.subtitle"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					v-for="action in actions"
					:key="action.id"
					:data-test-id="`wizard-action-${action.id}`"
					:link="action.variant === 'link'"
					:type="action.variant === 'primary' ? 'primary' : undefined"
					class="px-4!"
					:disabled="action.disabled"
					:loading="action.loading"
					@click="action.handler"
				>
					{{ action.label }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="activeStepIndex"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesModule.wizard.steps.discover')" />
					<el-step :title="t('devicesModule.wizard.steps.confirm')" />
					<el-step :title="t('devicesModule.wizard.steps.results')" />
				</el-steps>
			</template>

			<div class="p-4 max-h-full box-border flex flex-col gap-3 overflow-hidden">
				<device-wizard-discover-step
					v-if="activeStep === 'discover'"
					data-test-id="wizard-step-discover"
					:rows="adapter.rows.value"
					:columns="adapter.columns"
					:controls="adapter.controls.value"
					:identifier-label="adapter.identifierLabel"
					:ready="adapter.ready.value"
				/>

				<device-wizard-confirm-step
					v-else-if="activeStep === 'confirm'"
					data-test-id="wizard-step-confirm"
					:rows="adoptableRows"
					:columns="adapter.columns"
					:selected="selected"
					:name-by-key="nameByKey"
					:category-by-key="categoryByKey"
					:identifier-label="adapter.identifierLabel"
					:all-selected="allSelected"
					:some-selected="someSelected"
					@toggle-all="toggleAll"
					@toggle-row="onToggleRow"
					@update-name="onUpdateName"
					@update-category="onUpdateCategory"
				/>

				<device-wizard-results-step
					v-else
					data-test-id="wizard-step-results"
					:results="adapter.results.value"
					:columns="adapter.columns"
					:identifier-label="adapter.identifierLabel"
				/>
			</div>

			<div
				v-if="!isMDDevice"
				class="flex justify-end gap-2 p-4 border-t border-t-solid"
			>
				<el-button
					v-for="action in actions"
					:key="action.id"
					:data-test-id="`wizard-action-mobile-${action.id}`"
					:link="action.variant === 'link'"
					:type="action.variant === 'primary' ? 'primary' : undefined"
					:disabled="action.disabled"
					:loading="action.loading"
					@click="action.handler"
				>
					{{ action.label }}
				</el-button>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { useDeviceWizardState } from '../../composables/useDeviceWizardState';
import { RouteNames } from '../../devices.constants';

import DeviceWizardConfirmStep from './device-wizard-confirm-step.vue';
import DeviceWizardDiscoverStep from './device-wizard-discover-step.vue';
import DeviceWizardResultsStep from './device-wizard-results-step.vue';
import { buildWizardActions } from './device-wizard.actions';
import type { IDeviceWizardProps, IWizardAction, IWizardRow } from './device-wizard.types';

defineOptions({
	name: 'DeviceWizard',
});

const props = defineProps<IDeviceWizardProps>();

const { t } = useI18n();
const router = useRouter();
const { isMDDevice, isLGDevice } = useBreakpoints();

// The factory must be invoked here, inside setup(): the adapter is a composable and calls
// useI18n / useBackend / inject internally, which are only valid in an injection context.
const adapter = props.adapterFactory();

const {
	activeStep,
	activeStepIndex,
	selected,
	nameByKey,
	categoryByKey,
	adoptableRows,
	canContinue,
	allSelected,
	someSelected,
	toggleAll,
	reconcile,
	reset,
	buildSelection,
} = useDeviceWizardState(adapter.rows);

watch(
	adapter.rows,
	(rows: IWizardRow[]): void => {
		reconcile(rows);
	},
	{ immediate: true }
);

onMounted(async (): Promise<void> => {
	try {
		await adapter.start();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}
});

onBeforeUnmount((): void => {
	// Best-effort teardown — a failure here must never block navigation away.
	void adapter.dispose?.();
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(() => [
	{
		label: t('devicesModule.breadcrumbs.devices.list'),
		route: router.resolve({ name: RouteNames.DEVICES }),
	},
	{
		label: adapter.breadcrumbLabel,
		route: router.resolve({
			name: RouteNames.DEVICES_WIZARD,
			params: { type: adapter.pluginType },
		}),
	},
]);

const onCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.DEVICES });
	} else {
		router.push({ name: RouteNames.DEVICES });
	}
};

// Failing to close a pairing window must not trap the user on the discover step, so we
// advance regardless of the outcome.
const onNext = async (): Promise<void> => {
	try {
		await adapter.beforeLeaveDiscover?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}

	activeStep.value = 'confirm';
};

const onBack = (): void => {
	activeStep.value = 'discover';
};

const onAdopt = async (): Promise<void> => {
	try {
		await adapter.adopt(buildSelection());

		activeStep.value = 'results';
	} catch {
		// Stay on the confirm step with the user's input intact.
	}
};

// Order matters: the new session must be fully in place before the discover step renders,
// otherwise it mounts against a null session and flashes a misleading offline banner.
const onAddMore = async (): Promise<void> => {
	try {
		await adapter.restart?.();
	} catch {
		// Errors are surfaced by the adapter via flashMessage.
	}

	reset();

	activeStep.value = 'discover';
};

const onDone = (): void => {
	onCancel();
};

const actions = computed<IWizardAction[]>(() =>
	buildWizardActions(activeStep.value, {
		t,
		capabilities: adapter.capabilities,
		canContinue: canContinue.value,
		hasAdoptable: adoptableRows.value.length > 0,
		busy: adapter.busy.value,
		onCancel,
		onBack,
		onNext,
		onAdopt,
		onAddMore,
		onDone,
	})
);

const onToggleRow = (key: string, value: boolean): void => {
	selected[key] = value;
};

const onUpdateName = (key: string, value: string): void => {
	nameByKey[key] = value;
};

const onUpdateCategory = (key: string, value: DevicesModuleDeviceCategory | null): void => {
	categoryByKey[key] = value;
};
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- device-wizard.spec`
Expected: PASS, 9 tests.

- [ ] **Step 5: Export and verify**

Add to `apps/admin/src/modules/devices/components/wizard/components.ts`:

```ts
export { default as DeviceWizard } from './device-wizard.vue';
```

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/modules/devices/components/wizard
git commit -m "$(cat <<'EOF'
feat(admin): unified device wizard shell

Owns page chrome, the three-step machine, the action bar and the adapter
lifecycle. Adapters are instantiated inside setup() so their composable
calls have a valid injection context.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Adapter registration alongside the legacy component

**Files:**
- Modify: `apps/admin/src/modules/devices/devices.types.ts:23-27`
- Modify: `apps/admin/src/modules/devices/composables/useDevicesPlugins.ts:17,78`
- Modify: `apps/admin/src/modules/devices/composables/useDevicesPlugins.spec.ts`
- Modify: `apps/admin/src/modules/devices/views/view-devices-wizard.vue`
- Modify: `apps/admin/src/modules/devices/views/view-devices-wizard.spec.ts`

**Interfaces:**
- Consumes: `IDeviceWizardAdapter`, `DeviceWizard` from Tasks 1 and 8.
- Produces: `IDevicePluginsComponents.deviceWizardAdapter?: () => IDeviceWizardAdapter`. Tasks 10–12 register against it.

**`deviceWizard` stays in place** so unmigrated plugins keep working. Task 13 removes it.

- [ ] **Step 1: Write the failing host test**

Modify `apps/admin/src/modules/devices/views/view-devices-wizard.spec.ts`. Replace the `vi.mock('../composables/composables', …)` block so the devices-scoped element registers an adapter factory and the other-module element keeps a legacy component:

```ts
const adapterFactory = vi.fn(() => ({ title: 'Adapter wizard' }));

vi.mock('../composables/composables', () => ({
	useDevicesPlugins: () => ({
		getByPluginType: (type: string) =>
			type === 'multi-module-plugin'
				? {
						type: 'multi-module-plugin',
						elements: [
							{
								type: 'other-module-wizard',
								modules: ['other-module'],
								components: {
									deviceWizard: OtherWizard,
								},
							},
							{
								type: 'devices-module-wizard',
								modules: ['devices-module'],
								components: {
									deviceWizardAdapter: adapterFactory,
								},
							},
						],
					}
				: type === 'legacy-plugin'
					? {
							type: 'legacy-plugin',
							elements: [
								{
									type: 'legacy-wizard',
									modules: ['devices-module'],
									components: {
										deviceWizard: DevicesWizard,
									},
								},
							],
						}
					: undefined,
	}),
}));
```

Add a mock for the shell so the host test does not need the whole wizard tree, placed after the `common` mock:

```ts
vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');

	return {
		DeviceWizard: defineComponent({
			name: 'DeviceWizard',
			props: { adapterFactory: { type: Function, required: true } },
			template: '<div data-test-id="device-wizard" />',
		}),
	};
});
```

Replace the test body with:

```ts
describe('ViewDevicesWizard', () => {
	it('renders the shared shell for the devices-scoped adapter element', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(wrapper.find('[data-test-id="device-wizard"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="other-wizard"]').exists()).toBe(false);
	});

	it('passes the adapter factory without invoking it', () => {
		mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(adapterFactory).not.toHaveBeenCalled();
	});

	it('falls back to a legacy deviceWizard component while plugins are still being migrated', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'legacy-plugin',
			},
		});

		expect(wrapper.find('[data-test-id="devices-wizard"]').exists()).toBe(true);
	});

	it('renders the not-found state for an unknown plugin type', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'nope',
			},
		});

		expect(wrapper.find('[data-test-id="entity-not-found"]').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit -- view-devices-wizard`
Expected: FAIL — the shell is not rendered; the view still only looks at `deviceWizard`.

- [ ] **Step 3: Extend the plugin component types**

Modify `apps/admin/src/modules/devices/devices.types.ts`. Add the import at the top with the other relative imports:

```ts
import type { IDeviceWizardAdapter } from './components/wizard/device-wizard.types';
```

Extend the type (keep `deviceWizard` until Task 13):

```ts
export type IDevicePluginsComponents = {
	deviceAddForm?: DefineComponent<IDeviceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceAddFormEmits>;
	deviceEditForm?: DefineComponent<IDeviceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceEditFormEmits>;
	/** @deprecated Superseded by `deviceWizardAdapter`; removed once every plugin has migrated. */
	deviceWizard?: DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}>;
	deviceWizardAdapter?: () => IDeviceWizardAdapter;
};
```

- [ ] **Step 4: Update the plugin scan**

Modify `apps/admin/src/modules/devices/composables/useDevicesPlugins.ts` line 17:

```ts
	const pluginComponents: (keyof IDevicePluginsComponents)[] = ['deviceAddForm', 'deviceEditForm', 'deviceWizard', 'deviceWizardAdapter'];
```

And the `wizardOptions` filter at line 78, so a plugin offering either registration shows up in the chooser:

```ts
			.filter((plugin) =>
				(plugin.elements ?? []).some(
					(el) =>
						(el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME)) &&
						(!!el.components?.deviceWizard || !!el.components?.deviceWizardAdapter)
				)
			)
```

- [ ] **Step 5: Update the host view**

Replace the template of `apps/admin/src/modules/devices/views/view-devices-wizard.vue`:

```vue
<template>
	<device-wizard
		v-if="adapterFactory"
		:key="type"
		:adapter-factory="adapterFactory"
	/>

	<component
		:is="legacyWizard"
		v-else-if="legacyWizard"
	/>

	<entity-not-found
		v-else
		icon="mdi:wizard-hat"
		:message="t('devicesModule.texts.devices.noWizardForDevicePlugin', { type })"
		:button-label="t('devicesModule.buttons.back.title')"
		@back="router.push({ name: RouteNames.DEVICES })"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { EntityNotFound } from '../../../common';
import { DeviceWizard } from '../components/components';
import type { IDeviceWizardAdapter } from '../components/wizard/device-wizard.types';
import { useDevicesPlugins } from '../composables/composables';
import { DEVICES_MODULE_NAME, RouteNames } from '../devices.constants';

const props = defineProps<{
	type: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { getByPluginType } = useDevicesPlugins();

const plugin = computed(() => getByPluginType(props.type));

const eligibleElements = computed(() =>
	(plugin.value?.elements ?? []).filter((el) => el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME))
);

// Passing the factory rather than its result is deliberate: the adapter is a composable and
// must be instantiated inside the shell's setup(), not in this computed.
const adapterFactory = computed<(() => IDeviceWizardAdapter) | undefined>(
	() => eligibleElements.value.find((el) => !!el.components?.deviceWizardAdapter)?.components?.deviceWizardAdapter
);

const legacyWizard = computed(() => eligibleElements.value.find((el) => !!el.components?.deviceWizard)?.components?.deviceWizard);
</script>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- view-devices-wizard`
Expected: PASS, 4 tests.

- [ ] **Step 7: Update the plugins-composable spec**

Modify `apps/admin/src/modules/devices/composables/useDevicesPlugins.spec.ts` — in `mockPluginList`, change the `wizard-type` element's components to use the new key:

```ts
				components: {
					deviceWizardAdapter: () => ({}),
				},
```

Run: `pnpm --filter ./apps/admin run test:unit -- useDevicesPlugins`
Expected: PASS — `wizardOptions` still lists `wizard-plugin`.

- [ ] **Step 8: Verify the whole suite**

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

Manually confirm all three wizards still open (they are still on the legacy path): `pnpm run start:dev`, open the admin, go to Devices → add via wizard, and check each plugin.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/modules/devices
git commit -m "$(cat <<'EOF'
feat(admin): register device wizard adapters

Adds deviceWizardAdapter alongside the legacy deviceWizard component so
plugins can be migrated one at a time. The host passes the factory rather
than its result so the adapter is instantiated inside the shell's setup().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Migrate the Zigbee2MQTT plugin

**Files:**
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.ts`
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.spec.ts`
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts`
- Modify: `apps/admin/src/plugins/devices-zigbee2mqtt/components/components.ts`
- Delete: `zigbee2mqtt-devices-wizard.vue`, `zigbee2mqtt-wizard-discovery-step.vue`, `zigbee2mqtt-wizard-categorize-step.vue`, `zigbee2mqtt-wizard-results-step.vue`
- Delete: `apps/admin/src/plugins/devices-zigbee2mqtt/utils/wizard.sort.ts`

**Interfaces:**
- Consumes: `IDeviceWizardAdapter` and friends from Task 1.
- Produces: `useDevicesWizard(): IDeviceWizardAdapter`.

Z2M is migrated first because it is the only plugin exercising every optional part of the contract — `capabilities.addMore`, `restart`, `dispose`, `beforeLeaveDiscover`, an extra column and a banner with a route link.

**Keep unchanged inside the composable:** `startSession`, `refreshSession`, `endSession`, `enablePermitJoin`, `disablePermitJoin`, `schedulePoll`/`stopPolling`, the `sessionGeneration` guards, and the transformers. **Remove:** `selected`, `nameByIeee`, `categoryByIeee`, `readyAddresses`, `applySession`'s reconciliation loop (keep the `session.value = nextSession` assignment and the polling stop), `resetSessionScopedState`'s map clearing (keep `adoptionResults.value = []`), `selectedDevices`, `canContinue`, and the `tryOnMounted` / `tryOnUnmounted` hooks.

- [ ] **Step 1: Write the failing adapter tests**

Modify `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.spec.ts`. Keep the existing mocks and `baseDevice` / `wizardSession` fixtures. Replace assertions that reach into removed state with adapter-shaped ones, and add:

```ts
	it('maps a session device to a wizard row', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, error: undefined, response: { status: 201 } });

		const adapter = useDevicesWizard();
		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row.key).toBe('0x00158d0001a2b3c4');
		expect(row.identifier).toBe('kitchen_motion_sensor');
		expect(row.subLabel).toBe('Aqara · RTCGQ11LM');
		expect(row.status).toBe('ready');
		expect(row.adoptable).toBe(true);
		expect(row.willUpdate).toBe(false);
		expect(row.suggestedName).toBe('Kitchen Motion Sensor');
		expect(row.suggestedCategory).toBe(DevicesModuleDeviceCategory.sensor);
	});

	it('exposes the channel preview as a tag cell', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, error: undefined, response: { status: 201 } });

		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.columns).toEqual([
			expect.objectContaining({ key: 'channels', steps: ['confirm'] }),
		]);
		expect(adapter.rows.value[0].cells?.channels).toEqual({
			render: 'tag',
			value: expect.any(String),
			tooltip: 'occupancy, illuminance',
		});
	});

	it('declares the addMore capability and a restart handler', () => {
		const adapter = useDevicesWizard();

		expect(adapter.capabilities.addMore).toBe(true);
		expect(typeof adapter.restart).toBe('function');
	});

	it('surfaces a bridge-offline banner when the bridge is down', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: { data: { ...wizardSession, bridge_online: false } },
			error: undefined,
			response: { status: 201 },
		});

		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.controls.value).toContainEqual(expect.objectContaining({ type: 'banner', severity: 'warning' }));
	});

	it('offers an enable-pairing action while permit join is inactive', async () => {
		backendClient.POST.mockResolvedValueOnce({ data: { data: wizardSession }, error: undefined, response: { status: 201 } });

		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.controls.value).toContainEqual(expect.objectContaining({ type: 'action', id: 'permit-join', variant: 'primary' }));
	});
```

> Adjust the `bridge_online` key and the `POST` mock shape to match the existing fixtures in this file — the surrounding tests already establish the exact API response shape.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-zigbee2mqtt`
Expected: FAIL — `adapter.rows` is undefined.

- [ ] **Step 3: Reshape the composable into an adapter**

Modify `apps/admin/src/plugins/devices-zigbee2mqtt/composables/useDevicesWizard.ts`. Replace the exported interface and the returned object; keep every transport function as-is.

Replace `export interface IUseDevicesWizard { … }` with a re-export of the shared type:

```ts
import type { IDeviceWizardAdapter, IWizardControl, IWizardResult, IWizardRow } from '../../../modules/devices';
```

Change the signature:

```ts
export const useDevicesWizard = (): IDeviceWizardAdapter => {
```

Add the mapping computeds after the existing `devices` computed:

```ts
	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: device.ieeeAddress,
			label: device.registeredDeviceName ?? humanize(device.friendlyName),
			subLabel: [device.manufacturer, device.model].filter(Boolean).join(' · ') || null,
			identifier: device.friendlyName,
			status: device.status,
			adoptable: isAdoptableStatus(device.status),
			willUpdate: device.status === 'already_registered',
			suggestedName: device.registeredDeviceName ?? humanize(device.friendlyName),
			suggestedCategory: device.registeredDeviceCategory ?? device.suggestedCategory,
			categoryOptions: categoryOptions(),
			cells: {
				channels: {
					render: 'tag',
					value: t('devicesZigbee2mqttPlugin.wizard.columns.channelsCount', { count: device.previewChannelCount }),
					tooltip: device.previewChannelIdentifiers.join(', '),
				},
			},
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => ({
			key: result.ieeeAddress,
			name: result.name,
			identifier: session.value?.devices.find((device) => device.ieeeAddress === result.ieeeAddress)?.friendlyName ?? result.ieeeAddress,
			status: result.status,
			error: result.error,
		}))
	);

	const controls = computed<IWizardControl[]>(() => {
		if (!bridgeOnline.value) {
			return [
				{
					type: 'banner',
					id: 'bridge-offline',
					severity: 'warning',
					title: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.title'),
					message: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.message'),
					link: {
						label: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.openConfig'),
						to: { name: ConfigRouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } },
					},
				},
			];
		}

		const remaining = permitJoin.value.remainingSeconds;
		// `el-progress` shows "how much is complete", so render elapsed time filling toward the
		// deadline rather than time remaining. 254 s is the typical Zigbee permit-join window.
		const elapsed = Math.max(0, 254 - remaining);
		const percentage = Math.min(100, Math.round((elapsed / 254) * 100));

		return [
			{
				type: 'progress',
				id: 'pairing',
				label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingActive', { remaining }),
				percentage,
				state: percentage >= 75 ? 'warning' : undefined,
				visible: permitJoin.value.active,
			},
			permitJoin.value.active
				? {
						type: 'action',
						id: 'permit-join',
						label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.cancelPairing'),
						icon: 'mdi:close-circle-outline',
						variant: 'warning',
						loading: permitJoinPending.value,
						disabled: permitJoinPending.value,
						handler: disablePermitJoin,
					}
				: {
						type: 'action',
						id: 'permit-join',
						label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.permitJoin'),
						icon: 'mdi:plus-circle-outline',
						variant: 'primary',
						loading: permitJoinPending.value,
						disabled: permitJoinPending.value,
						handler: enablePermitJoin,
					},
		];
	});
```

Add `const permitJoinPending = ref<boolean>(false);` next to the other refs, and set it around the permit-join calls (the flag previously lived in the deleted wizard component).

Rewrite `adoptSelected` as `adopt`, taking the shell's selection instead of reading local maps:

```ts
	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		// … existing bulk POST body, built from `selection` rather than `selectedDevices` …
	};
```

Add the smoothed countdown that the deleted discovery step owned — keep `useNow({ interval: 250 })` and derive `remainingSeconds` from `permitJoin.expiresAt` exactly as `zigbee2mqtt-wizard-discovery-step.vue:213-229` did, so the progress bar still ticks between polls.

Return the adapter:

```ts
	return {
		title: t('devicesZigbee2mqttPlugin.wizard.title'),
		subtitle: t('devicesZigbee2mqttPlugin.wizard.subtitle'),
		breadcrumbLabel: t('devicesZigbee2mqttPlugin.wizard.breadcrumb'),
		pluginType: 'devices-zigbee2mqtt-plugin',
		identifierLabel: t('devicesZigbee2mqttPlugin.wizard.columns.friendlyName'),
		rows,
		results,
		columns: [
			{
				key: 'channels',
				label: t('devicesZigbee2mqttPlugin.wizard.columns.channels'),
				steps: ['confirm'],
				width: 120,
				sortable: true,
			},
		],
		controls,
		ready: sessionReady,
		busy: computed<boolean>(() => formResult.value === FormResult.WORKING),
		capabilities: { addMore: true },
		start: startSession,
		adopt,
		beforeLeaveDiscover: async (): Promise<void> => {
			// Pairing must never stay open once the user moves on.
			if (permitJoin.value.active) {
				await disablePermitJoin();

				flashMessage.info(t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingDisabled'));
			}
		},
		restart: async (): Promise<void> => {
			await endSession().catch(() => undefined);
			await startSession();
		},
		dispose: endSession,
	};
```

Add `channelsCount` to the plugin's six locale files under `wizard.columns` (reuse the existing `steps.categorize.channels` string, which already has the `{count}` placeholder, then delete the old key in Task 13).

- [ ] **Step 4: Delete the wizard components and the local sort util**

```bash
git rm apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-devices-wizard.vue \
      apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-discovery-step.vue \
      apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-categorize-step.vue \
      apps/admin/src/plugins/devices-zigbee2mqtt/components/zigbee2mqtt-wizard-results-step.vue \
      apps/admin/src/plugins/devices-zigbee2mqtt/utils/wizard.sort.ts
```

Remove the corresponding exports from `apps/admin/src/plugins/devices-zigbee2mqtt/components/components.ts` and any `compareLocale` re-export from the plugin's `utils` barrel.

- [ ] **Step 5: Register the adapter**

Modify `apps/admin/src/plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts` — replace the `deviceWizard` entry in the `DEVICES_ZIGBEE2MQTT_TYPE` element and drop the now-unused component import:

```ts
					components: {
						deviceAddForm: Zigbee2mqttDeviceAddFormMultiStep,
						deviceEditForm: Zigbee2mqttDeviceEditForm,
						deviceWizardAdapter: useDevicesWizard,
					},
```

Import it from the plugin's composables barrel.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-zigbee2mqtt`
Expected: PASS.

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 7: Verify in the running app**

Run `pnpm run start:dev`, open Devices → add via wizard → Zigbee2MQTT. Confirm: the bridge-offline banner appears when the bridge is down; pairing toggles and the countdown ticks; Next disables pairing and advances; names and categories prefill; Add devices lands on results; **Add more** returns to a clean discovery step with no bridge-offline flash.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/plugins/devices-zigbee2mqtt
git commit -m "$(cat <<'EOF'
refactor(admin): migrate the Zigbee2MQTT wizard to the shared shell

Replaces four wizard components with an IDeviceWizardAdapter. Exercises
every optional part of the contract: addMore, restart, dispose,
beforeLeaveDiscover, an extra column and a banner with a route link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Migrate the Shelly NG plugin

**Files:**
- Modify: `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.ts`
- Modify: `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.spec.ts`
- Modify: `apps/admin/src/plugins/devices-shelly-ng/devices-shelly-ng.plugin.ts:78`
- Modify: `apps/admin/src/plugins/devices-shelly-ng/components/components.ts`
- Delete: `apps/admin/src/plugins/devices-shelly-ng/components/shelly-ng-devices-wizard.vue`

**Interfaces:**
- Consumes: Task 1 contracts.
- Produces: `useDevicesWizard(): IDeviceWizardAdapter`.

Shelly NG exercises the `form` control (manual add), per-row `categoryOptions`, and the `needs_password → needs_credentials` status rename. It declares `capabilities.addMore: false` and therefore no `restart`.

**Keep unchanged:** `startDiscovery`, `refreshDiscovery`, `addManualDevice`, `updateRegistered`, the per-device adopt loop with its create→update race fallback, `passwordByHostname`, polling and `scanPercentage`. **Remove:** `selected`, `nameByHostname`, `categoryByHostname`, `readyHostnames`, `applySession`'s reconciliation loop, `selectedDevices`, `canContinue`, `manual`, and the mount/unmount hooks.

- [ ] **Step 1: Write the failing adapter tests**

Modify `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.spec.ts`. Keep the existing transport, polling and adopt race tests — they still apply. Delete tests that assert on `selected` / `nameByHostname` / `categoryByHostname` / `canContinue` (that behaviour is now covered by `useDeviceWizardState.spec.ts`). Add:

```ts
	it('maps a discovery device to a wizard row', async () => {
		// … arrange the discovery POST mock exactly as the surrounding tests do …
		const adapter = useDevicesWizard();
		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row.key).toBe('shelly-1.local');
		expect(row.identifier).toBe('shelly-1.local');
		expect(row.adoptable).toBe(true);
		expect(row.willUpdate).toBe(false);
	});

	it('renames the needs_password status to needs_credentials', async () => {
		// … arrange a device with status 'needs_password' …
		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.rows.value[0].status).toBe('needs_credentials');
	});

	it('narrows category options per device', async () => {
		// … arrange a device whose `categories` is [lighting, switcher] …
		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.rows.value[0].categoryOptions.map((option) => option.value)).toEqual([
			DevicesModuleDeviceCategory.lighting,
			DevicesModuleDeviceCategory.switcher,
		]);
	});

	it('offers a manual-add form control', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.controls.value).toContainEqual(
			expect.objectContaining({
				type: 'form',
				id: 'manual',
				fields: [expect.objectContaining({ key: 'hostname' }), expect.objectContaining({ key: 'password', secret: true })],
			})
		);
	});

	it('does not declare the addMore capability', () => {
		const adapter = useDevicesWizard();

		expect(adapter.capabilities.addMore).toBe(false);
		expect(adapter.restart).toBeUndefined();
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-shelly-ng`
Expected: FAIL — `adapter.rows` is undefined.

- [ ] **Step 3: Reshape the composable into an adapter**

Modify `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.ts`.

Add the status mapping helper near `isAdoptableStatus`:

```ts
// The shared contract renames `needs_password` to the provider-neutral `needs_credentials`;
// every other Shelly status maps through unchanged.
const toWizardStatus = (status: IShellyNgDiscoveryDevice['status']): IWizardRowStatus =>
	status === 'needs_password' ? 'needs_credentials' : status;
```

Add the mapping computeds:

```ts
	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: device.hostname,
			label: device.registeredDeviceName ?? device.name ?? device.displayName ?? device.model ?? device.hostname,
			subLabel: device.displayName ?? device.model,
			identifier: device.hostname,
			status: toWizardStatus(device.status),
			adoptable: isAdoptableStatus(device.status),
			willUpdate: device.status === 'already_registered',
			suggestedName: device.registeredDeviceName ?? device.name ?? device.displayName ?? device.hostname,
			suggestedCategory: device.registeredDeviceCategory ?? device.suggestedCategory,
			categoryOptions: categoryOptions(device),
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => ({
			key: result.hostname,
			name: result.name,
			identifier: result.hostname,
			status: result.status,
			error: result.error,
		}))
	);

	const controls = computed<IWizardControl[]>(() => [
		{
			type: 'banner',
			id: 'hint',
			severity: 'info',
			title: t('devicesShellyNgPlugin.texts.wizard.discovery'),
		},
		{
			type: 'progress',
			id: 'scan',
			label: t('devicesShellyNgPlugin.texts.wizard.scanStatus', { count: devices.value.length }),
			percentage: scanPercentage.value,
			state: session.value?.status === 'finished' ? 'success' : undefined,
			visible: true,
		},
		{
			type: 'action',
			id: 'restart-scan',
			label: t('devicesShellyNgPlugin.buttons.wizard.restart.title'),
			icon: 'mdi:radar',
			loading: formResult.value === FormResult.WORKING,
			handler: startDiscovery,
		},
		{
			type: 'form',
			id: 'manual',
			fields: [
				{
					key: 'hostname',
					label: t('devicesShellyNgPlugin.fields.devices.hostname.title'),
					placeholder: t('devicesShellyNgPlugin.fields.devices.hostname.placeholder'),
				},
				{
					key: 'password',
					label: t('devicesShellyNgPlugin.fields.devices.password.title'),
					placeholder: t('devicesShellyNgPlugin.fields.devices.password.placeholder'),
					secret: true,
				},
			],
			submitLabel: t('devicesShellyNgPlugin.buttons.wizard.addManual.title'),
			submitIcon: 'mdi:plus',
			submitDisabled: formResult.value === FormResult.WORKING,
			loading: formResult.value === FormResult.WORKING,
			handler: addManualDevice,
		},
	]);
```

Change `addManualDevice` to take the form values instead of reading a local `manual` reactive:

```ts
	const addManualDevice = async (values: Record<string, string>): Promise<void> => {
		const hostname = (values.hostname ?? '').trim();

		if (hostname.length === 0) {
			return;
		}

		const password = (values.password ?? '').trim() || null;

		// … existing body, using `hostname` / `password` instead of `manual.*` …
	};
```

Rewrite `adoptSelected` as `adopt(selection: IWizardAdoptSelection[])`. Keep the existing snapshot-then-refresh-then-per-device loop verbatim, but source `name` and `category` from the `selection` entry rather than from `nameByHostname` / `categoryByHostname`, and iterate `selection` rather than `selectedDevices.value`:

```ts
	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		formResult.value = FormResult.WORKING;

		// Refresh once so we see any device the main service auto-adopted between scan and
		// adoption; that lets us route those through `edit` instead of getting a duplicate
		// identifier error from `add`.
		if (session.value !== null) {
			try {
				await refreshDiscovery();
			} catch {
				// A stale snapshot is fine — the per-device fallback below still handles late races.
			}
		}

		// … existing loop, keyed on `selection` entries …
	};
```

Return the adapter:

```ts
	return {
		title: t('devicesShellyNgPlugin.headings.wizard.title'),
		subtitle: t('devicesShellyNgPlugin.subHeadings.wizard'),
		breadcrumbLabel: t('devicesShellyNgPlugin.breadcrumbs.wizard'),
		pluginType: 'devices-shelly-ng-plugin',
		identifierLabel: t('devicesShellyNgPlugin.fields.devices.hostname.title'),
		rows,
		results,
		columns: [],
		controls,
		ready: computed<boolean>(() => true),
		busy: computed<boolean>(() => formResult.value === FormResult.WORKING),
		capabilities: { addMore: false },
		start: startDiscovery,
		adopt,
	};
```

- [ ] **Step 4: Delete the wizard component and register the adapter**

```bash
git rm apps/admin/src/plugins/devices-shelly-ng/components/shelly-ng-devices-wizard.vue
```

Remove its export from `apps/admin/src/plugins/devices-shelly-ng/components/components.ts`, then modify `devices-shelly-ng.plugin.ts:78`:

```ts
						deviceWizardAdapter: useDevicesWizard,
```

Replace the `ShellyNgDevicesWizard` import with the composable import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-shelly-ng` — PASS.
Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 6: Verify in the running app**

Devices → add via wizard → Shelly NG. Confirm: the scan progress bar advances; "Restart scan" restarts it; manual add accepts a hostname plus password and clears the inputs on success; the confirm step prefills names and categories and offers only the categories each model supports; adopting lands on results with a "Finish"-equivalent **Done** and no "Add more".

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/plugins/devices-shelly-ng
git commit -m "$(cat <<'EOF'
refactor(admin): migrate the Shelly NG wizard to the shared shell

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Migrate the Shelly v1 plugin

**Files:**
- Modify: `apps/admin/src/plugins/devices-shelly-v1/composables/useDevicesWizard.ts`
- Create: `apps/admin/src/plugins/devices-shelly-v1/composables/useDevicesWizard.spec.ts`
- Modify: `apps/admin/src/plugins/devices-shelly-v1/devices-shelly-v1.plugin.ts:78`
- Modify: `apps/admin/src/plugins/devices-shelly-v1/components/components.ts`
- Delete: `apps/admin/src/plugins/devices-shelly-v1/components/shelly-v1-devices-wizard.vue`

**Interfaces:**
- Consumes: Task 1 contracts.
- Produces: `useDevicesWizard(): IDeviceWizardAdapter`.

This is a near-mechanical repeat of Task 11 against the v1 plugin — same statuses, same manual-add form, same per-device adopt. Substitute `devicesShellyV1Plugin` for `devicesShellyNgPlugin` in i18n keys, `IShellyV1DiscoveryDevice` for `IShellyNgDiscoveryDevice`, `'devices-shelly-v1-plugin'` for the `pluginType`, and `DEVICES_SHELLY_V1_PLUGIN_PREFIX` for the API prefix. **This plugin has no wizard spec today — Task 12 creates its first one.**

- [ ] **Step 1: Write the failing adapter spec**

Create `apps/admin/src/plugins/devices-shelly-v1/composables/useDevicesWizard.spec.ts`. Model the mock scaffolding on `apps/admin/src/plugins/devices-shelly-ng/composables/useDevicesWizard.spec.ts` (same `backendClient`, `vue-i18n` and `../../../common` mocks), then assert:

```ts
	it('maps a discovery device to a wizard row', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();

		const [row] = adapter.rows.value;

		expect(row.key).toBe('shelly-1.local');
		expect(row.identifier).toBe('shelly-1.local');
		expect(row.adoptable).toBe(true);
	});

	it('renames the needs_password status to needs_credentials', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.rows.value[0].status).toBe('needs_credentials');
	});

	it('offers a manual-add form control with a secret password field', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();

		expect(adapter.controls.value).toContainEqual(
			expect.objectContaining({
				type: 'form',
				id: 'manual',
				fields: [expect.objectContaining({ key: 'hostname' }), expect.objectContaining({ key: 'password', secret: true })],
			})
		);
	});

	it('does not declare the addMore capability', () => {
		const adapter = useDevicesWizard();

		expect(adapter.capabilities.addMore).toBe(false);
		expect(adapter.restart).toBeUndefined();
	});

	it('builds the adopt payload from the shell selection', async () => {
		const adapter = useDevicesWizard();
		await adapter.start();

		const results = await adapter.adopt([
			{ key: 'shelly-1.local', name: 'Living room switch', category: DevicesModuleDeviceCategory.lighting },
		]);

		expect(results).toHaveLength(1);
		expect(results[0].key).toBe('shelly-1.local');
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-shelly-v1`
Expected: FAIL — `adapter.rows` is undefined.

- [ ] **Step 3: Reshape the composable into an adapter**

Apply the Task 11 Step 3 transformation verbatim to `apps/admin/src/plugins/devices-shelly-v1/composables/useDevicesWizard.ts`, substituting the v1 identifiers listed above. The two composables are near-identical today, so the resulting adapters should be near-identical too.

- [ ] **Step 4: Delete the wizard component and register the adapter**

```bash
git rm apps/admin/src/plugins/devices-shelly-v1/components/shelly-v1-devices-wizard.vue
```

Remove its export from `apps/admin/src/plugins/devices-shelly-v1/components/components.ts`, then modify `devices-shelly-v1.plugin.ts:78`:

```ts
						deviceWizardAdapter: useDevicesWizard,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter ./apps/admin run test:unit -- devices-shelly-v1` — PASS.
Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 6: Verify in the running app**

Devices → add via wizard → Shelly v1. Confirm the same behaviours as Task 11 Step 6.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/plugins/devices-shelly-v1
git commit -m "$(cat <<'EOF'
refactor(admin): migrate the Shelly v1 wizard to the shared shell

Adds this plugin's first wizard test coverage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Remove the legacy path and dead translations

**Files:**
- Modify: `apps/admin/src/modules/devices/devices.types.ts`
- Modify: `apps/admin/src/modules/devices/composables/useDevicesPlugins.ts:17,78`
- Modify: `apps/admin/src/modules/devices/views/view-devices-wizard.vue`
- Modify: `apps/admin/src/modules/devices/views/view-devices-wizard.spec.ts`
- Modify: 6 locale files each in `devices-shelly-ng/locales/`, `devices-shelly-v1/locales/`, `devices-zigbee2mqtt/locales/`

**Interfaces:**
- Consumes: the completed migrations from Tasks 10–12.
- Produces: nothing new — this task only deletes.

Every plugin now registers `deviceWizardAdapter`, so the fallback is unreachable.

- [ ] **Step 1: Delete the legacy-fallback test**

Modify `apps/admin/src/modules/devices/views/view-devices-wizard.spec.ts` — remove the `'falls back to a legacy deviceWizard component while plugins are still being migrated'` test, the `legacy-plugin` branch of the `getByPluginType` mock, and the now-unused `DevicesWizard` component definition.

- [ ] **Step 2: Run tests to verify they still pass**

Run: `pnpm --filter ./apps/admin run test:unit -- view-devices-wizard`
Expected: PASS, 3 tests.

- [ ] **Step 3: Remove the legacy registration**

In `apps/admin/src/modules/devices/devices.types.ts`, delete the `deviceWizard` member from `IDevicePluginsComponents`.

In `apps/admin/src/modules/devices/composables/useDevicesPlugins.ts`, drop `'deviceWizard'` from the `pluginComponents` array and simplify the `wizardOptions` filter back to a single check:

```ts
			.filter((plugin) =>
				(plugin.elements ?? []).some(
					(el) => (el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME)) && !!el.components?.deviceWizardAdapter
				)
			)
```

In `apps/admin/src/modules/devices/views/view-devices-wizard.vue`, delete the `<component :is="legacyWizard">` branch and the `legacyWizard` computed.

- [ ] **Step 4: Run the suite**

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean. TypeScript will flag any remaining `deviceWizard` reference.

- [ ] **Step 5: Remove dead plugin translations**

In each of the 6 locale files for **devices-shelly-ng** and **devices-shelly-v1**, delete these key groups — they are now served by `devicesModule.wizard.*`:

- `headings.wizard.discovery`, `headings.wizard.categories`, `headings.wizard.results`, `headings.wizard.status`
- `buttons.wizard.adopt`, `buttons.wizard.finish`, `buttons.next`
- `statuses.wizard.*`
- `texts.wizard.categories`, `texts.wizard.results.*`, `texts.wizard.noDevices`
- `fields.devices.name.title`, `fields.devices.category.*`, `fields.devices.error.title`

**Keep:** `headings.wizard.title`, `subHeadings.wizard`, `breadcrumbs.wizard`, `texts.wizard.discovery`, `texts.wizard.scanStatus`, `buttons.wizard.restart.title`, `buttons.wizard.addManual.title`, `fields.devices.hostname.*`, `fields.devices.password.*` — all still referenced by the adapter.

In each of the 6 locale files for **devices-zigbee2mqtt**, delete:

- `wizard.steps.categorize.*` (after moving `channels` to `wizard.columns.channelsCount` in Task 10)
- `wizard.steps.results.*`
- `wizard.actions.*`
- `wizard.status.*`
- `wizard.columns.name`, `wizard.columns.status`, `wizard.columns.category`, `wizard.columns.error`, `wizard.columns.manufacturer`

**Keep:** `wizard.title`, `wizard.subtitle`, `wizard.breadcrumb`, `wizard.bridge.offline.*`, `wizard.steps.discovery.*`, `wizard.columns.friendlyName`, `wizard.columns.channels`, `wizard.columns.channelsCount`.

- [ ] **Step 6: Verify nothing references a removed key**

Run: `grep -rn "statuses.wizard\|texts.wizard.categories\|wizard.actions\.\|wizard.status\." apps/admin/src --include=*.ts --include=*.vue`
Expected: no matches.

Run: `pnpm --filter ./apps/admin run test:unit` — PASS.
Run: `pnpm run lint:js` — clean.

- [ ] **Step 7: Final verification in the running app**

Walk all three wizards end to end with the browser language set to a non-English locale (Czech or German) and confirm no raw translation keys appear on any step.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src
git commit -m "$(cat <<'EOF'
chore(admin): drop the legacy deviceWizard path and dead wizard strings

All three device plugins now register deviceWizardAdapter, so the component
fallback and the per-plugin copies of the shell's strings are unreachable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Open the pull request**

```bash
git push -u origin feat/unified-device-wizard
gh pr create --title "Unified device adoption wizard" --body "$(cat <<'EOF'
Replaces the three independently-written device adoption wizards with one
generic wizard owned by the devices module, driven by a per-plugin adapter.

Design: `docs/superpowers/specs/2026-07-31-unified-device-wizard-design.md`

- Same flow, buttons and wording across Shelly v1, Shelly NG and Zigbee2MQTT
- Discovery is read-only; selection, naming and categorisation happen on one confirm step
- "Add more" is capability-gated — Zigbee2MQTT declares it, Shelly does not
- Deletes 2,397 lines of duplicated plugin wizard UI
- Session reconciliation, previously duplicated three times and tested once, is now shared and tested thoroughly
- `devices-shelly-v1` gains its first wizard test coverage

No backend, OpenAPI or Panel changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:** Registration change → Task 9 (+13). Normalized status with `needs_credentials` rename → Tasks 1, 11, 12. Row/column/cell contracts → Task 1. Built-in columns per step → Tasks 5–7. Four control descriptors → Tasks 1, 5, 10, 11. Adapter contract → Task 1; shell-owned `start`/`dispose` → Task 8. Reconciliation → Task 3. `canContinue`, action bar → Task 4. Status palette → Task 5 (`wizardStatusTagType`). Error handling rules → Task 8. Accepted losses (manufacturer → `subLabel`, auto-pick-all removed) → Tasks 10 and 6. i18n split → Tasks 2 and 13. Locale parity guard → Task 2. Migration order with Z2M first → Tasks 10–12. Testing plan → Tasks 3–8, 10–12.

**Placeholder scan:** Tasks 10–12 contain `# … existing body …` markers inside three functions (`adopt`, `addManualDevice`, the Z2M bulk POST). These are deliberate — the surrounding code is long, correct, and race-sensitive, and the instruction is to preserve it while changing only its inputs. Each is accompanied by the exact signature change required. Everything else is concrete.

**Type consistency:** `useDeviceWizardState` is introduced in Task 3 with no argument and widened in Task 4 to accept an optional rows ref, with a default so Task 3's tests keep compiling. `IWizardRowStatus` is used consistently in Tasks 1, 2, 5, 11, 12. `buildSelection()` returns `IWizardAdoptSelection[]`, which is exactly what `adapter.adopt` accepts in Tasks 8, 10, 11, 12. `wizardStatusTagType` / `wizardResultTagType` are defined in Task 5 Step 3 and consumed in Tasks 5 and 7. `DeviceWizardCell` is created in Task 5 Step 5 and consumed in Tasks 5, 6, 7.
