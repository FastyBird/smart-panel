# Extensions Core Control - Implementation Plan

## Current State Analysis

### How It Works Now

1. **`canToggleEnabled` determination**: Based on whether the DTO class has an `enabled` property
2. **Base DTOs**: Both `UpdateModuleConfigDto` and `UpdatePluginConfigDto` have `enabled?: boolean`
3. **Result**: ALL extensions currently have `canToggleEnabled: true` since they inherit from base DTOs

### The Problem

- Core modules (devices, dashboard, users, etc.) can be disabled - they shouldn't be
- No distinction between module vs plugin behavior for enable/disable
- `isCore` flag exists but isn't used to restrict toggling

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

### Phase 1: Backend - Core Module Protection (Simple Fix)

**File**: `apps/backend/src/modules/extensions/services/extensions.service.ts`

Update `buildModuleExtension()` method:

```typescript
private buildModuleExtension(type: string): ExtensionModel {
  const metadata = this.moduleMetadata.get(type);
  const isCore = this.bundledService.isCore(type);

  // Core modules cannot be toggled - they must always be enabled
  // Non-core modules can be toggled if their DTO supports it
  let canToggleEnabled = false;
  if (!isCore) {
    try {
      const mapping = this.modulesMapperService.getMapping(type);
      canToggleEnabled = this.hasEnabledProperty(mapping.configDto);
    } catch {
      canToggleEnabled = false;
    }
  }

  // Core modules are always enabled
  let enabled = true;
  if (!isCore) {
    try {
      const moduleConfig = this.configService.getModuleConfig(type);
      enabled = moduleConfig.enabled ?? true;
    } catch {
      enabled = true;
    }
  }

  // ... rest of the method
  extension.canToggleEnabled = canToggleEnabled;
  extension.enabled = enabled; // Core modules always true
}
```

**Plugins remain unchanged** - they can already be toggled based on DTO.

### Phase 2: Backend - Add `canRemove` Field

**File**: `apps/backend/src/modules/extensions/models/extension.model.ts`

Add new field:

```typescript
@ApiProperty({
  description: 'Whether this extension can be removed',
  example: false,
})
@Expose()
canRemove: boolean;
```

**Logic**:
- `canRemove = !isCore` (core extensions cannot be removed)

### Phase 3: Admin - Update UI Based on New Fields

**File**: `apps/admin/src/modules/extensions/components/extension-card.vue`

Update dropdown to show proper states:

```vue
<el-dropdown-item
  :command="extension.enabled ? 'disable' : 'enable'"
  :disabled="!extension.canToggleEnabled"
>
  <!-- Show reason if disabled -->
  <el-tooltip
    v-if="!extension.canToggleEnabled && extension.isCore && extension.kind === 'module'"
    content="Core modules cannot be disabled"
  >
    ...
  </el-tooltip>
</el-dropdown-item>

<el-dropdown-item
  command="delete"
  :disabled="!extension.canRemove"
>
  <!-- Show reason: "Core extensions cannot be removed" or "Not yet supported" -->
</el-dropdown-item>
```

### Phase 4: OpenAPI & Types Regeneration

After backend changes:
```bash
pnpm run generate:openapi
```

This will update:
- `spec/api/v1/openapi.json`
- `apps/admin/src/api/openapi.ts`

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

## Files to Modify

### Backend
- [ ] `apps/backend/src/modules/extensions/services/extensions.service.ts` - Core module protection
- [ ] `apps/backend/src/modules/extensions/models/extension.model.ts` - Add `canRemove` field

### Admin
- [ ] `apps/admin/src/modules/extensions/components/extension-card.vue` - Update UI tooltips
- [ ] `apps/admin/src/modules/extensions/components/extensions-table.vue` - Update table actions
- [ ] `apps/admin/src/modules/extensions/store/extensions.store.types.ts` - Add `canRemove` type
- [ ] `apps/admin/src/modules/extensions/store/extensions.transformers.ts` - Transform `canRemove`
- [ ] `apps/admin/src/modules/extensions/locales/en-US.json` - Add tooltip messages

### Generated (after backend changes)
- [ ] `spec/api/v1/openapi.json` - Regenerate
- [ ] `apps/admin/src/api/openapi.ts` - Regenerate

---

## Acceptance Criteria

1. [ ] Core modules show as "Enabled" with toggle disabled
2. [ ] Core modules show tooltip: "Core modules cannot be disabled"
3. [ ] Core plugins can be enabled/disabled normally
4. [ ] Remove button disabled for all core extensions with tooltip: "Core extensions cannot be removed"
5. [ ] Non-core extensions (when available) can be toggled and show remove option
6. [ ] OpenAPI spec regenerated with `canRemove` field
7. [ ] All linting passes
8. [ ] Unit tests pass
