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

- [ ] Module can register its configuration schema
- [ ] Module configuration is persisted to YAML
- [ ] Module configuration is loaded on startup
- [ ] Module can retrieve its own configuration
- [ ] API endpoints work correctly
- [ ] Validation works for module configs
- [ ] Missing module config defaults are applied
- [ ] Invalid module config is handled gracefully
- [ ] Multiple modules can register configs independently

## Future Enhancements

1. Module configuration UI in admin panel (similar to plugin config forms)
2. Module configuration validation rules
3. Module configuration change events/hooks
4. Module configuration migration system

## Notes

- This feature mirrors the plugin configuration system to maintain consistency
- Modules are different from plugins: modules are core functionality, plugins are extensions
- Module names should use the module constant (e.g., `DEVICES_MODULE_NAME`)
- Consider adding module config to the admin panel in a future iteration
- All DTOs and models should include proper Swagger decorators (`@ApiSchema`, `@ApiProperty`, `@ApiPropertyOptional`)
- Response models should extend `BaseSuccessResponseModel<T>` from `api-response.model`
- Error handling should use `ConfigException` and its subclasses (`ConfigNotFoundException`, `ConfigValidationException`, `ConfigCorruptedException`)
- The `setConfigSection()` method needs to be updated to handle modules in the plain config transformation (similar to how it handles plugins)

