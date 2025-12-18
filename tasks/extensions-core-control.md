# Extensions Core Control - Implementation Plan

**Status:** ✅ Mostly Complete
**Branch:** `claude/admin-extension-management-*`

## Current State Analysis

### How It Works Now (After Implementation)

1. **`canToggleEnabled` determination**: Core modules use `NON_TOGGLEABLE_MODULES` constant, plugins check DTO inheritance
2. **Core modules**: Always enabled, cannot be toggled (protected by constant list)
3. **Core plugins**: Can be enabled/disabled based on DTO `enabled` property
4. **Result**: Core modules are protected, plugins remain toggleable

### The Problem (Resolved)

- ~~Core modules (devices, dashboard, users, etc.) can be disabled - they shouldn't be~~ ✅ Fixed
- ~~No distinction between module vs plugin behavior for enable/disable~~ ✅ Fixed
- ~~`isCore` flag exists but isn't used to restrict toggling~~ ✅ Now uses NON_TOGGLEABLE_MODULES

---

## Requirements Summary

### Extension Categories

| Category | Can Disable? | Can Remove? | Example |
|----------|--------------|-------------|---------|
| Core Module | NO | NO | devices-module, dashboard-module, users-module |
| Core Plugin | YES | NO | weather-openweathermap-plugin, devices-shelly-plugin |
| Non-Core Module | YES | YES (future) | third-party modules |
| Non-Core Plugin | YES | YES (future) | third-party plugins |

### Business Rules

1. **Core Modules**: Always enabled, cannot be toggled or removed (part of codebase)
2. **Core Plugins**: Can be enabled/disabled (user choice), cannot be removed (part of codebase)
3. **Non-Core Extensions**: Can be enabled/disabled, can be removed (future feature)

---

## Implementation Plan

### Phase 1: Backend - Core Module Protection ✅ COMPLETED

**File**: `apps/backend/src/modules/extensions/extensions.constants.ts`

Added `NON_TOGGLEABLE_MODULES` constant:
```typescript
export const NON_TOGGLEABLE_MODULES = [
  'auth-module', 'config-module', 'dashboard-module', 'devices-module',
  'displays-module', 'extensions-module', 'mdns-module', 'system-module',
  'users-module', 'weather-module',
];
```

**File**: `apps/backend/src/modules/extensions/services/extensions.service.ts`

Updated `buildModuleExtension()` to use the constant:
```typescript
const canToggleEnabled = !NON_TOGGLEABLE_MODULES.includes(type);
```

### Phase 2: Backend - Add `canRemove` Field ❌ NOT IMPLEMENTED

This was deferred as extension removal is not yet supported.

### Phase 3: Admin - Update UI Based on New Fields ✅ COMPLETED

**File**: `apps/admin/src/modules/extensions/components/extension-card.vue`

- Dropdown items show tooltips explaining why actions are disabled
- Core modules: "Core modules cannot be disabled"
- Core extensions: "Core extensions cannot be removed"
- Non-core: "Extension removal is not yet supported"

### Phase 4: OpenAPI & Types Regeneration ❌ SKIPPED

Not needed since `canRemove` field was not added.

---

## Additional Implementation (Beyond Original Scope)

### Backend - Extension Metadata & README Support ✅ COMPLETED

**All modules and plugins** now register metadata including README content:

```typescript
this.extensionsService.registerModuleMetadata({
  type: MODULE_NAME,
  name: 'Display Name',
  description: 'Description',
  author: 'FastyBird',
  readme: `# Module Name\n\nMarkdown content...`,
  links: { documentation, repository },
});
```

**Files modified:**
- All 11 core modules (auth, config, dashboard, devices, displays, extensions, mdns, system, users, weather)
- All 14 plugins (data-sources, devices integrations, pages, tiles, weather providers, logger)

### Backend - Public API for External Extensions ✅ COMPLETED

**File**: `apps/backend/src/index.ts` (NEW)

Exports for external extensions:
- `ExtensionsModule`, `ExtensionsService`
- `ConfigModule`, `PluginsTypeMapperService`
- `PluginConfigModel`, `UpdatePluginConfigDto`

### Example Extension Registration ✅ COMPLETED

**Package**: `packages/example-extension`

Updated to properly register with ExtensionsService:
- Added config model and DTO
- Registers with PluginsTypeMapperService
- Now appears in admin extensions list

### Admin - Extension Detail View ✅ COMPLETED

**File**: `apps/admin/src/modules/extensions/views/view-extension-detail.vue`

- Responsive tabs layout (README/Docs) for large devices
- Stacked cards for small devices
- Markdown renderer with DOMPurify sanitization

### Admin - Extension Loaders Refactoring ✅ COMPLETED

Moved from `common/extensions/` to `modules/extensions/loaders/`:
- `remote-extensions.loader.ts`
- `static-extensions.loader.ts`

---

## Future Enhancements (Out of Scope)

### Extensions Registry Endpoint

Create dedicated endpoint that returns all registered extensions:
- `GET /api/modules/extensions/registry`
- Returns extensions even if they only have backend (no admin)
- Single source of truth for extension discovery

### Third-Party Extension Management

1. **Discovery integration**: Activate `extensions-discovery.ts` service
2. **Remove endpoint**: `DELETE /api/modules/extensions/{type}` - triggers `pnpm remove`
3. **Install endpoint**: `POST /api/modules/extensions` - triggers `pnpm add`

### Extensions Store/Marketplace

- Browse available extensions
- One-click install from repository URL
- Version management

---

## Files Modified

### Backend
- [x] `apps/backend/src/modules/extensions/extensions.constants.ts` - Added NON_TOGGLEABLE_MODULES
- [x] `apps/backend/src/modules/extensions/services/extensions.service.ts` - Core module protection
- [x] `apps/backend/src/modules/extensions/models/extension.model.ts` - Added `readme`, `docs` fields
- [x] `apps/backend/src/index.ts` - NEW: Public API exports for external extensions
- [x] All module files - Added README metadata registration
- [x] All plugin files - Added README metadata registration
- [ ] `apps/backend/src/modules/extensions/models/extension.model.ts` - Add `canRemove` field (deferred)

### Admin
- [x] `apps/admin/src/modules/extensions/components/extension-card.vue` - Update UI tooltips
- [x] `apps/admin/src/modules/extensions/components/extensions-cards.vue` - Alphabetical sorting
- [x] `apps/admin/src/modules/extensions/views/view-extension-detail.vue` - README tabs layout
- [x] `apps/admin/src/modules/extensions/views/view-extension-detail.scss` - NEW: Styles
- [x] `apps/admin/src/modules/extensions/store/extensions.store.types.ts` - Added `readme`, `docs` types
- [x] `apps/admin/src/modules/extensions/store/extensions.transformers.ts` - Transform `readme`, `docs`
- [x] `apps/admin/src/modules/extensions/locales/en-US.json` - Added tooltip messages
- [x] `apps/admin/src/modules/extensions/loaders/` - NEW: Moved from common/extensions
- [x] `apps/admin/src/common/components/markdown-renderer.vue` - NEW: Markdown rendering

### Example Extension
- [x] `packages/example-extension/src/index.ts` - ExtensionsService registration
- [x] `packages/example-extension/src/dto/update-config.dto.ts` - NEW
- [x] `packages/example-extension/src/models/config.model.ts` - NEW
- [x] `packages/example-extension/package.json` - Added dependencies

---

## Acceptance Criteria

1. [x] Core modules show as "Enabled" with toggle disabled
2. [x] Core modules show tooltip: "Core modules cannot be disabled"
3. [x] Core plugins can be enabled/disabled normally
4. [x] Remove button disabled for all core extensions with tooltip: "Core extensions cannot be removed"
5. [x] Non-core extensions (when available) can be toggled and show remove option
6. [ ] OpenAPI spec regenerated with `canRemove` field (deferred - not needed yet)
7. [x] All linting passes
8. [ ] Unit tests pass (not verified)
