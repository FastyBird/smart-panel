# Task: Unify Backend Extension Logs and Display in Admin

ID: FEATURE-UNIFIED-EXTENSION-LOGS
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to monitor and troubleshoot extension behavior effectively
As an administrator
I want to view logs filtered by specific extensions in a unified format across all backend plugins

## 2. Context

### Current Logging State

The backend uses NestJS `Logger` across all plugins, but with inconsistent patterns:

**Shelly NG Plugin (Reference Implementation):**
```typescript
// apps/backend/src/plugins/devices-shelly-ng/services/shelly-ng.service.ts
private readonly logger = new Logger(ShellyNgService.name);
this.logger.log('[SHELLY NG][SHELLY SERVICE] Starting Shelly NG plugin service');
this.logger.error('[SHELLY NG][SHELLY SERVICE] Failed to start', { message, stack });
```

**Format convention observed:**
```
[PLUGIN_NAME][COMPONENT_NAME] Message content
```

**Plugins using this pattern:**
- `devices-shelly-ng`: `[SHELLY NG][DEVICE DELEGATE]`, `[SHELLY NG][SHELLY SERVICE]`, `[SHELLY NG][PLATFORM]`
- `devices-home-assistant`: `[HOME ASSISTANT][WS SERVICE]`, `[HOME ASSISTANT][PLATFORM]`, `[HOME ASSISTANT][MAPPER]`
- `devices-shelly-v1`: `[SHELLY V1][SERVICE]`
- `devices-third-party`: `[THIRD PARTY][PLATFORM]`
- `logger-rotating-file`: `[ROTATING FILE LOGGER][LOGGER]`

### Existing Logging Infrastructure

**SystemLoggerService** (`apps/backend/src/modules/system/services/system-logger.service.ts`):
- Implements NestJS `LoggerService` interface
- Stores logs in a ring buffer (capacity: 2000 entries)
- Each `LogEntryModel` has a `tag` field that can identify the source extension
- Currently set as NestJS app logger but plugins use direct `Logger` instances

**LogEntryModel** structure:
```typescript
{
  id: string;           // ULID
  ts: string;           // ISO timestamp
  source: LogEntrySource; // 'backend' | 'admin' | 'display' | 'other'
  level: number;        // 0-6
  type: LogEntryType;   // 'info' | 'warn' | 'error' | 'debug' | etc.
  tag?: string;         // Key field for extension filtering
  message?: string;
  args?: any[];
}
```

**Current Logs API** (`/logs`):
- Supports pagination via `after_id` and `limit`
- Does NOT support filtering by tag/extension

### Admin Extension Detail

The extension detail view (`apps/admin/src/modules/extensions/views/view-extension-detail.vue`):
- Shows extension info, README, and documentation tabs
- Does NOT have a logs tab for viewing extension-specific logs

### Reference Files

| Component | Location |
|-----------|----------|
| SystemLoggerService | `apps/backend/src/modules/system/services/system-logger.service.ts` |
| LogEntryModel | `apps/backend/src/modules/system/models/system.model.ts` |
| LogsController | `apps/backend/src/modules/system/controllers/logs.controller.ts` |
| Shelly NG Service (example) | `apps/backend/src/plugins/devices-shelly-ng/services/shelly-ng.service.ts` |
| Extension Detail View | `apps/admin/src/modules/extensions/views/view-extension-detail.vue` |
| System Logs Data Source | `apps/admin/src/modules/system/composables/useSystemLogsDataSource.ts` |
| System Logs View | `apps/admin/src/modules/system/views/view-system-logs.vue` |

## 3. Scope

**In scope**

- Create a unified logging utility/service for extensions
- Update all device plugins to use the unified logger with consistent tagging
- Extend logs API to support filtering by extension tag
- Add logs tab to extension detail page in admin
- Ensure log messages follow the `[PLUGIN_NAME][COMPONENT] message` format

**Out of scope**

- Real-time log streaming via WebSocket (polling is acceptable)
- Log persistence to database (existing file logger plugin handles this)
- Log rotation configuration
- Log export functionality
- Panel app log viewing

## 4. Acceptance criteria

### Backend - Unified Logger

- [ ] Create `ExtensionLoggerService` utility that wraps NestJS Logger with extension context
- [ ] The logger automatically prefixes messages with `[EXTENSION_TYPE][COMPONENT]` format
- [ ] The logger sets the `tag` field to the extension type (e.g., `devices-shelly-ng-plugin`)
- [ ] Update `devices-shelly-ng` plugin to use the unified logger (reference implementation)
- [ ] Update `devices-home-assistant` plugin to use the unified logger
- [ ] Update `devices-shelly-v1` plugin to use the unified logger
- [ ] Update `devices-third-party` plugin to use the unified logger
- [ ] Update `logger-rotating-file` plugin to use the unified logger
- [ ] Update other plugins with logging to use the unified logger

### Backend - Logs API Enhancement

- [ ] Add `tag` query parameter to `GET /logs` endpoint for filtering by extension
- [ ] Add `extension` query parameter as alias for `tag` (more intuitive for API consumers)
- [ ] Update OpenAPI documentation for the new query parameters
- [ ] Filtering is case-insensitive
- [ ] Multiple tags can be specified (comma-separated or array)

### Admin - Extension Logs Tab

- [ ] Add "Logs" tab to extension detail view
- [ ] The tab shows logs filtered by the current extension's type
- [ ] Reuse existing log display components from system logs view
- [ ] Include level filter (info, warn, error, debug)
- [ ] Include time range or "last N entries" option
- [ ] Show loading state while fetching logs
- [ ] Handle empty state (no logs for this extension)
- [ ] Refresh button to fetch latest logs
- [ ] Auto-refresh toggle (optional, similar to system logs view)

### Quality

- [ ] All lint checks pass (`pnpm run lint:js`)
- [ ] Code is formatted (`pnpm run pretty`)
- [ ] OpenAPI spec is regenerated (`pnpm run generate:openapi`)
- [ ] Unit tests for new ExtensionLoggerService
- [ ] Unit tests for logs filtering logic

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Developer views Shelly NG plugin logs

Given I am on the Shelly NG plugin detail page
When I click on the "Logs" tab
Then I see only logs from the `devices-shelly-ng-plugin` extension
And logs are sorted by timestamp (newest first)
And I can filter by log level (info, warn, error, debug)

### Scenario: Plugin logs with unified format

Given the Shelly NG plugin is running
When a device connection event occurs
Then a log entry is created with:
  - `tag` = "devices-shelly-ng-plugin"
  - `message` containing `[SHELLY NG][DEVICE DELEGATE] Device=xxx connected`
  - `source` = "backend"

### Scenario: API filtering by extension

Given there are logs from multiple extensions
When I call `GET /logs?extension=devices-shelly-ng-plugin`
Then I receive only logs where `tag` matches the specified extension
And pagination works correctly with the filter applied

## 6. Technical constraints

- Follow existing module/service patterns in the codebase
- Use the existing `SystemLoggerService` infrastructure
- Preserve backward compatibility - existing log formats should still work
- Do not modify generated code in `apps/admin/src/api/`
- Do not introduce new dependencies unless absolutely necessary
- Tests are expected for new business logic

## 7. Implementation hints

### Phase 1: Backend - Create Extension Logger Utility

1. Create `apps/backend/src/common/logger/extension-logger.service.ts`:

```typescript
import { Injectable, Logger, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class ExtensionLoggerService {
  private readonly logger: Logger;
  private extensionType: string;
  private componentName: string;

  setContext(extensionType: string, componentName: string) {
    this.extensionType = extensionType;
    this.componentName = componentName;
    this.logger = new Logger(`${extensionType}:${componentName}`);
  }

  private formatMessage(message: string): string {
    const prefix = this.getPrefix();
    return `[${prefix}][${this.componentName.toUpperCase()}] ${message}`;
  }

  private getPrefix(): string {
    // Convert 'devices-shelly-ng-plugin' to 'SHELLY NG'
    return this.extensionType
      .replace(/^devices-/, '')
      .replace(/-plugin$/, '')
      .replace(/-/g, ' ')
      .toUpperCase();
  }

  log(message: string, context?: object) { /* ... */ }
  error(message: string, context?: object) { /* ... */ }
  warn(message: string, context?: object) { /* ... */ }
  debug(message: string, context?: object) { /* ... */ }
}
```

2. Alternative approach - use a factory function:

```typescript
export function createExtensionLogger(
  extensionType: string,
  componentName: string
): Logger {
  // Return configured logger with proper context
}
```

### Phase 2: Backend - Update Logs Controller

1. Modify `apps/backend/src/modules/system/controllers/logs.controller.ts`:

```typescript
@Get()
list(
  @Query('after_id') afterId?: string,
  @Query('limit') limit: number = DEFAULT_PAGE_SIZE,
  @Query('tag') tag?: string,
  @Query('extension') extension?: string,  // Alias for tag
): LogEntriesResponseModel {
  const filterTag = extension || tag;
  const data = this.appLogger.getLatest(afterId, lim, filterTag);
  // ...
}
```

2. Update `SystemLoggerService.getLatest()` to accept optional tag filter:

```typescript
getLatest(afterId?: string, limit = 50, tag?: string): LogEntryModel[] {
  let all = this.rb.toArrayNewestFirst();

  if (tag) {
    all = all.filter(e => e.tag?.toLowerCase() === tag.toLowerCase());
  }

  // ... existing pagination logic
}
```

### Phase 3: Admin - Extension Logs Tab

1. Create `apps/admin/src/modules/extensions/components/extension-logs.vue`:
   - Reuse `useSystemLogsDataSource` composable with tag filter
   - Display logs using existing table component patterns

2. Update `apps/admin/src/modules/extensions/views/view-extension-detail.vue`:
   - Add new tab for logs
   - Pass extension type as filter parameter

3. Create composable `useExtensionLogs.ts`:
   - Wrap `useSystemLogsDataSource` with extension context
   - Handle fetching, filtering, and pagination

### Plugin Update Order

Update plugins in this order (from most to least complex):
1. `devices-shelly-ng` - Reference implementation, has most logging
2. `devices-home-assistant` - Second most logging
3. `devices-shelly-v1` - Simpler, fewer log calls
4. `devices-third-party` - Minimal logging
5. `logger-rotating-file` - Uses its own logging pattern
6. Other plugins with logging (data-sources-*, pages-*, tiles-*, weather-*)

### Key Files to Modify

**Backend:**
- `apps/backend/src/common/logger/extension-logger.service.ts` (new)
- `apps/backend/src/modules/system/controllers/logs.controller.ts`
- `apps/backend/src/modules/system/services/system-logger.service.ts`
- `apps/backend/src/plugins/devices-shelly-ng/**/*.ts`
- `apps/backend/src/plugins/devices-home-assistant/**/*.ts`
- `apps/backend/src/plugins/devices-shelly-v1/**/*.ts`
- `apps/backend/src/plugins/devices-third-party/**/*.ts`
- `apps/backend/src/plugins/logger-rotating-file/**/*.ts`

**Admin:**
- `apps/admin/src/modules/extensions/views/view-extension-detail.vue`
- `apps/admin/src/modules/extensions/components/extension-logs.vue` (new)
- `apps/admin/src/modules/extensions/composables/useExtensionLogs.ts` (new)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Follow the API conventions from `/.ai-rules/API_CONVENTIONS.md`.
- Regenerate OpenAPI spec after backend changes with `pnpm run generate:openapi`.
- Start with the backend changes (logger utility, API enhancement) before admin UI.
- Use the Shelly NG plugin as the reference implementation for log format.

## 9. Dependencies

- No external dependencies required
- Uses existing NestJS Logger infrastructure
- Uses existing admin UI components (el-tabs, el-table, etc.)

## 10. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing log parsing | Keep backward-compatible format, only standardize the prefix |
| Performance impact of filtering | Filter in memory since ring buffer is capped at 2000 entries |
| Large number of log entries | Use pagination and limit; ring buffer already caps at 2000 |
| Inconsistent extension type naming | Use the plugin/module `type` constant as the canonical tag |
