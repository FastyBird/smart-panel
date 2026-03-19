# Extension Actions System - Design & Implementation Plan

## Overview

Inspired by Home Assistant's add-on control panels, this feature allows extensions (modules and plugins) to **register custom actions** that users can discover and trigger directly from the admin UI on the extension detail page.

**Example**: The Devices Simulator plugin currently has CLI commands (`simulator:scenario`, `simulator:simulate`, `simulator:generate`, `simulator:connection`). With this feature, those same operations become available as clickable actions in the admin app.

---

## Architecture

### Two Complementary Systems (designed for upgrade path)

```
Actions (Phase 1 - now)              Sessions (Phase 2 - future)
─────────────────────                ──────────────────────────
REST-based, stateless                WebSocket-based, stateful
Flat form → execute → result         Open session → prompts ↔ answers → progress → done
Fire-and-forget                      Long-running, interactive

POST /actions/:id                    WS /sessions/open
  { params: {...} }                    → server sends prompts
  → { success, message, data }        ← client sends answers
                                       → server streams progress
                                       → session completes
```

### Action Modes

Each action declares a **mode**:
- `immediate` (Phase 1) - Flat form with upfront parameters, REST execution, instant result
- `interactive` (Phase 2 - future) - Opens a WebSocket terminal session for multi-step flows

The `interactive` mode will be reusable across the platform:
- System module: app updates, migrations
- Future marketplace: plugin install/uninstall progress
- Any long-running operation with progress reporting

### Dynamic Parameters

Action parameters support **dynamic options** resolved at fetch time (not registration time):
- `resolveOptions()` callback returns current options when the API is called
- Example: scenario list includes both built-in AND user-defined scenarios
- Example: device list for connection state changes reflects current devices

### Data Flow

```
Extension registers actions (onModuleInit)
        │
        ▼
ExtensionActionRegistryService (central registry)
        │
        ▼
ActionsController exposes REST API
   GET  /extensions/:type/actions          → list actions (resolves dynamic options)
   POST /extensions/:type/actions/:id      → execute immediate action
        │
        ▼
Admin UI: "Actions" tab on extension detail page
   → mode=immediate: renders action cards with parameter forms
   → mode=interactive: shows "Open Terminal" button (disabled until Phase 2)
```

---

## Phase 1: Backend - Action Interface & Registry

### 1.1 Action Interface

**File**: `apps/backend/src/modules/extensions/services/extension-action.interface.ts`

```typescript
export type ActionMode = 'immediate' | 'interactive';

export enum ActionParameterType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    SELECT = 'select',
    MULTI_SELECT = 'multi_select',
}

export interface IActionParameterOption {
    label: string;
    value: string | number | boolean;
}

export interface IActionParameter {
    name: string;
    label: string;
    description?: string;
    type: ActionParameterType;
    required?: boolean;
    default?: string | number | boolean;
    /** Static options (for simple cases) */
    options?: IActionParameterOption[];
    /** Dynamic options resolver (called at fetch time) */
    resolveOptions?(): Promise<IActionParameterOption[]>;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
}

export enum ActionCategory {
    GENERAL = 'general',
    SIMULATION = 'simulation',
    DATA = 'data',
    DIAGNOSTICS = 'diagnostics',
    MAINTENANCE = 'maintenance',
}

export interface IActionResult {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
}

export interface IExtensionAction {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    category?: ActionCategory;
    mode: ActionMode;
    dangerous?: boolean;
    parameters?: IActionParameter[];
    /** Handler for immediate mode actions */
    execute?(params: Record<string, unknown>): Promise<IActionResult>;
}
```

### 1.2 Action Registry Service

**File**: `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`

- `register(extensionType, action)` - Register an action
- `unregisterAll(extensionType)` - Remove all actions
- `getActions(extensionType)` - List actions (resolves dynamic options)
- `getAction(extensionType, actionId)` - Get specific action
- `execute(extensionType, actionId, params)` - Execute an immediate action

### 1.3 Actions Controller

**File**: `apps/backend/src/modules/extensions/controllers/actions.controller.ts`

```
GET  /extensions/:type/actions
     → Returns action descriptors with resolved options

POST /extensions/:type/actions/:actionId
     Body: { data: { params: { ... } } }
     → Validates mode=immediate, executes action, returns result
```

### 1.4 Response & DTO Models

- `ExtensionActionModel` - Serializable action descriptor
- `ActionParameterModel` - Parameter descriptor with resolved options
- `ActionResultModel` - Execution result
- `ExtensionActionsResponseModel` / `ActionResultResponseModel` - Wrappers
- `ReqExecuteActionDto` - Request body for action execution

---

## Phase 2: Simulator Plugin - Register Actions

**File**: `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts`

| Action ID | Label | Mode | Category | Parameters |
|---|---|---|---|---|
| `load-scenario` | Load Scenario | immediate | data | `scenario` (dynamic select), `truncate` (bool), `rooms` (bool), `scenes` (bool), `roles` (bool) |
| `generate-device` | Generate Device | immediate | data | `category` (select), `name` (string), `count` (number), `autoSimulate` (bool) |
| `simulate-all` | Simulate All Devices | immediate | simulation | (none) |
| `start-auto-simulation` | Start Auto-Simulation | immediate | simulation | `interval` (number, default 5000) |
| `stop-auto-simulation` | Stop Auto-Simulation | immediate | simulation | (none) |
| `set-all-connection-state` | Set Connection State | immediate | simulation | `state` (select: connected/disconnected/...) |

Key: `scenario` options use `resolveOptions()` to call `ScenarioLoaderService.getAvailableScenarios()` dynamically.

---

## Phase 3: Admin UI - Actions Tab

### Components
- **`extension-actions.vue`** - Actions panel grouped by category
- **`action-parameter-form.vue`** - Dynamic form renderer (string→input, number→input-number, boolean→switch, select→select)

### Extension Detail View
- New "Actions" tab with icon `mdi:lightning-bolt`
- Only visible when extension has registered actions
- `mode=interactive` actions shown as disabled with "Coming soon" badge

---

## Future Phases

### Phase 2: Interactive Sessions (WebSocket)
- Platform-level WebSocket session system
- Terminal-like UI component
- Use cases: system updates, marketplace installs, complex wizards
- Server drives conversation (sends prompts), client responds

### Phase 3: Advanced Features
- Action permissions (role-based)
- Action history/audit log
- Conditional actions (based on extension state)
- Custom Vue panels loaded from extensions
- Action scheduling
- Webhook triggers

---

## Files to Create/Modify

### Backend - New Files
- `apps/backend/src/modules/extensions/services/extension-action.interface.ts`
- `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`
- `apps/backend/src/modules/extensions/controllers/actions.controller.ts`
- `apps/backend/src/modules/extensions/models/action.model.ts`
- `apps/backend/src/modules/extensions/models/actions-response.model.ts`
- `apps/backend/src/modules/extensions/dto/execute-action.dto.ts`
- `apps/backend/src/plugins/simulator/services/simulator-actions.service.ts`

### Backend - Modified Files
- `apps/backend/src/modules/extensions/extensions.module.ts` - Register new service + controller
- `apps/backend/src/modules/extensions/extensions.openapi.ts` - Add new models
- `apps/backend/src/plugins/simulator/simulator.plugin.ts` - Register actions service

### Admin - New Files
- `apps/admin/src/modules/extensions/store/actions.store.ts`
- `apps/admin/src/modules/extensions/components/extension-actions.vue`
- `apps/admin/src/modules/extensions/components/action-parameter-form.vue`
- `apps/admin/src/modules/extensions/composables/useActions.ts`

### Admin - Modified Files
- `apps/admin/src/modules/extensions/views/view-extension-detail.vue` - Add Actions tab
- `apps/admin/src/modules/extensions/components/components.ts` - Export new components
- `apps/admin/src/modules/extensions/composables/composables.ts` - Export new composable
- `apps/admin/src/modules/extensions/store/stores.ts` - Export new store
- `apps/admin/src/modules/extensions/locales/en-US.json` - i18n strings

### SDK - Modified Files
- `packages/extension-sdk/src/types.ts` - Export action interfaces
