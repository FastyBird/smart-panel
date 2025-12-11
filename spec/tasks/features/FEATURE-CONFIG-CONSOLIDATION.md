# Task: Configuration Module Consolidation
ID: FEATURE-CONFIG-CONSOLIDATION
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to have a cleaner and more modular configuration architecture
As a developer
I want to consolidate configuration sections under their respective modules (weather under weather module, language and system under system module) and refactor the admin UI to have a simpler, more intuitive configuration interface with only modules and plugins tabs.

## 2. Context

- The configuration module currently manages multiple sections: language, weather, system, modules, and plugins.
- Some configuration sections have already been consolidated under modules using the `ModulesTypeMapperService` pattern (e.g., displays module and mdns module).
- Displays module (`apps/backend/src/modules/displays/displays.module.ts`) registers its config model with `ModulesTypeMapperService` in `onModuleInit()`:
  - Creates `DisplaysConfigModel` extending `ModuleConfigModel`
  - Creates `UpdateDisplaysConfigDto` extending `UpdateModuleConfigDto`
  - Registers mapping via `modulesMapperService.registerMapping()`
- MDNS module (`apps/backend/src/modules/mdns/mdns.module.ts`) follows the same pattern.
- The config module already handles module configuration via `/config/module/:module` endpoints (no new controllers needed in weather/system modules).
- Weather module exists at `apps/backend/src/modules/weather/` and already has its own module structure.
- System module exists at `apps/backend/src/modules/system/` and already has its own module structure.
- The admin app currently uses tabs for language, weather, system, plugins, and modules in `apps/admin/src/modules/config/layouts/layout-config.vue`.
- Devices and displays use a drawer pattern on large devices (`isLGDevice`) and page navigation on small devices, as seen in `apps/admin/src/modules/devices/views/view-devices.vue` and `apps/admin/src/modules/displays/views/view-displays.vue`.
- The panel app uses repositories in `apps/panel/lib/modules/config/repositories/` for language and weather configuration.
- Backend config controller at `apps/backend/src/modules/config/controllers/config.controller.ts` has section-based endpoints (`/config/:section`) that need to be removed.
- Config service at `apps/backend/src/modules/config/services/config.service.ts` manages all configuration sections.
- SectionType enum in `apps/backend/src/modules/config/config.constants.ts` includes LANGUAGE, WEATHER, and SYSTEM (to be removed).

## 3. Scope

**In scope**

- Register weather configuration model with `ModulesTypeMapperService` in weather module (following displays/mdns pattern)
- Register system configuration model (including language settings) with `ModulesTypeMapperService` in system module
- Create `WeatherConfigModel` extending `ModuleConfigModel` in weather module
- Create `UpdateWeatherConfigDto` extending `UpdateModuleConfigDto` in weather module
- Create `SystemConfigModel` extending `ModuleConfigModel` in system module (or update existing if present)
- Create `UpdateSystemConfigDto` extending `UpdateModuleConfigDto` in system module (include language settings)
- Remove deprecated section-based endpoints (`/config/:section`) from config controller
- Remove deprecated sections (LANGUAGE, WEATHER, SYSTEM) from SectionType enum
- Remove deprecated DTOs and models related to language, weather, and system sections from config module
- Update config service to remove deprecated section handling (keep module/plugin handling)
- Refactor admin UI to have only 2 tabs: modules and plugins
- Create new admin views for module/plugin configuration with large buttons that open configuration pages
- Implement drawer/page view pattern for module/plugin configuration (drawer on large devices, page view on small devices)
- Update admin router to support new navigation pattern
- Update panel app to use module-specific configuration repositories (weather module, system module)
- Update all references to deprecated config sections across all apps

**Out of scope**

- Changes to plugin configuration structure (plugins remain in config module)
- Changes to module configuration structure (modules remain in config module, but their individual configs move to respective modules)
- Migration of existing configuration data (YAML structure will remain compatible)
- API versioning (app is not released, breaking changes are acceptable)

## 4. Acceptance criteria

- [ ] Weather configuration is accessible through `/config/module/weather-module` endpoint (via config module)
- [ ] System configuration (including language) is accessible through `/config/module/system-module` endpoint (via config module)
- [ ] Weather module registers its config model with `ModulesTypeMapperService` in `onModuleInit()`
- [ ] System module registers its config model with `ModulesTypeMapperService` in `onModuleInit()`
- [ ] Config module section-based endpoints (`/config/:section`) for language, weather, and system are removed
- [ ] Admin UI shows only 2 tabs: "Modules" and "Plugins"
- [ ] Admin UI displays large buttons for each module/plugin in their respective tabs
- [ ] Clicking a module/plugin button opens its configuration in a drawer on large devices
- [ ] Clicking a module/plugin button navigates to a page view on small devices
- [ ] Weather module configuration page is accessible from modules tab
- [ ] System module configuration page (including language settings) is accessible from modules tab
- [ ] All plugin configuration pages are accessible from plugins tab
- [ ] Panel app uses weather module repository for weather configuration
- [ ] Panel app uses system module repository for language and system configuration
- [ ] All tests pass after refactoring
- [ ] No deprecated code or aliases remain in the codebase

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Access weather configuration from admin UI

Given I am on the Configuration page in the admin UI
When I click on the "Modules" tab
And I click on the "Weather" button
Then the weather configuration form opens in a drawer (on large devices) or navigates to a page (on small devices)
And I can edit weather settings
And changes are saved to `/config/module/weather-module` endpoint

### Scenario: Access system configuration from admin UI

Given I am on the Configuration page in the admin UI
When I click on the "Modules" tab
And I click on the "System" button
Then the system configuration form opens (including language settings)
And I can edit system and language settings
And changes are saved to `/config/module/system-module` endpoint

### Scenario: Access plugin configuration from admin UI

Given I am on the Configuration page in the admin UI
When I click on the "Plugins" tab
And I click on a plugin button (e.g., "Home Assistant Plugin")
Then the plugin configuration form opens in a drawer (on large devices) or navigates to a page (on small devices)
And I can edit plugin settings
And changes are saved to the config module plugin endpoint

## 6. Technical constraints

- Follow the existing module / service structure in backend modules (weather, system)
- Follow the existing drawer/page view pattern used in devices and displays modules
- Do not introduce new dependencies unless really needed
- Do not modify generated code (OpenAPI types, device/channel specs)
- Tests are expected for new logic
- Follow API conventions from `BACKEND_API_RULES.md` and `.ai-rules/API_CONVENTIONS.md`
- Follow coding style from `.ai-rules/GUIDELINES.md`
- Use existing patterns for module/plugin configuration forms
- Maintain backward compatibility in YAML file structure (sections can remain, but API access changes)

## 7. Implementation hints (optional)

- **CRITICAL**: Follow the exact pattern used by displays and mdns modules:
  - Look at `apps/backend/src/modules/displays/displays.module.ts` - see how it registers config in `onModuleInit()`
  - Look at `apps/backend/src/modules/displays/models/config.model.ts` - see `DisplaysConfigModel` extending `ModuleConfigModel`
  - Look at `apps/backend/src/modules/displays/dto/update-config.dto.ts` - see `UpdateDisplaysConfigDto` extending `UpdateModuleConfigDto`
  - Look at `apps/backend/src/modules/mdns/mdns.module.ts` - same pattern for mdns
  - Look at `apps/backend/src/modules/mdns/models/config.model.ts` and `apps/backend/src/modules/mdns/dto/update-config.dto.ts`
- The config module already handles API endpoints via `/config/module/:module` - no new controllers needed
- Module identifiers: `weather-module` (from `WEATHER_MODULE_NAME`), `system-module` (from `SYSTEM_MODULE_NAME`)
- Modules access their config via `configService.getModuleConfig<ConfigModel>(MODULE_NAME)` where MODULE_NAME is the constant (e.g., `WEATHER_MODULE_NAME`, `SYSTEM_MODULE_NAME`)
- Look at `apps/backend/src/modules/weather/weather.module.ts` for weather module structure
- Look at `apps/backend/src/modules/system/system.module.ts` for system module structure
- Look at `apps/admin/src/modules/devices/views/view-devices.vue` for drawer/page view pattern
- Look at `apps/admin/src/modules/displays/views/view-displays.vue` for drawer/page view pattern
- Look at `apps/admin/src/modules/config/views/view-config-modules.vue` for current modules view
- Look at `apps/admin/src/modules/config/views/view-config-plugins.vue` for current plugins view
- Reuse existing configuration form components where possible
- Check `apps/panel/lib/modules/weather/module.dart` for weather module structure in panel
- Check `apps/panel/lib/modules/system/module.dart` for system module structure in panel

## 8. AI instructions (for Junie / AI)

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Follow the phased approach outlined below.

## 9. Implementation Phases

### Phase 1: Backend - Weather Module Configuration
1. Create `WeatherConfigModel` extending `ModuleConfigModel` in weather module (move/adapt from config module)
2. Create `UpdateWeatherConfigDto` extending `UpdateModuleConfigDto` in weather module (move/adapt from config module)
3. Update weather module to import `ConfigModule` and `ModulesTypeMapperService`
4. Register weather config mapping in `weather.module.ts` `onModuleInit()` method (following displays/mdns pattern)
5. Update weather module services to use `configService.getModuleConfig<WeatherConfigModel>('weather-module')` instead of section-based access
6. Remove weather section handling from config controller (`/config/:section` endpoint)
7. Remove weather DTOs and models from config module (keep only if needed for migration)
8. Update config service to remove weather section handling (keep module handling)
9. Update SectionType enum to remove WEATHER
10. Update OpenAPI specification (config module endpoints remain, section endpoints removed)
11. Update tests

### Phase 2: Backend - System Module Configuration
1. Create or update `SystemConfigModel` extending `ModuleConfigModel` in system module (include language settings)
2. Create `UpdateSystemConfigDto` extending `UpdateModuleConfigDto` in system module (include language settings)
3. Ensure system module imports `ConfigModule` and has access to `ModulesTypeMapperService`
4. Register system config mapping in `system.module.ts` `onModuleInit()` method (following displays/mdns pattern)
5. Update system module services to use `configService.getModuleConfig<SystemConfigModel>('system-module')` instead of section-based access
6. Remove language and system section handling from config controller (`/config/:section` endpoint)
7. Remove language and system DTOs and models from config module (keep only if needed for migration)
8. Update config service to remove language and system section handling (keep module handling)
9. Update SectionType enum to remove LANGUAGE and SYSTEM
10. Update OpenAPI specification (config module endpoints remain, section endpoints removed)
11. Update tests

### Phase 3: Admin - UI Refactoring
1. Update config router to remove language, weather, and system routes
2. Refactor `view-config-modules.vue` to show large buttons for each module (instead of collapse items)
3. Refactor `view-config-plugins.vue` to show large buttons for each plugin (instead of collapse items)
4. Create module configuration edit view component (drawer/page pattern) - similar to device/display edit views
5. Create plugin configuration edit view component (drawer/page pattern) - similar to device/display edit views
6. Update config layout (`layout-config.vue`) to show only modules and plugins tabs
7. Update navigation logic for drawer/page view pattern (use router children routes like devices/displays)
8. Update stores to use `/config/module/:module` endpoints instead of section-based endpoints
9. Remove deprecated stores (config-language, config-weather, config-system) or update them to use module endpoints
10. Update translations
11. Update tests

### Phase 4: Panel - Module Configuration
1. Create weather configuration repository in weather module (use `/config/module/weather-module` endpoint)
2. Create or update system configuration repository in system module (use `/config/module/system-module` endpoint, include language settings)
3. Update weather module to use its own configuration repository instead of config module repository
4. Update system module to use its own configuration repository instead of config module repository
5. Remove weather and language repositories from config module (or mark as deprecated)
6. Update config module to remove weather and language initialization
7. Update all references to deprecated config repositories across panel app
8. Update socket event handlers to listen for module config updates instead of section updates
9. Update tests

### Phase 5: Cleanup and Testing
1. Remove all deprecated code references
2. Remove deprecated constants, types, and enums
3. Update all imports across all apps
4. Run all tests and fix any failures
5. Verify configuration YAML structure remains compatible
6. Update documentation if needed
