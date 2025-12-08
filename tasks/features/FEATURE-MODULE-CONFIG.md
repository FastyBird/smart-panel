# Task: Module Configuration Support
ID: FEATURE-MODULE-CONFIG
Type: feature
Scope: backend, admin
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to provide a consistent way to configure both core modules and extensible plugins,  
as a system administrator using the Smart Panel,  
I want each module to have its own configuration schema that can be viewed and edited in the same way as plugins.

## 2. Context

- Plugins already support custom configuration schemas through the backend `PluginsTypeMapperService` and the admin `PluginsManager`.
- Modules (`devices`, `dashboard`, `system`, `users`, `config`, `weather`, `stats`, `auth`) are core parts of the system but previously had no unified configuration mechanism.
- This task extends the existing plugin pattern to modules on both backend (NestJS) and admin (Vue + Pinia) while keeping API and OpenAPI conventions.
- Detailed implementation notes and file-level breakdowns are kept **below this template block** as an appendix.

## 3. Scope

**In scope**

- Backend support for module configuration:
  - YAML persistence under a new `modules` section.
  - Type mapping and validation for module configs.
  - REST API endpoints for listing, reading, and updating module configs.
- Admin app support:
  - A `ModulesManager` for registering modules with UI metadata and optional schemas/components.
  - Config module store, composables, components, and views for module configuration.
  - OpenAPI / TypeScript types for new config-module endpoints.

**Out of scope**

- Adding real-world configuration fields for specific modules (beyond the base structure).
- Non-config UI changes unrelated to module configuration.
- Mobile / panel-specific UI; this task focuses on the admin web app.

## 4. Acceptance criteria

- [x] Backend exposes:
  - [x] `GET /config/modules` to list all module configs.
  - [x] `GET /config/module/:module` to get a single module config.
  - [x] `PATCH /config/module/:module` to update a module config with validation.
  - [x] Module configs are stored and loaded from `config.yaml` under `modules`.
- [x] Backend provides a `ModulesTypeMapperService` that:
  - [x] Allows modules to register their config model + DTO pairs.
  - [x] Throws well-defined exceptions for unknown module types.
  - [x] Is covered by unit tests.
- [x] Admin app:
  - [x] Has a `ModulesManager` and all core modules are registered in it.
  - [x] Has a Pinia store to fetch, cache, and update module configs (including WebSocket updates).
  - [x] Renders a “Modules” config screen listing all registered modules with an “enabled” flag and edit forms.
  - [x] Uses OpenAPI-generated types for module config operations.
- [x] Documentation in this file explains how to register a new module configuration (backend + admin).
- [ ] Admin unit tests for stores/composables/components are planned and tracked as a follow‑up task.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Admin edits a module’s configuration

Given a running system with modules registered in `ModulesManager`  
And the backend `config.yaml` contains a `modules` section with at least one module config  
When the admin opens the “Configuration → Modules” screen in the admin app  
And edits a module’s configuration and saves the form  
Then the admin app sends a `PATCH /config/module/:module` request with a validated body  
And the backend updates the YAML file and emits a `ConfigModule.Configuration.Changed` event  
And the updated configuration is reflected in the UI without a full page reload.

### Scenario: Unknown module type

Given the backend is running  
When a client calls `GET /config/module/unknown-module`  
Then the backend responds with a well-defined configuration error (mapped to an HTTP error)  
And the admin app displays a user-friendly error message in the UI.

## 6. Technical constraints

- Follow the existing structure and conventions of:
  - Backend `config` module (reusing patterns from plugin configuration).
  - Admin `config` module (reusing patterns from plugin configuration views/stores).
- Do not introduce new third-party dependencies unless strictly necessary.
- Do not modify generated OpenAPI files directly; always regenerate them via `pnpm generate:openapi`.
- New logic must be covered by unit tests on the backend; admin tests are planned but not yet implemented.
- Keep module configuration compatible with existing `config.yaml` files (graceful handling when `modules` is missing).

## 7. Implementation hints (optional)

- Treat modules as “first-class citizens” similar to plugins:
  - Backend: mirror `PluginsTypeMapperService` to create `ModulesTypeMapperService`.
  - Admin: mirror `PluginsManager` to create `ModulesManager`.
- Start by wiring the backend (models, DTOs, mapper, service, controller, OpenAPI) and only then update the admin app.
- For the admin store/composables:
  - Reuse the patterns from `config-plugins.store.ts`, `usePlugins.ts`, and related composables.
  - Use Zod schemas as the single source of truth for module config validation on the client.
- When adding new modules in the future:
  - Backend: register the module config schema in `ModulesTypeMapperService` in the module’s NestJS module.
  - Admin: register the module with `ModulesManager` and optionally provide custom schemas/components.

## 8. AI instructions (for Junie / AI)

- Read this file entirely (including the detailed design sections below) before making any code changes.
- Start by replying with a short implementation plan (max 10 steps) that maps directly to the acceptance criteria.
- Keep changes scoped to:
  - Backend `config` module and any module that needs configuration.
  - Admin `config` module and common services used for module/plugin registration.
- For each acceptance criterion in section 4, either:
  - Implement it fully, or
  - Explain in this file why it is not implemented and, if relevant, create a follow‑up task.
- Do not edit generated OpenAPI artifacts manually; always use `pnpm generate:openapi`.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

## 9. Detailed design & implementation

This section captures the detailed design, implementation plan, and notes for the module configuration feature.

### Status: ✅ COMPLETED

**Implementation completed on**: 2025-12-02

### Overview

Add support for modules to register their own configuration schemas, similar to how plugins currently work. This will allow modules (like `devices`, `dashboard`, `system`, etc.) to define custom configuration that can be stored, retrieved, and updated through the config module.

**Current Status**: Both backend and admin app implementations are complete. Modules can now register their configuration schemas and manage them through the admin UI, following the same pattern as plugins.

### Current State

#### Plugin Configuration System

Plugins can register their configuration schemas using:
- `PluginsTypeMapperService.registerMapping()` - registers plugin type, model class, and DTO class
- Configuration is stored in YAML under `plugins` key
- API endpoints: `GET /config/plugins`, `GET /config/plugin/:plugin`, `PATCH /config/plugin/:plugin`
- `ConfigService` provides: `getPluginsConfig()`, `getPluginConfig()`, `setPluginConfig()`

Example from `devices-shelly-ng` plugin:
```typescript
onModuleInit() {
  this.configMapper.registerMapping<ShellyNgConfigModel, ShellyNgUpdatePluginConfigDto>({
    type: DEVICES_SHELLY_NG_PLUGIN_NAME,
    class: ShellyNgConfigModel,
    configDto: ShellyNgUpdatePluginConfigDto,
  });
}
```

#### Modules

Modules are core functionality components (e.g., `devices`, `dashboard`, `system`, `users`, etc.) that are NestJS modules. Currently, they don't have a mechanism to register custom configuration schemas.

### Requirements

1. Modules should be able to register their configuration schema (model class and DTO class)
2. Module configurations should be stored in YAML under a `modules` key (similar to `plugins`)
3. Modules should be able to retrieve their configuration
4. API endpoints should be provided for module configuration management
5. The system should work the same way as plugin configuration

### Implementation Status

✅ **Phase 1: Core Infrastructure** - COMPLETED
✅ **Phase 2: API Endpoints** - COMPLETED
✅ **Phase 3: Example Implementation** - COMPLETED (Example removed per user request)
✅ **Phase 4: Testing & Documentation** - COMPLETED (Backend unit tests)
✅ **Phase 5: Admin App Implementation** - COMPLETED

### Implementation Plan

#### Phase 1: Core Infrastructure ✅ COMPLETED

#### 1.1 Create Module Configuration Base Classes

**File**: `apps/backend/src/modules/config/models/config.model.ts`

- Add `ModuleConfigModel` abstract base class (similar to `PluginConfigModel`)
  ```typescript
  @ApiSchema({ name: 'ConfigModuleDataModule' })
  export abstract class ModuleConfigModel {
    @ApiProperty({
      description: 'Module identifier',
      type: 'string',
      example: 'devices-module',
    })
    @Expose()
    @IsString()
    type: string;
  }
  ```

- Update `AppConfigModel` to include modules array:
  ```typescript
  @Expose()
  @ValidateNested({ each: true })
  modules: ModuleConfigModel[] = [];
  ```

#### 1.2 Create Modules Type Mapper Service

**File**: `apps/backend/src/modules/config/services/modules-type-mapper.service.ts`

- Create `ModulesTypeMapperService` (mirror of `PluginsTypeMapperService`)
- Interface: `ModuleTypeMapping<TModule extends ModuleConfigModel, TConfigDTO extends UpdateModuleConfigDto>`
- Methods:
  - `registerMapping()` - register module config schema
  - `getMapping()` - retrieve mapping by module type
  - `getMappings()` - get all registered mappings
  - `onMappingsRegistered()` - callback for when mappings are ready

#### 1.3 Create Module Configuration DTOs

**File**: `apps/backend/src/modules/config/dto/config.dto.ts`

- Add `UpdateModuleConfigDto` base class (similar to `UpdatePluginConfigDto`)
  ```typescript
  @ApiSchema({ name: 'ConfigModuleUpdateModule' })
  export class UpdateModuleConfigDto {
    @ApiProperty({
      description: 'Module identifier',
      type: 'string',
      example: 'devices-module',
    })
    @Expose()
    @IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
    type: string;
  }
  ```

- Add `ReqUpdateModuleDto` wrapper:
  ```typescript
  @ApiSchema({ name: 'ConfigModuleReqUpdateModule' })
  export class ReqUpdateModuleDto {
    @ApiProperty({
      description: 'Module configuration data',
      type: () => UpdateModuleConfigDto,
    })
    @Expose()
    @ValidateNested()
    @Type(() => UpdateModuleConfigDto)
    data: UpdateModuleConfigDto;
  }
  ```

#### 1.4 Update Config Service

**File**: `apps/backend/src/modules/config/services/config.service.ts`

- Add `loadModules()` method (similar to `loadPlugins()`)
- Add `getModulesConfig<TConfig extends ModuleConfigModel>(): TConfig[]`
- Add `getModuleConfig<TConfig extends ModuleConfigModel>(module: string): TConfig`
- Add `setModuleConfig<TUpdateDto extends UpdateModuleConfigDto>(module: string, value: TUpdateDto): void`
- Update `loadConfig()` to call `loadModules()`
- Update `saveConfig()` to handle modules in YAML serialization (similar to plugins transformation)
- Update `setConfigSection()` to handle modules when saving (similar to plugins handling)
- Inject `ModulesTypeMapperService` in constructor
- Register callback for mappings ready (similar to plugins)

#### 1.5 Update Config Module

**File**: `apps/backend/src/modules/config/config.module.ts`

- Add `ModulesTypeMapperService` to providers
- Export `ModulesTypeMapperService`

### Phase 2: API Endpoints ✅ COMPLETED

#### 2.1 Update Config Controller

**File**: `apps/backend/src/modules/config/controllers/config.controller.ts`

- Add `GET /config/modules` endpoint - get all module configurations
- Add `GET /config/module/:module` endpoint - get specific module configuration
- Add `PATCH /config/module/:module` endpoint - update module configuration
- Follow the same pattern as plugin endpoints
- Use `ModulesTypeMapperService` instead of `PluginsTypeMapperService`
- Handle `ConfigException` for unsupported module types (similar to plugin error handling)

#### 2.2 Update Response Models

**File**: `apps/backend/src/modules/config/models/config-response.model.ts`

- Add `ConfigModuleResModules` response model (similar to `ConfigModuleResPlugins`)
  ```typescript
  @ApiSchema({ name: 'ConfigModuleResModules' })
  export class ConfigModuleResModules extends BaseSuccessResponseModel<ModuleConfigModel[]> {
    @ApiProperty({
      description: 'List of module configurations',
      type: 'array',
      items: { $ref: getSchemaPath(ModuleConfigModel) },
    })
    @Expose()
    declare data: ModuleConfigModel[];
  }
  ```

- Add `ConfigModuleResModuleConfig` response model (similar to `ConfigModuleResPluginConfig`)
  ```typescript
  @ApiSchema({ name: 'ConfigModuleResModuleConfig' })
  export class ConfigModuleResModuleConfig extends BaseSuccessResponseModel<ModuleConfigModel> {
    @ApiProperty({
      description: 'Module configuration',
      type: () => ModuleConfigModel,
    })
    @Expose()
    declare data: ModuleConfigModel;
  }
  ```

#### 2.3 Update OpenAPI Schemas

**File**: `apps/backend/src/modules/config/config.openapi.ts`

- Add module DTOs and response models to `CONFIG_SWAGGER_EXTRA_MODELS` array:
  - `UpdateModuleConfigDto`
  - `ReqUpdateModuleDto`
  - `ConfigModuleResModules`
  - `ConfigModuleResModuleConfig`
  - `ModuleConfigModel`

### Phase 3: Example Implementation ✅ COMPLETED (Example removed per user request)

#### 3.1 Example: Devices Module Configuration

To demonstrate the feature, add a simple configuration to the `devices` module:

**File**: `apps/backend/src/modules/devices/models/config.model.ts` (new)
- Create `DevicesConfigModel extends ModuleConfigModel`
- Example fields: `autoDiscoveryEnabled: boolean`, `syncInterval: number`

**File**: `apps/backend/src/modules/devices/dto/config.dto.ts` (new)
- Create `UpdateDevicesConfigDto extends UpdateModuleConfigDto`

**File**: `apps/backend/src/modules/devices/devices.module.ts`
- Inject `ModulesTypeMapperService`
- Register mapping in `onModuleInit()`:
  ```typescript
  this.modulesMapper.registerMapping<DevicesConfigModel, UpdateDevicesConfigDto>({
    type: DEVICES_MODULE_NAME,
    class: DevicesConfigModel,
    configDto: UpdateDevicesConfigDto,
  });
  ```

### Phase 4: Testing & Documentation ✅ COMPLETED (Backend unit tests)

#### 4.1 Unit Tests
- Test `ModulesTypeMapperService`
- Test `ConfigService` module methods
- Test controller endpoints

#### 4.2 Integration Tests
- Test module registration flow
- Test YAML persistence
- Test API endpoints

#### 4.3 Documentation
- Update API documentation
- Add example usage in module documentation
- Document the pattern for other modules

### File Structure

#### Backend

```
apps/backend/src/modules/config/
├── models/
│   └── config.model.ts                    # Add ModuleConfigModel, update AppConfigModel
├── dto/
│   └── config.dto.ts                      # Add UpdateModuleConfigDto, ReqUpdateModuleDto
├── services/
│   ├── config.service.ts                  # Add module methods
│   └── modules-type-mapper.service.ts     # NEW: Module mapper service
├── controllers/
│   └── config.controller.ts               # Add module endpoints
├── models/
│   └── config-response.model.ts           # Add module response models
└── config.module.ts                        # Export ModulesTypeMapperService
```

#### Admin App

```
apps/admin/src/modules/config/
├── config.constants.ts                     # Add CONFIG_MODULE_MODULE_TYPE, route names
├── config.types.ts                         # Add IModulesComponents, IModulesSchemas
├── store/
│   ├── config-modules.store.ts             # NEW: Module config store
│   ├── config-modules.store.schemas.ts     # NEW: Module store schemas
│   ├── config-modules.store.types.ts       # NEW: Module store types
│   ├── config-modules.store.transformers.ts # NEW: Module transformers
│   └── keys.ts                             # Add configModulesStoreKey
├── composables/
│   ├── useModules.ts                       # NEW: Get all modules
│   ├── useModule.ts                        # NEW: Get single module
│   ├── useConfigModule.ts                  # NEW: Get module config
│   ├── useConfigModules.ts                 # NEW: Get all module configs
│   └── useConfigModuleEditForm.ts          # NEW: Module config form logic
├── components/
│   ├── config-module.vue                   # NEW: Module config component
│   └── config-module.types.ts              # NEW: Component types
├── views/
│   ├── view-config-modules.vue             # NEW: Modules config view
│   └── view-config-modules.types.ts        # NEW: View types
├── router/
│   └── index.ts                            # Add modules route
├── layouts/
│   └── layout-config.vue                   # Add modules navigation
└── config.module.ts                         # Register modules store, WebSocket handler

apps/admin/src/common/
└── services/
    └── modules-manager.service.ts           # NEW: Module registration service
```

### API Endpoints

#### Get All Module Configurations
```
GET /config/modules
Response: ConfigModuleResModules
```

#### Get Module Configuration
```
GET /config/module/:module
Response: ConfigModuleResModuleConfig
```

#### Update Module Configuration
```
PATCH /config/module/:module
Body: ReqUpdateModuleDto
Response: ConfigModuleResModuleConfig
```

### YAML Structure

```yaml
# Current structure
audio:
  speaker: false
  speaker_volume: 0
  # ...
plugins:
  devices-shelly-ng:
    enabled: true
    # plugin-specific config

# New structure (after implementation)
modules:
  devices-module:
    auto_discovery_enabled: true
    sync_interval: 5000
  dashboard-module:
    # dashboard-specific config
```

### Migration Considerations

1. **Backward Compatibility**: Existing config files without `modules` key should work (default to empty array)
2. **Default Values**: Modules should provide sensible defaults if config is missing
3. **Validation**: Module configs should be validated on load (same as plugins)

### Testing Checklist

#### Backend
- [x] Module can register its configuration schema
- [x] Module configuration is persisted to YAML
- [x] Module configuration is loaded on startup
- [x] Module can retrieve its own configuration
- [x] API endpoints work correctly
- [x] Validation works for module configs
- [x] Missing module config defaults are applied
- [x] Invalid module config is handled gracefully
- [x] Multiple modules can register configs independently
- [x] Unit tests for all new code

#### Admin App
- [x] Module can register with ModulesManager
- [x] Module store can fetch module configs from API
- [x] Module store handles WebSocket events
- [x] Module custom schemas are used when available
- [x] Module custom forms are rendered correctly
- [x] Module config form validation works
- [x] Module config updates are sent to API
- [x] Modules view displays all registered modules
- [x] Module config is loaded on page navigation
- [x] Error handling for missing modules
- [ ] Unit tests for stores, composables, components (TODO: Add unit tests)

### Phase 5: Admin App Implementation ✅ COMPLETED

#### 5.1 Module Registration System ✅ COMPLETED

Modules need to register their configuration schemas similar to how plugins do. However, modules are core components, not plugins, so we need a different registration mechanism.

**Option A: Module Manager Service (Recommended)**
- Create a `ModulesManager` service similar to `PluginsManager`
- Modules register themselves during app initialization
- Store module metadata (name, type, schemas, components)

**Option B: Direct Module Registration**
- Modules directly register with the config module
- Simpler but less flexible

**Decision**: Use Option A for consistency with plugin system.

#### 5.1.1 Create Module Constants ✅ COMPLETED

**File**: `apps/admin/src/modules/config/config.constants.ts`

- Add `CONFIG_MODULE_MODULE_TYPE = 'module'` (similar to `CONFIG_MODULE_PLUGIN_TYPE`)
- Add route name: `CONFIG_MODULES: 'config_module-config_modules'`

#### 5.1.2 Create Module Types ✅ COMPLETED

**File**: `apps/admin/src/modules/config/config.types.ts`

- Add `IModulesComponents` type (similar to `IPluginsComponents`):
  ```typescript
  export type IModulesComponents = {
    moduleConfigEditForm?: DefineComponent<
      IModuleConfigEditFormProps,
      {},
      {},
      {},
      {},
      ComponentOptionsMixin,
      ComponentOptionsMixin,
      typeof moduleConfigEditFormEmits
    >;
  };
  ```

- Add `IModulesSchemas` type (similar to `IPluginsSchemas`):
  ```typescript
  export type IModulesSchemas = {
    moduleConfigSchema?: typeof ConfigModuleSchema;
    moduleConfigEditFormSchema?: typeof ConfigModuleEditFormSchema;
    moduleConfigUpdateReqSchema?: typeof ConfigModuleUpdateReqSchema;
  };
  ```

#### 5.1.3 Create Module Store ✅ COMPLETED

**File**: `apps/admin/src/modules/config/store/config-modules.store.ts`

- Create `useConfigModule` store (mirror of `useConfigPlugin`)
- Methods:
  - `findAll()` - get all module configs
  - `findByType()` - get module config by type
  - `get()` - fetch single module config from API
  - `fetch()` - fetch all module configs from API
  - `edit()` - update module config via API
  - `set()` - set module config in store
  - `onEvent()` - handle WebSocket events
- Use `getElement()` from `useModules()` to get module's custom schema
- Fallback to `ConfigModuleSchema` if no custom schema provided

**File**: `apps/admin/src/modules/config/store/config-modules.store.schemas.ts`

- Create Zod schemas:
  - `ConfigModuleSchema` - base module config schema
  - `ConfigModuleUpdateReqSchema` - update request schema
  - `ConfigModuleResSchema` - API response schema
  - Action payload schemas

**File**: `apps/admin/src/modules/config/store/config-modules.store.types.ts`

- Type definitions for store state, actions, and payloads

**File**: `apps/admin/src/modules/config/store/config-modules.transformers.ts`

- Transform functions:
  - `transformConfigModuleResponse()` - transform API response using module's schema
  - `transformConfigModuleUpdateRequest()` - transform update request using module's schema

#### 5.1.4 Create Module Composables ✅ COMPLETED

**File**: `apps/admin/src/modules/config/composables/useModules.ts`

- Similar to `usePlugins.ts`:
  ```typescript
  export const useModules = (): IUseModules => {
    const modulesManager = injectModulesManager();
    
    const modules = computed<IModule[]>(() => {
      return modulesManager.getModules().filter(
        (module) => module.modules?.includes(CONFIG_MODULE_NAME)
      );
    });
    
    const getByName = (type: IModule['type']): IModule | undefined => {
      return modules.value.find((module) => module.type === type);
    };
    
    const getElement = (type: IModule['type']): IModuleElement | undefined => {
      return modules.value
        .find((module) => module.type === type)
        ?.elements?.find((element) => element.type === CONFIG_MODULE_MODULE_TYPE);
    };
    
    return { modules, getByName, getElement };
  };
  ```

**File**: `apps/admin/src/modules/config/composables/useModule.ts`

- Similar to `usePlugin.ts`:
  ```typescript
  export const useModule = ({ name }: IUseModuleProps): IUseModule => {
    const { getByName } = useModules();
    const plugin = computed(() => getByName(name));
    const element = computed(() => 
      plugin.value?.elements?.find(
        (element) => element.type === CONFIG_MODULE_MODULE_TYPE
      )
    );
    return { module: plugin, element };
  };
  ```

**File**: `apps/admin/src/modules/config/composables/useConfigModule.ts`

- Similar to `useConfigPlugin.ts`:
  ```typescript
  export const useConfigModule = ({ type }: IUseConfigModuleProps): IUseConfigModule => {
    const configModuleStore = storesManager.getStore(configModulesStoreKey);
    const configModule = computed(() => configModuleStore.findByType(type));
    const fetchConfigModule = async () => {
      await configModuleStore.get({ type });
    };
    return { configModule, isLoading, fetchConfigModule };
  };
  ```

**File**: `apps/admin/src/modules/config/composables/useConfigModules.ts`

- Similar to `useConfigPlugins.ts`:
  - Get all module configs from store
  - Provide loading states

**File**: `apps/admin/src/modules/config/composables/useConfigModuleEditForm.ts`

- Similar to `useConfigPluginEditForm.ts`:
  - Handle form submission
  - Validation using module's schema
  - API calls via store

#### 5.1.5 Create Module Components ✅ COMPLETED

**File**: `apps/admin/src/modules/config/components/config-module.vue`

- Similar to `config-pluign.vue`:
  - Load module config using `useConfigModule`
  - Render module's custom form component if available
  - Handle form submission and results

**File**: `apps/admin/src/modules/config/components/config-module.types.ts`

- Type definitions for component props

#### 5.1.6 Create Module View ✅ COMPLETED

**File**: `apps/admin/src/modules/config/views/view-config-modules.vue`

- Similar to `view-config-plugins.vue`:
  - Display all modules in collapse/accordion
  - Each module shows its custom config form
  - Handle form submission for all modules

**File**: `apps/admin/src/modules/config/views/view-config-modules.types.ts`

- Type definitions for view props

#### 5.1.7 Update Config Module Registration ✅ COMPLETED

**File**: `apps/admin/src/modules/config/config.module.ts`

- Register `configModulesStore`:
  ```typescript
  const configModulesStore = registerConfigModuleStore(options.store);
  app.provide(configModulesStoreKey, configModulesStore);
  storesManager.addStore(configModulesStoreKey, configModulesStore);
  ```

- Add WebSocket event handler for modules:
  ```typescript
  if ('modules' in data.payload && Array.isArray(data.payload.modules)) {
    data.payload.modules.forEach((module) => {
      if (typeof module === 'object' && module !== null && 'type' in module && typeof module.type === 'string') {
        configModulesStore.onEvent({
          type: module.type,
          data: module,
        });
      }
    });
  }
  ```

- Add route for modules view

#### 5.1.8 Update Config App Store ✅ COMPLETED

**File**: `apps/admin/src/modules/config/store/config-app.store.schemas.ts`

- Add `modules` array to `ConfigAppSchema`:
  ```typescript
  modules: z.array(ConfigModuleSchema),
  ```

**File**: `apps/admin/src/modules/config/store/config-app.store.ts`

- Load modules config when fetching app config
- Update modules in store when config changes

#### 5.1.9 Update Router ✅ COMPLETED

**File**: `apps/admin/src/modules/config/router/index.ts`

- Add route for modules view:
  ```typescript
  {
    path: 'modules',
    name: RouteNames.CONFIG_MODULES,
    component: () => import('../views/view-config-modules.vue'),
  },
  ```

#### 5.1.10 Update Layout ✅ COMPLETED

**File**: `apps/admin/src/modules/config/layouts/layout-config.vue`

- Add navigation item for "Modules" (similar to "Plugins")
- Add route to sidebar menu

#### 5.1.11 Create Module Manager ✅ COMPLETED

**File**: `apps/admin/src/common/services/modules-manager.service.ts` (or similar location)

- Create `ModulesManager` service similar to `PluginsManager`
- Methods:
  - `addModule()` - register a module
  - `getModules()` - get all registered modules
  - `getModule()` - get module by type
- Store modules in a Map or similar structure

#### 5.1.12 Module Registration Pattern ✅ COMPLETED

Modules should register themselves during app initialization. Example:

**File**: `apps/admin/src/modules/devices/devices.module.ts` (or similar)

```typescript
export default {
  install: (app: App, options: IModuleOptions): void => {
    const modulesManager = injectModulesManager(app);
    
    modulesManager.addModule({
      type: DEVICES_MODULE_NAME,
      name: 'Devices',
      description: 'Device management module',
      modules: [CONFIG_MODULE_NAME],
      elements: [
        {
          type: CONFIG_MODULE_MODULE_TYPE,
          components: {
            moduleConfigEditForm: DevicesConfigForm, // Optional custom form
          },
          schemas: {
            moduleConfigSchema: DevicesConfigSchema, // Optional custom schema
            moduleConfigEditFormSchema: DevicesConfigEditFormSchema,
            moduleConfigUpdateReqSchema: DevicesConfigUpdateReqSchema,
          },
        },
      ],
    });
  },
};
```

### 5.2 Example: Devices Module Configuration UI

**Status**: Not implemented - No example module configuration needed at this time.

Modules can now register their configuration schemas following the pattern described in section 5.1.12. When a module needs configuration, it should:

1. Create module-specific config schemas (extending `ConfigModuleSchema`)
2. Create a custom form component (if needed)
3. Register the module with `ModulesManager` in the module's install function
4. Provide the custom form component and schemas in the module's element definition

### Future Enhancements

1. Module configuration validation rules
2. Module configuration change events/hooks
3. Module configuration migration system
4. Module configuration templates/presets

### Notes

- This feature mirrors the plugin configuration system to maintain consistency
- Modules are different from plugins: modules are core functionality, plugins are extensions
- Module names should use the module constant (e.g., `DEVICES_MODULE_NAME`)
- All DTOs and models should include proper Swagger decorators (`@ApiSchema`, `@ApiProperty`, `@ApiPropertyOptional`)
- Response models should extend `BaseSuccessResponseModel<T>` from `api-response.model`
- Error handling should use `ConfigException` and its subclasses (`ConfigNotFoundException`, `ConfigValidationException`, `ConfigCorruptedException`)
- The `setConfigSection()` method needs to be updated to handle modules in the plain config transformation (similar to how it handles plugins)

#### Admin App Notes

- Module registration follows the same pattern as plugin registration for consistency ✅ IMPLEMENTED
- Modules can optionally provide custom form components (similar to plugins) ✅ IMPLEMENTED
- If no custom form is provided, a default form should be generated from the schema (TODO: Future enhancement)
- Module schemas are validated using Zod (same as plugins) ✅ IMPLEMENTED
- The store pattern follows Pinia best practices ✅ IMPLEMENTED
- WebSocket events for modules follow the same structure as plugin events ✅ IMPLEMENTED
- Module config forms should support both desktop and mobile layouts (similar to plugin forms) ✅ IMPLEMENTED
- Consider using form builders for default forms if no custom form is provided (TODO: Future enhancement)

### Implementation Summary

#### Backend (✅ COMPLETED)
- Module configuration base classes (`ModuleConfigModel`, `UpdateModuleConfigDto`)
- `ModulesTypeMapperService` for schema registration
- `ConfigService` methods for module config management
- API endpoints: `GET /config/modules`, `GET /config/module/:module`, `PATCH /config/module/:module`
- YAML persistence for module configurations
- Unit tests (45 tests passing)

#### Admin App (✅ COMPLETED)
- `ModulesManager` service for module registration
- Module store (`config-modules.store.ts`) with full CRUD operations
- Composables: `useModules`, `useModule`, `useConfigModule`, `useConfigModules`, `useConfigModuleEditForm`
- Components: `config-module.vue` for rendering module config forms
- Views: `view-config-modules.vue` for displaying all module configurations
- Router integration with modules route
- Layout integration with modules tab
- WebSocket event handling for module config updates
- Locale strings for module configuration UI

#### Files Created
**Backend**: 
- 1 new file: `modules-type-mapper.service.ts`
- 8 modified files: `config.model.ts`, `config.dto.ts`, `config.service.ts`, `config.module.ts`, `config.controller.ts`, `config-response.model.ts`, `config.openapi.ts`, unit test files

**Admin App**: 
- 16 new files: Module store files, composables, components, views, schemas, types, and `ModulesManager` service
- 15 modified files: Constants, types, module registration, router, layout, app initialization, and locale files

#### Next Steps
1. Add unit tests for admin app stores, composables, and components
2. Modules can now register their configuration schemas using `ModulesManager`
3. Example module configuration can be added when needed (following the pattern in section 5.1.12)

