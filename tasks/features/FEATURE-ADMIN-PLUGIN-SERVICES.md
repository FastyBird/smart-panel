# Task: Admin Plugin Services Management UI

ID: FEATURE-ADMIN-PLUGIN-SERVICES
Type: feature
Scope: admin
Size: medium
Parent: (none)
Status: done

## 1. Business goal

In order to monitor and control plugin services from the admin interface
As an administrator
I want to view service status and start/stop/restart services through the UI

## 2. Context

- Backend API already implemented in `apps/backend/src/modules/extensions/controllers/services.controller.ts`
- CLI commands available in `apps/backend/src/modules/extensions/commands/services.command.ts`
- Services API provides: state, enabled, healthy, lastStartedAt, lastStoppedAt, lastError, startCount, uptimeMs
- Three device connector services: `devices-shelly-v1:connector`, `devices-shelly-ng:connector`, `devices-home-assistant:connector`
- One logger service: `logger-rotating-file:file-logger`

### Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/extensions/services` | List all managed services |
| GET | `/api/extensions/services/:pluginName/:serviceId` | Get single service status |
| POST | `/api/extensions/services/:pluginName/:serviceId/start` | Start a service |
| POST | `/api/extensions/services/:pluginName/:serviceId/stop` | Stop a service |
| POST | `/api/extensions/services/:pluginName/:serviceId/restart` | Restart a service |

### Service Status Model

```typescript
interface ServiceStatus {
  pluginName: string;      // e.g., 'devices-shelly-v1'
  serviceId: string;       // e.g., 'connector'
  state: 'stopped' | 'starting' | 'started' | 'stopping' | 'error';
  enabled: boolean;        // Whether the plugin is enabled
  healthy?: boolean;       // undefined if health check not implemented
  lastStartedAt?: string;  // ISO 8601 timestamp
  lastStoppedAt?: string;  // ISO 8601 timestamp
  lastError?: string;      // Last error message
  startCount: number;      // Number of times service was started
  uptimeMs?: number;       // Current uptime in milliseconds
}
```

## 3. Scope

**In scope**

- Services list view showing all managed plugin services
- Service status display (state, uptime, health indicator)
- Start/stop/restart actions for each service
- Error display when service is in error state
- Integration with existing extensions module

**Out of scope**

- Service logs viewing
- Service configuration editing (handled by extension settings)
- Health check implementation for services that don't have it
- Real-time status updates via WebSocket (polling is acceptable)

## 4. Acceptance criteria

- [x] Services list accessible from extensions module (e.g., as a tab or sub-page)
- [x] Each service shows: plugin name, service ID, state badge, enabled status, health indicator
- [x] Running services show uptime in human-readable format (e.g., "2h 15m")
- [x] Services in error state show the last error message
- [x] Start button available for stopped/error services
- [x] Stop button available for running services
- [x] Restart button available for running services
- [x] Actions are disabled when service is in transitional state (starting/stopping)
- [x] Disabled plugins' services show as disabled (cannot start)
- [x] Loading states shown during API calls
- [x] Success/error toasts for service actions
- [x] OpenAPI types regenerated for services endpoints
- [x] All linting passes
- [x] Unit tests for new components

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: View services list

Given I am on the extensions page
When I navigate to the services tab/section
Then I see a list of all managed plugin services
And each service shows its current state and uptime

### Scenario: Restart a running service

Given a service is in "started" state
When I click the restart button
Then the service transitions to "stopping" then "starting" then "started"
And a success toast is shown

### Scenario: View error details

Given a service is in "error" state
When I view the service details
Then I see the last error message
And I can attempt to start the service again

## 6. Technical constraints

- Follow existing admin module structure in `apps/admin/src/modules/extensions/`
- Use existing UI components (badges, buttons, cards, toasts)
- Regenerate OpenAPI types with `pnpm run generate:openapi`
- Do not modify generated API code in `apps/admin/src/api/`
- Tests expected for new store actions and components

## 7. Implementation hints (optional)

- Look at `apps/admin/src/modules/extensions/views/view-extensions.vue` for page structure
- Reuse badge components for state display (similar to connection status)
- Use `formatDuration` or similar utility for uptime display
- Consider adding services as a tab in the extensions detail view or as a separate sub-route
- Store pattern similar to `extensions.store.ts`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Regenerate OpenAPI spec first to get TypeScript types for services endpoints.
