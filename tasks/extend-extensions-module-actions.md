# Extension Actions System - Design & Implementation Plan

## Overview

Inspired by Home Assistant's add-on control panels, this feature allows extensions (modules and plugins) to **register custom actions** that users can discover and trigger directly from the admin UI on the extension detail page.

**Example**: The Devices Simulator plugin currently has CLI commands (`simulator:scenario`, `simulator:simulate`, `simulator:generate`, `simulator:connection`). With this feature, those same operations become available as clickable actions in the admin app.

---

## Architecture

### Concept: `IExtensionAction`

Extensions register **action descriptors** with the central `ExtensionActionRegistryService`. Each action defines:
- Metadata (id, label, description, icon, category, confirmation)
- Parameters (typed form fields the admin UI renders dynamically)
- An async handler function that executes the action

### Data Flow

```
Extension registers actions (onModuleInit)
        │
        ▼
ExtensionActionRegistryService (central registry)
        │
        ▼
ActionsController exposes REST API
   GET  /extensions/:type/actions          → list actions
   POST /extensions/:type/actions/:id      → execute action
   GET  /extensions/:type/actions/:id/runs → execution history (optional)
        │
        ▼
Admin UI: "Actions" tab on extension detail page
   → Renders action cards with parameter forms
   → Shows execution results / progress
```

---

## Phase 1: Backend - Action Interface & Registry

### 1.1 Action Interface

**File**: `apps/backend/src/modules/extensions/services/extension-action.interface.ts`

```typescript
/**
 * Parameter types for action inputs
 */
export enum ActionParameterType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    SELECT = 'select',
    MULTI_SELECT = 'multi_select',
}

/**
 * Describes a single parameter for an extension action.
 */
export interface IActionParameter {
    /** Unique parameter key (used in the params object) */
    name: string;
    /** Human-readable label */
    label: string;
    /** Optional description / help text */
    description?: string;
    /** Parameter type determines the form control rendered in UI */
    type: ActionParameterType;
    /** Whether the parameter is required */
    required?: boolean;
    /** Default value */
    default?: string | number | boolean;
    /** For SELECT / MULTI_SELECT: available options */
    options?: { label: string; value: string | number | boolean }[];
    /** Validation constraints */
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
}

/**
 * Categories to group actions visually in the UI.
 */
export enum ActionCategory {
    GENERAL = 'general',
    SIMULATION = 'simulation',
    DATA = 'data',
    DIAGNOSTICS = 'diagnostics',
    MAINTENANCE = 'maintenance',
}

/**
 * Result of executing an action.
 */
export interface IActionResult {
    success: boolean;
    /** Short summary shown as a flash message */
    message?: string;
    /** Optional structured data returned to the UI */
    data?: Record<string, unknown>;
}

/**
 * Describes an action that an extension makes available.
 */
export interface IExtensionAction {
    /** Unique action ID within the extension (e.g., 'load-scenario') */
    id: string;
    /** Human-readable action name */
    label: string;
    /** Longer description of what the action does */
    description?: string;
    /** MDI icon name (e.g., 'mdi:play') */
    icon?: string;
    /** Group actions visually */
    category?: ActionCategory;
    /** If true, UI shows a confirmation dialog before executing */
    dangerous?: boolean;
    /** Action parameters (rendered as a form in the UI) */
    parameters?: IActionParameter[];
    /** The handler function. Receives validated parameters, returns result. */
    execute(params: Record<string, unknown>): Promise<IActionResult>;
}
```

### 1.2 Action Registry Service

**File**: `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`

```typescript
@Injectable()
export class ExtensionActionRegistryService {
    private readonly actions = new Map<string, Map<string, IExtensionAction>>();
    // key: extensionType, value: Map<actionId, action>

    /** Register an action for an extension */
    register(extensionType: string, action: IExtensionAction): void;

    /** Unregister all actions for an extension */
    unregisterAll(extensionType: string): void;

    /** Get all actions for an extension */
    getActions(extensionType: string): IExtensionAction[];

    /** Get a specific action */
    getAction(extensionType: string, actionId: string): IExtensionAction | undefined;

    /** Execute an action */
    async execute(
        extensionType: string,
        actionId: string,
        params: Record<string, unknown>,
    ): Promise<IActionResult>;
}
```

### 1.3 Actions Controller

**File**: `apps/backend/src/modules/extensions/controllers/actions.controller.ts`

```
GET  /modules/extensions/extensions/:type/actions
     → Returns action descriptors (without the execute function)

POST /modules/extensions/extensions/:type/actions/:actionId
     Body: { data: { params: { ... } } }
     → Validates params, executes action, returns result
```

### 1.4 Response Models

**File**: `apps/backend/src/modules/extensions/models/action.model.ts`

- `ExtensionActionModel` - Serializable action descriptor
- `ActionParameterModel` - Parameter descriptor
- `ActionResultModel` - Execution result
- `ExtensionActionsResponseModel` - List wrapper
- `ActionResultResponseModel` - Result wrapper

---

## Phase 2: Simulator Plugin - Register Actions

**File**: `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts`

Register these actions on `onModuleInit`:

| Action ID | Label | Category | Parameters | Maps to |
|---|---|---|---|---|
| `load-scenario` | Load Scenario | data | `scenario` (select from available), `truncate` (bool), `rooms` (bool), `scenes` (bool) | `ScenarioExecutorService` |
| `generate-device` | Generate Device | data | `category` (select), `name` (string), `count` (number), `autoSimulate` (bool) | `DeviceGeneratorService` |
| `simulate-all` | Simulate All Devices | simulation | (none) | `SimulationService.simulateAllDevices()` |
| `start-auto-simulation` | Start Auto-Simulation | simulation | `interval` (number, default 5000) | `SimulationService.startAutoSimulation()` |
| `stop-auto-simulation` | Stop Auto-Simulation | simulation | (none) | `SimulationService.stopAutoSimulation()` |
| `set-all-connection-state` | Set Connection State | simulation | `state` (select: connected/disconnected/lost/...) | Iterate devices + `DeviceConnectivityService` |

The `scenario` select options are populated dynamically from `ScenarioLoaderService.listScenarios()`.

---

## Phase 3: Admin UI - Actions Tab

### 3.1 Store

**File**: `apps/admin/src/modules/extensions/store/actions.store.ts`

```typescript
// State: { [extensionType]: IExtensionAction[] }
// Actions:
//   fetch(extensionType)    → GET /modules/extensions/extensions/:type/actions
//   execute(extensionType, actionId, params) → POST .../:actionId
```

### 3.2 Components

**`extension-actions.vue`** - Actions panel for the extension detail page
- Groups actions by category
- Each action rendered as a card with:
  - Icon, label, description
  - Parameter form (dynamically rendered based on parameter types)
  - "Run" button (with confirmation dialog if `dangerous`)
  - Result display (success/error message)

**`action-parameter-form.vue`** - Dynamic form renderer
- `string` → `el-input`
- `number` → `el-input-number`
- `boolean` → `el-switch`
- `select` → `el-select`
- `multi_select` → `el-select` with `multiple`
- Validation based on parameter constraints

### 3.3 Extension Detail View Changes

Add an **"Actions" tab** (between Documentation and Logs) on `view-extension-detail.vue`:
- Only shown when the extension has registered actions
- Tab icon: `mdi:lightning-bolt`
- Content: `<extension-actions :extension-type="extension.type" />`

### 3.4 Composable

**`useExtensionActions.ts`** (extend existing or create `useActions.ts`)
- `actions` - computed list of actions for current extension
- `executeAction(actionId, params)` - calls API, shows flash message
- `isExecuting(actionId)` - loading state per action

---

## Phase 4: Extension SDK Update

Add the action interface to `packages/extension-sdk/src/types.ts` so external extensions can also register actions:

```typescript
export type { IExtensionAction, IActionParameter, IActionResult } from './action.types';
```

---

## Phase 5 (Future): Advanced Features

These are not part of the initial implementation but worth considering:

1. **Long-running actions with progress** - WebSocket-based progress reporting for actions that take time (e.g., loading a large scenario)
2. **Action permissions** - Role-based access control for dangerous actions
3. **Action history/audit log** - Track who executed what and when
4. **Conditional actions** - Actions that are only available based on extension state (e.g., "Stop Simulation" only when running)
5. **Custom UI panels** - Extensions provide their own Vue components (like HA add-on panels), loaded dynamically from the discovered admin extension entry
6. **Action scheduling** - Schedule actions to run at specific times or intervals
7. **Webhook triggers** - Allow actions to be triggered via external webhooks

---

## Implementation Order

1. **Backend interfaces** (`IExtensionAction`, `IActionParameter`, `IActionResult`)
2. **Registry service** (`ExtensionActionRegistryService`)
3. **REST controller** + response models
4. **Simulator plugin** registers its actions
5. **Admin store** for fetching/executing actions
6. **Admin components** (action cards, parameter forms)
7. **Extension detail view** - add Actions tab
8. **Extension SDK** - export action types
9. **OpenAPI regeneration**
10. **Tests**

---

## Files to Create/Modify

### Backend - New Files
- `apps/backend/src/modules/extensions/services/extension-action.interface.ts`
- `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`
- `apps/backend/src/modules/extensions/controllers/actions.controller.ts`
- `apps/backend/src/modules/extensions/models/action.model.ts`
- `apps/backend/src/modules/extensions/dto/execute-action.dto.ts`
- `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts`

### Backend - Modified Files
- `apps/backend/src/modules/extensions/extensions.module.ts` - Register new service + controller
- `apps/backend/src/plugins/simulator/simulator.plugin.ts` - Register actions service

### Admin - New Files
- `apps/admin/src/modules/extensions/store/actions.store.ts`
- `apps/admin/src/modules/extensions/components/extension-actions.vue`
- `apps/admin/src/modules/extensions/components/action-parameter-form.vue`
- `apps/admin/src/modules/extensions/composables/useActions.ts`

### Admin - Modified Files
- `apps/admin/src/modules/extensions/views/view-extension-detail.vue` - Add Actions tab
- `apps/admin/src/modules/extensions/extensions.constants.ts` - Action-related types
- `apps/admin/src/modules/extensions/locales/` - i18n strings

### SDK - Modified Files
- `packages/extension-sdk/src/types.ts` - Export action interfaces

---

## HA Inspiration Notes

Home Assistant add-ons offer:
- **Info panel** - Description, version, changelog → We have this (README + docs tabs)
- **Configuration panel** - YAML/form-based config → We have this (config module link)
- **Log panel** - Live logs → We have this (Logs tab)
- **Control buttons** - Start/Stop/Restart/Rebuild → We have service controls
- **Ingress panel** - Embedded web UI from the add-on → Future: custom UI panels (Phase 5)

What we're adding is closest to HA's **"automation actions"** or **"developer tools > services"** concept - extensions expose callable services that users can invoke with parameters from the UI. This bridges the gap between CLI-only features and user-accessible functionality.
