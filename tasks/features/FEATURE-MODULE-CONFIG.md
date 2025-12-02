# Feature: Module Configuration Support

## Overview

Add support for modules to register their own configuration schemas, similar to how plugins currently work. This will allow modules (like `devices`, `dashboard`, `system`, etc.) to define custom configuration that can be stored, retrieved, and updated through the config module.

## Current State

### Plugin Configuration System

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

### Modules

Modules are core functionality components (e.g., `devices`, `dashboard`, `system`, `users`, etc.) that are NestJS modules. Currently, they don't have a mechanism to register custom configuration schemas.

## Requirements

1. Modules should be able to register their configuration schema (model class and DTO class)
2. Module configurations should be stored in YAML under a `modules` key (similar to `plugins`)
3. Modules should be able to retrieve their configuration
4. API endpoints should be provided for module configuration management
5. The system should work the same way as plugin configuration

## Implementation Plan

### Phase 1: Core Infrastructure

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

### Phase 2: API Endpoints

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

### Phase 3: Example Implementation

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

### Phase 4: Testing & Documentation

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

## File Structure

### Backend

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

### Admin App

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

## API Endpoints

### Get All Module Configurations
```
GET /config/modules
Response: ConfigModuleResModules
```

### Get Module Configuration
```
GET /config/module/:module
Response: ConfigModuleResModuleConfig
```

### Update Module Configuration
```
PATCH /config/module/:module
Body: ReqUpdateModuleDto
Response: ConfigModuleResModuleConfig
```

## YAML Structure

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

## Migration Considerations

1. **Backward Compatibility**: Existing config files without `modules` key should work (default to empty array)
2. **Default Values**: Modules should provide sensible defaults if config is missing
3. **Validation**: Module configs should be validated on load (same as plugins)

## Testing Checklist

### Backend
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

### Admin App
- [ ] Module can register with ModulesManager
- [ ] Module store can fetch module configs from API
- [ ] Module store handles WebSocket events
- [ ] Module custom schemas are used when available
- [ ] Module custom forms are rendered correctly
- [ ] Module config form validation works
- [ ] Module config updates are sent to API
- [ ] Modules view displays all registered modules
- [ ] Module config is loaded on page navigation
- [ ] Error handling for missing modules
- [ ] Unit tests for stores, composables, components

## Phase 5: Admin App Implementation

### 5.1 Module Registration System

Modules need to register their configuration schemas similar to how plugins do. However, modules are core components, not plugins, so we need a different registration mechanism.

**Option A: Module Manager Service (Recommended)**
- Create a `ModulesManager` service similar to `PluginsManager`
- Modules register themselves during app initialization
- Store module metadata (name, type, schemas, components)

**Option B: Direct Module Registration**
- Modules directly register with the config module
- Simpler but less flexible

**Decision**: Use Option A for consistency with plugin system.

#### 5.1.1 Create Module Constants

**File**: `apps/admin/src/modules/config/config.constants.ts`

- Add `CONFIG_MODULE_MODULE_TYPE = 'module'` (similar to `CONFIG_MODULE_PLUGIN_TYPE`)
- Add route name: `CONFIG_MODULES: 'config_module-config_modules'`

#### 5.1.2 Create Module Types

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

#### 5.1.3 Create Module Store

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

#### 5.1.4 Create Module Composables

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

#### 5.1.5 Create Module Components

**File**: `apps/admin/src/modules/config/components/config-module.vue`

- Similar to `config-pluign.vue`:
  - Load module config using `useConfigModule`
  - Render module's custom form component if available
  - Handle form submission and results

**File**: `apps/admin/src/modules/config/components/config-module.types.ts`

- Type definitions for component props

#### 5.1.6 Create Module View

**File**: `apps/admin/src/modules/config/views/view-config-modules.vue`

- Similar to `view-config-plugins.vue`:
  - Display all modules in collapse/accordion
  - Each module shows its custom config form
  - Handle form submission for all modules

**File**: `apps/admin/src/modules/config/views/view-config-modules.types.ts`

- Type definitions for view props

#### 5.1.7 Update Config Module Registration

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

#### 5.1.8 Update Config App Store

**File**: `apps/admin/src/modules/config/store/config-app.store.schemas.ts`

- Add `modules` array to `ConfigAppSchema`:
  ```typescript
  modules: z.array(ConfigModuleSchema),
  ```

**File**: `apps/admin/src/modules/config/store/config-app.store.ts`

- Load modules config when fetching app config
- Update modules in store when config changes

#### 5.1.9 Update Router

**File**: `apps/admin/src/modules/config/router/index.ts`

- Add route for modules view:
  ```typescript
  {
    path: 'modules',
    name: RouteNames.CONFIG_MODULES,
    component: () => import('../views/view-config-modules.vue'),
  },
  ```

#### 5.1.10 Update Layout

**File**: `apps/admin/src/modules/config/layouts/layout-config.vue`

- Add navigation item for "Modules" (similar to "Plugins")
- Add route to sidebar menu

#### 5.1.11 Create Module Manager

**File**: `apps/admin/src/common/services/modules-manager.service.ts` (or similar location)

- Create `ModulesManager` service similar to `PluginsManager`
- Methods:
  - `addModule()` - register a module
  - `getModules()` - get all registered modules
  - `getModule()` - get module by type
- Store modules in a Map or similar structure

#### 5.1.12 Module Registration Pattern

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

To demonstrate the feature, add configuration UI for the `devices` module:

**File**: `apps/admin/src/modules/devices/components/config-form.vue` (new)
- Create Vue form component for devices module config
- Use form builder or custom form fields
- Handle validation using `DevicesConfigEditFormSchema`

**File**: `apps/admin/src/modules/devices/store/config.store.schemas.ts` (new)
- Create Zod schemas:
  - `DevicesConfigSchema` - extends base `ConfigModuleSchema`
  - `DevicesConfigEditFormSchema` - form validation schema
  - `DevicesConfigUpdateReqSchema` - update request schema

**File**: `apps/admin/src/modules/devices/devices.module.ts`
- Register module with `ModulesManager`
- Provide custom form component and schemas

## Future Enhancements

1. Module configuration validation rules
2. Module configuration change events/hooks
3. Module configuration migration system
4. Module configuration templates/presets

## Notes

- This feature mirrors the plugin configuration system to maintain consistency
- Modules are different from plugins: modules are core functionality, plugins are extensions
- Module names should use the module constant (e.g., `DEVICES_MODULE_NAME`)
- All DTOs and models should include proper Swagger decorators (`@ApiSchema`, `@ApiProperty`, `@ApiPropertyOptional`)
- Response models should extend `BaseSuccessResponseModel<T>` from `api-response.model`
- Error handling should use `ConfigException` and its subclasses (`ConfigNotFoundException`, `ConfigValidationException`, `ConfigCorruptedException`)
- The `setConfigSection()` method needs to be updated to handle modules in the plain config transformation (similar to how it handles plugins)

### Admin App Notes

- Module registration follows the same pattern as plugin registration for consistency
- Modules can optionally provide custom form components (similar to plugins)
- If no custom form is provided, a default form should be generated from the schema
- Module schemas are validated using Zod (same as plugins)
- The store pattern follows Pinia best practices
- WebSocket events for modules follow the same structure as plugin events
- Module config forms should support both desktop and mobile layouts (similar to plugin forms)
- Consider using form builders for default forms if no custom form is provided

