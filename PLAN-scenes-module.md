# Feature Plan: Scenes Module with Plugin System

## Overview

Implement a **Scenes Module** that manages automation scenes for connected devices. The module follows a universal plugin-based architecture allowing different scene sources (local gateway scenes, Home Assistant scenes, third-party integrations, etc.).

## Architecture Design

### Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                       Scenes Module                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core Services                          │   │
│  │  - Scene CRUD operations                                  │   │
│  │  - Scene execution engine                                 │   │
│  │  - Scene state management                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │ Local Scenes     │ │ Home Assistant   │ │ Third Party      ││
│  │ Plugin           │ │ Scenes Plugin    │ │ Scenes Plugin    ││
│  │                  │ │                  │ │                  ││
│  │ - Gateway-based  │ │ - HA Scenes      │ │ - External APIs  ││
│  │ - Direct device  │ │ - HA Scripts     │ │ - Custom sources ││
│  │   control        │ │ - HA Automations │ │                  ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// Scene Entity
interface IScene {
  id: UUID;
  type: string;              // Plugin type identifier (e.g., 'scenes-local', 'scenes-home-assistant')
  name: string;
  description: string | null;
  icon: string | null;       // Icon identifier for UI
  enabled: boolean;          // Whether scene is active
  isTriggerable: boolean;    // Can be manually triggered
  isEditable: boolean;       // Can be edited (plugin-dependent)
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// Scene Action - What happens when scene is triggered
interface ISceneAction {
  id: UUID;
  scene: UUID;               // Parent scene
  type: string;              // Plugin type for action
  order: number;             // Execution order
  configuration: object;     // Plugin-specific configuration
  // For local scenes: { deviceId, channelId, propertyId, value, delay }
  // For HA scenes: { entityId, serviceData }
  createdAt: Date;
  updatedAt: Date | null;
}

// Scene Condition - Optional conditions for execution
interface ISceneCondition {
  id: UUID;
  scene: UUID;               // Parent scene
  type: string;              // Condition type (device_state, time, etc.)
  operator: 'and' | 'or';    // Logical operator with other conditions
  configuration: object;     // Condition-specific config
  createdAt: Date;
  updatedAt: Date | null;
}

// Scene Trigger - What initiates the scene (for automated scenes)
interface ISceneTrigger {
  id: UUID;
  scene: UUID;               // Parent scene
  type: string;              // Trigger type (manual, schedule, device_state, webhook)
  enabled: boolean;
  configuration: object;     // Trigger-specific config
  createdAt: Date;
  updatedAt: Date | null;
}
```

---

## Backend Implementation

### 1. Module Structure

```
apps/backend/src/modules/scenes/
├── scenes.module.ts                    # NestJS module definition
├── scenes.constants.ts                 # Constants, event types, API tags
├── scenes.exceptions.ts                # Custom exceptions
├── scenes.openapi.ts                   # Swagger metadata & extra models
├── controllers/
│   ├── scenes.controller.ts            # Scene CRUD endpoints
│   ├── scene-actions.controller.ts     # Action management endpoints
│   ├── scene-conditions.controller.ts  # Condition management endpoints
│   └── scene-triggers.controller.ts    # Trigger management endpoints
├── services/
│   ├── scenes.service.ts               # Core scene CRUD operations
│   ├── scene-actions.service.ts        # Action management
│   ├── scene-conditions.service.ts     # Condition management
│   ├── scene-triggers.service.ts       # Trigger management
│   ├── scene-executor.service.ts       # Scene execution engine
│   ├── scenes-type-mapper.service.ts   # Plugin type registry
│   ├── scene-actions-type-mapper.service.ts
│   └── module-reset.service.ts         # Factory reset handler
├── entities/
│   ├── scene.entity.ts                 # Scene TypeORM entity
│   ├── scene-action.entity.ts          # Action entity
│   ├── scene-condition.entity.ts       # Condition entity
│   └── scene-trigger.entity.ts         # Trigger entity
├── dto/
│   ├── create-scene.dto.ts
│   ├── update-scene.dto.ts
│   ├── create-scene-action.dto.ts
│   ├── update-scene-action.dto.ts
│   ├── create-scene-condition.dto.ts
│   ├── update-scene-condition.dto.ts
│   ├── create-scene-trigger.dto.ts
│   ├── update-scene-trigger.dto.ts
│   └── trigger-scene.dto.ts            # Manual trigger request
├── models/
│   └── scenes-response.model.ts        # API response wrappers
├── guards/
│   └── scene-triggerable.guard.ts      # Verify scene can be triggered
├── validators/
│   ├── scene-exists-constraint.validator.ts
│   └── scene-action-exists-constraint.validator.ts
├── subscribers/
│   └── scene-entity.subscriber.ts      # Entity lifecycle events
├── listeners/
│   └── websocket-exchange.listener.ts  # Socket event handling
└── migrations/
    └── XXXXXX-create-scenes-tables.ts  # Database migration
```

### 2. API Endpoints

Following API conventions from `.architecture/backend/BACKEND_API_RULES.md`:

```
# Scene Management
GET    /scenes-module/scenes                    # List all scenes
GET    /scenes-module/scenes/:id                # Get single scene with relations
POST   /scenes-module/scenes                    # Create scene
PATCH  /scenes-module/scenes/:id                # Update scene
DELETE /scenes-module/scenes/:id                # Delete scene
POST   /scenes-module/scenes/:id/trigger        # Manually trigger scene

# Scene Actions
GET    /scenes-module/scenes/:sceneId/actions           # List scene actions
GET    /scenes-module/scenes/:sceneId/actions/:id       # Get single action
POST   /scenes-module/scenes/:sceneId/actions           # Create action
PATCH  /scenes-module/scenes/:sceneId/actions/:id       # Update action
DELETE /scenes-module/scenes/:sceneId/actions/:id       # Delete action

# Scene Conditions
GET    /scenes-module/scenes/:sceneId/conditions        # List conditions
POST   /scenes-module/scenes/:sceneId/conditions        # Create condition
PATCH  /scenes-module/scenes/:sceneId/conditions/:id    # Update condition
DELETE /scenes-module/scenes/:sceneId/conditions/:id    # Delete condition

# Scene Triggers
GET    /scenes-module/scenes/:sceneId/triggers          # List triggers
POST   /scenes-module/scenes/:sceneId/triggers          # Create trigger
PATCH  /scenes-module/scenes/:sceneId/triggers/:id      # Update trigger
DELETE /scenes-module/scenes/:sceneId/triggers/:id      # Delete trigger

# Module Configuration
GET    /scenes-module/config                            # Get module config
PATCH  /scenes-module/config                            # Update module config
```

### 3. Plugin Type Mapper Service

```typescript
// scenes-type-mapper.service.ts
export interface SceneTypeMapping<TScene extends SceneEntity, TCreateDTO, TUpdateDTO> {
  type: string;
  class: new (...args: any[]) => TScene;
  createDto: new (...args: any[]) => TCreateDTO;
  updateDto: new (...args: any[]) => TUpdateDTO;
  afterCreate?: (scene: TScene) => Promise<void>;
  afterUpdate?: (scene: TScene) => Promise<void>;
  beforeDelete?: (scene: TScene) => Promise<void>;
}

@Injectable()
export class ScenesTypeMapperService {
  private readonly mappings = new Map<string, SceneTypeMapping<any, any, any>>();

  registerMapping<TScene, TCreateDTO, TUpdateDTO>(
    mapping: SceneTypeMapping<TScene, TCreateDTO, TUpdateDTO>
  ): void;

  getMapping<TScene, TCreateDTO, TUpdateDTO>(
    type: string
  ): SceneTypeMapping<TScene, TCreateDTO, TUpdateDTO>;

  getAllTypes(): string[];
}
```

### 4. Scene Executor Service

```typescript
// scene-executor.service.ts
export interface IScenePlatform {
  getType(): string;
  execute(scene: SceneEntity, actions: SceneActionEntity[]): Promise<SceneExecutionResult>;
  validateAction(action: SceneActionEntity): Promise<boolean>;
}

@Injectable()
export class SceneExecutorService {
  private readonly platforms = new Map<string, IScenePlatform>();

  registerPlatform(platform: IScenePlatform): void;

  async triggerScene(sceneId: string, triggeredBy?: string): Promise<SceneExecutionResult>;

  private async evaluateConditions(scene: SceneEntity): Promise<boolean>;
  private async executeActions(scene: SceneEntity): Promise<ActionExecutionResult[]>;
}
```

### 5. WebSocket Events

```typescript
// scenes.constants.ts
export const SCENES_MODULE_EVENT_PREFIX = 'ScenesModule';

export enum ScenesEventType {
  SCENE_CREATED = 'ScenesModule.Scene.Created',
  SCENE_UPDATED = 'ScenesModule.Scene.Updated',
  SCENE_DELETED = 'ScenesModule.Scene.Deleted',
  SCENE_TRIGGERED = 'ScenesModule.Scene.Triggered',
  SCENE_EXECUTION_STARTED = 'ScenesModule.Scene.ExecutionStarted',
  SCENE_EXECUTION_COMPLETED = 'ScenesModule.Scene.ExecutionCompleted',
  SCENE_EXECUTION_FAILED = 'ScenesModule.Scene.ExecutionFailed',
  SCENE_ACTION_CREATED = 'ScenesModule.SceneAction.Created',
  SCENE_ACTION_UPDATED = 'ScenesModule.SceneAction.Updated',
  SCENE_ACTION_DELETED = 'ScenesModule.SceneAction.Deleted',
  SCENE_CONDITION_CREATED = 'ScenesModule.SceneCondition.Created',
  SCENE_CONDITION_UPDATED = 'ScenesModule.SceneCondition.Updated',
  SCENE_CONDITION_DELETED = 'ScenesModule.SceneCondition.Deleted',
  SCENE_TRIGGER_CREATED = 'ScenesModule.SceneTrigger.Created',
  SCENE_TRIGGER_UPDATED = 'ScenesModule.SceneTrigger.Updated',
  SCENE_TRIGGER_DELETED = 'ScenesModule.SceneTrigger.Deleted',
}
```

---

## Frontend Implementation (Admin)

### 1. Module Structure

```
apps/admin/src/modules/scenes/
├── index.ts                            # Public exports
├── scenes.module.ts                    # Vue plugin installation
├── scenes.constants.ts                 # Routes, events, form results
├── scenes.exceptions.ts                # Custom exceptions
├── scenes.types.ts                     # Plugin interface definitions
├── locales/
│   └── en-US.json                      # i18n translations
├── router/
│   └── index.ts                        # Route definitions
├── store/
│   ├── scenes.store.ts                 # Main scenes Pinia store
│   ├── scenes.store.types.ts           # Store state types
│   ├── scenes.store.schemas.ts         # Zod validation schemas
│   ├── scenes.transformers.ts          # API response transformers
│   ├── scene-actions.store.ts          # Actions store
│   ├── scene-actions.store.types.ts
│   ├── scene-actions.store.schemas.ts
│   ├── scene-actions.transformers.ts
│   ├── scene-conditions.store.ts       # Conditions store
│   ├── scene-triggers.store.ts         # Triggers store
│   ├── config.store.types.ts           # Config types
│   ├── config.store.schemas.ts         # Config schemas
│   └── keys.ts                         # Store injection keys
├── schemas/
│   ├── scenes.schemas.ts               # Form validation schemas
│   ├── scenes.types.ts
│   ├── scene-actions.schemas.ts
│   └── config.schemas.ts
├── composables/
│   ├── useScenes.ts                    # List all scenes
│   ├── useScene.ts                     # Single scene with relations
│   ├── useScenesDataSource.ts          # Paginated data source
│   ├── useScenesActions.ts             # CRUD operations
│   ├── useSceneAddForm.ts              # Add form logic
│   ├── useSceneEditForm.ts             # Edit form logic
│   ├── useScenesPlugin.ts              # Single plugin resolver
│   ├── useScenesPlugins.ts             # Plugin discovery
│   ├── useSceneIcon.ts                 # Icon helper
│   ├── useSceneActions.ts              # Scene action items
│   ├── useSceneActionAddForm.ts
│   ├── useSceneActionEditForm.ts
│   ├── useSceneConditions.ts
│   ├── useSceneTriggers.ts
│   ├── useSceneTrigger.ts              # Manual trigger functionality
│   └── composables.ts                  # Barrel export
├── components/
│   ├── scenes/
│   │   ├── scenes-table.vue            # Scene list table
│   │   ├── scenes-filter.vue           # Filter controls
│   │   ├── scene-add-form.vue          # Default add form
│   │   ├── scene-edit-form.vue         # Default edit form
│   │   ├── scene-detail.vue            # Scene detail view
│   │   ├── scene-card.vue              # Scene card for grid view
│   │   ├── scene-trigger-button.vue    # Manual trigger button
│   │   ├── list-scenes.vue             # Full list component
│   │   ├── select-scene-plugin.vue     # Plugin type selector
│   │   └── scenes-table-column-*.vue   # Table column components
│   ├── scene-actions/
│   │   ├── scene-actions-table.vue
│   │   ├── scene-action-add-form.vue
│   │   ├── scene-action-edit-form.vue
│   │   └── scene-action-device-selector.vue
│   ├── scene-conditions/
│   │   ├── scene-conditions-list.vue
│   │   ├── scene-condition-add-form.vue
│   │   └── scene-condition-edit-form.vue
│   ├── scene-triggers/
│   │   ├── scene-triggers-list.vue
│   │   ├── scene-trigger-add-form.vue
│   │   └── scene-trigger-edit-form.vue
│   └── components.ts                   # Barrel export
└── views/
    ├── view-scenes.vue                 # Scenes list page
    ├── view-scene.vue                  # Scene detail page
    ├── view-scene-add.vue              # Add scene page
    ├── view-scene-edit.vue             # Edit scene page
    ├── view-scene-actions.vue          # Manage scene actions
    ├── view-scene-add-action.vue
    ├── view-scene-edit-action.vue
    └── (corresponding .types.ts files)
```

### 2. Plugin Interface Definitions

```typescript
// scenes.types.ts
export interface IScenePluginsComponents {
  sceneAddForm?: Component;
  sceneEditForm?: Component;
  sceneDetail?: Component;
  sceneCard?: Component;
}

export interface IScenePluginsSchemas {
  sceneSchema?: ZodSchema;
  sceneCreateReqSchema?: ZodSchema;
  sceneUpdateReqSchema?: ZodSchema;
}

export interface ISceneActionPluginsComponents {
  actionAddForm?: Component;
  actionEditForm?: Component;
  actionPreview?: Component;
}

export interface ISceneActionPluginsSchemas {
  actionSchema?: ZodSchema;
  actionCreateReqSchema?: ZodSchema;
  actionUpdateReqSchema?: ZodSchema;
}
```

### 3. Routes

```typescript
// router/index.ts
export const moduleRoutes: RouteRecordRaw[] = [
  // Scenes list
  {
    path: 'scenes',
    name: SCENES_ROUTES.SCENES,
    component: () => import('../views/view-scenes.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
  // Add scene
  {
    path: 'scenes/add',
    name: SCENES_ROUTES.SCENES_ADD,
    component: () => import('../views/view-scene-add.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
  // Scene detail
  {
    path: 'scene/:id',
    name: SCENES_ROUTES.SCENE,
    component: () => import('../views/view-scene.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
  // Edit scene
  {
    path: 'scene/:id/edit',
    name: SCENES_ROUTES.SCENE_EDIT,
    component: () => import('../views/view-scene-edit.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
  // Scene actions management
  {
    path: 'scene/:id/action/add',
    name: SCENES_ROUTES.SCENE_ADD_ACTION,
    component: () => import('../views/view-scene-add-action.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
  {
    path: 'scene/:id/action/:actionId',
    name: SCENES_ROUTES.SCENE_EDIT_ACTION,
    component: () => import('../views/view-scene-edit-action.vue'),
    meta: { authentication: { required: true, roles: ['admin', 'owner'] } },
  },
];
```

---

## Plugin Implementations

### 1. Local Scenes Plugin (Backend)

```
apps/backend/src/plugins/scenes-local/
├── scenes-local.plugin.ts
├── scenes-local.constants.ts
├── scenes-local.openapi.ts
├── entities/
│   ├── local-scene.entity.ts           # Extended scene entity
│   └── local-scene-action.entity.ts    # Device control action
├── dto/
│   ├── create-local-scene.dto.ts
│   ├── update-local-scene.dto.ts
│   ├── create-local-scene-action.dto.ts
│   └── update-local-scene-action.dto.ts
├── models/
│   └── config.model.ts
├── services/
│   └── local-scene.executor.ts         # Execute via device platform
└── platforms/
    └── local-scene.platform.ts         # IScenePlatform implementation
```

**Local Scene Action Configuration:**
```typescript
interface ILocalSceneActionConfig {
  deviceId: string;
  channelId: string;
  propertyId: string;
  value: string | number | boolean;
  delay?: number;              // Delay before execution (ms)
  transitionTime?: number;     // For dimmable devices
}
```

### 2. Local Scenes Plugin (Admin)

```
apps/admin/src/plugins/scenes-local/
├── scenes-local.plugin.ts
├── scenes-local.constants.ts
├── locales/
│   └── en-US.json
├── components/
│   ├── local-scene-add-form.vue
│   ├── local-scene-edit-form.vue
│   ├── local-action-add-form.vue       # Device/channel/property selector
│   └── local-action-edit-form.vue
└── schemas/
    ├── local-scene.schemas.ts
    └── local-action.schemas.ts
```

### 3. Home Assistant Scenes Plugin (Backend)

```
apps/backend/src/plugins/scenes-home-assistant/
├── scenes-home-assistant.plugin.ts
├── scenes-home-assistant.constants.ts
├── scenes-home-assistant.openapi.ts
├── entities/
│   ├── ha-scene.entity.ts              # Maps to HA scene entity
│   └── ha-scene-action.entity.ts
├── dto/
│   └── *.dto.ts
├── models/
│   └── config.model.ts
├── services/
│   ├── ha-scene-discovery.service.ts   # Discover HA scenes
│   └── ha-scene-sync.service.ts        # Sync scenes from HA
└── platforms/
    └── ha-scene.platform.ts            # Execute via HA API
```

**HA Scene Mapping:**
```typescript
interface IHaSceneConfig {
  haSceneId: string;          // e.g., 'scene.movie_night'
  syncEnabled: boolean;       // Auto-sync from HA
}
```

### 4. Home Assistant Scenes Plugin (Admin)

```
apps/admin/src/plugins/scenes-home-assistant/
├── scenes-home-assistant.plugin.ts
├── scenes-home-assistant.constants.ts
├── locales/
│   └── en-US.json
├── components/
│   ├── ha-scene-add-form.vue           # Select from discovered HA scenes
│   ├── ha-scene-edit-form.vue
│   └── ha-scene-discovery.vue          # Discovery UI
└── schemas/
    └── ha-scene.schemas.ts
```

---

## Implementation Steps

### Phase 1: Core Backend Module
1. Create database migration for scenes tables
2. Implement base entities (Scene, SceneAction, SceneCondition, SceneTrigger)
3. Create DTOs with validation
4. Implement core services (CRUD operations)
5. Create controllers with Swagger documentation
6. Implement ScenesTypeMapperService for plugin registration
7. Create SceneExecutorService with platform registry
8. Add WebSocket event emission
9. Register module in AppModule
10. Write unit and e2e tests

### Phase 2: Core Frontend Module
1. Create store structure with Pinia stores
2. Implement Zod schemas and transformers
3. Create composables for data fetching and form management
4. Build UI components (tables, forms, cards)
5. Create views and configure routing
6. Add i18n translations
7. Implement plugin system interfaces
8. Register module in app.main.ts
9. Connect WebSocket event handlers

### Phase 3: Local Scenes Plugin
1. Backend: Create LocalScenesPlugin with entity extensions
2. Backend: Implement LocalScenePlatform for device control
3. Backend: Add device interaction via DevicesModule
4. Admin: Create plugin with custom forms
5. Admin: Implement device/channel/property selectors
6. Test end-to-end scene creation and execution

### Phase 4: Home Assistant Scenes Plugin
1. Backend: Create HaScenesPlugin
2. Backend: Implement scene discovery from HA API
3. Backend: Create HaScenePlatform for HA service calls
4. Admin: Create discovery UI and forms
5. Test scene sync and execution

### Phase 5: Integration & Polish
1. Add scene execution logging/history
2. Implement scene conditions evaluation
3. Add scheduled triggers support
4. Create dashboard tiles for scenes (separate tile plugin)
5. Panel app integration planning

---

## Database Schema

```sql
-- scenes table
CREATE TABLE scenes (
  id UUID PRIMARY KEY,
  type VARCHAR(100) NOT NULL,           -- Plugin type
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  is_triggerable BOOLEAN DEFAULT true,
  is_editable BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- scene_actions table
CREATE TABLE scene_actions (
  id UUID PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,           -- Action type
  "order" INTEGER NOT NULL DEFAULT 0,
  configuration JSON NOT NULL,          -- Plugin-specific config
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- scene_conditions table
CREATE TABLE scene_conditions (
  id UUID PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  operator VARCHAR(10) DEFAULT 'and',
  configuration JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- scene_triggers table
CREATE TABLE scene_triggers (
  id UUID PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  configuration JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scenes_type ON scenes(type);
CREATE INDEX idx_scenes_enabled ON scenes(enabled);
CREATE INDEX idx_scene_actions_scene_id ON scene_actions(scene_id);
CREATE INDEX idx_scene_actions_order ON scene_actions(scene_id, "order");
CREATE INDEX idx_scene_conditions_scene_id ON scene_conditions(scene_id);
CREATE INDEX idx_scene_triggers_scene_id ON scene_triggers(scene_id);
CREATE INDEX idx_scene_triggers_enabled ON scene_triggers(enabled);
```

---

## Key Considerations

### Plugin Extensibility
- Type mapper services allow plugins to register custom entity types
- Platform registry enables plugin-specific execution logic
- Admin plugin system allows custom UI components and validation schemas
- Configuration models per plugin for plugin-specific settings

### Execution Safety
- Scene execution runs through platform abstraction
- Actions executed in order with optional delays
- Conditions evaluated before execution
- Failed actions don't block subsequent actions (configurable)
- Execution results logged for debugging

### Data Integrity
- Cascading deletes for scene relations
- Validation at DTO level and entity level
- Semaphore pattern in stores prevents race conditions

### Real-time Updates
- WebSocket events for all CRUD operations
- Execution status broadcast for UI feedback
- Token-based refresh triggers for related data

### API Conventions Compliance
- All endpoints follow BACKEND_API_RULES.md
- Response models extend BaseSuccessResponseModel
- DTOs use proper naming conventions
- Swagger decorators in correct order
- operationId follows `{verb}-scenes-module-{resource}` pattern

---

## Files to Create Summary

### Backend (~45 files)
- Module: 6 files (module, constants, exceptions, openapi, migrations)
- Controllers: 4 files
- Services: 7 files
- Entities: 4 files
- DTOs: 10 files
- Models: 2 files
- Guards: 1 file
- Validators: 2 files
- Subscribers: 1 file
- Listeners: 1 file
- Tests: ~8 files

### Frontend Admin (~55 files)
- Module: 5 files (module, constants, exceptions, types, index)
- Stores: 12 files (4 stores × 3 files each)
- Schemas: 4 files
- Composables: 15 files
- Components: ~15 files
- Views: 8 files
- Locales: 1 file
- Router: 1 file

### Local Scenes Plugin (~20 files)
- Backend: ~10 files
- Admin: ~10 files

### HA Scenes Plugin (~20 files)
- Backend: ~10 files
- Admin: ~10 files

**Total: ~140 files**
