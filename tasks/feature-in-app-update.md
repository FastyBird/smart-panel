# Feature: In-App Update System

## Overview

Allow administrators to update the Smart Panel application (backend and admin) directly from the admin interface without requiring SSH access or terminal commands.

## Current Architecture

### Existing Update Mechanism
- **CLI Command**: `smart-panel-service update [--version X.Y.Z] [--beta]`
- **Distribution**: npm package `@fastybird/smart-panel` with tags: `latest`, `beta`, `alpha`
- **Service**: systemd-managed service running as `smart-panel` user
- **Update Flow**: Stop service → npm update → run migrations → start service

### Key Files
- `build/bin/smart-panel-service.js` - CLI service management (lines 417-525)
- `apps/backend/src/modules/system/` - System module with reboot/power-off/factory-reset
- `apps/admin/src/modules/system/` - Admin system management UI

## Requirements

### Functional Requirements
1. **Check for Updates**: Query npm registry for available versions
2. **Version Selection**: Allow upgrade to newer versions or downgrade to older ones
3. **Update Execution**: Trigger update from admin UI
4. **Progress Tracking**: Show update progress and status
5. **Post-Update Recovery**: Handle reconnection after backend restarts
6. **Role-Based Access**: Only admin/owner users can perform updates

### Non-Functional Requirements
1. **Reliability**: Update process must be atomic - either succeed completely or rollback
2. **Security**: Updates must run with appropriate permissions
3. **Visibility**: Clear feedback during update process
4. **Recovery**: Handle failed updates gracefully

## Technical Design

### 1. Backend Implementation

#### 1.1 Update Service (`apps/backend/src/modules/system/services/update.service.ts`)

```typescript
// Core responsibilities:
// - Fetch available versions from npm registry
// - Validate version compatibility
// - Coordinate update process

interface AvailableVersion {
  version: string;
  tag: 'latest' | 'beta' | 'alpha';
  published: string;
  changelog?: string;
}

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'installing' | 'migrating' | 'restarting' | 'completed' | 'failed';
  currentVersion: string;
  targetVersion?: string;
  progress?: number;
  error?: string;
}
```

**Key Methods:**
- `getAvailableVersions(): Promise<AvailableVersion[]>` - Fetch from npm registry
- `getCurrentVersion(): string` - Read from package.json
- `startUpdate(targetVersion: string): Promise<void>` - Initiate update process
- `getUpdateStatus(): UpdateStatus` - Get current update status

#### 1.2 Update Executor (`build/src/updater/`)

Since the NestJS backend will be killed during update, we need a separate mechanism:

**Option A: Detached Child Process (Recommended)**
```typescript
// Spawn a detached Node.js process that:
// 1. Stops the smart-panel service
// 2. Runs npm install @fastybird/smart-panel@version -g
// 3. Runs database migrations
// 4. Starts the smart-panel service
// 5. Writes status to a status file
```

**Option B: Systemd Drop-in Unit**
```ini
# /etc/systemd/system/smart-panel-update.service
[Unit]
Description=Smart Panel Update
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/smart-panel/bin/update-runner.js
```

#### 1.3 API Endpoints

```typescript
// New controller endpoints or WebSocket commands

// GET /api/v1/system-module/updates/available
// Returns list of available versions

// GET /api/v1/system-module/updates/current
// Returns current version and update status

// POST /api/v1/system-module/updates/check
// Trigger version check

// POST /api/v1/system-module/updates/start
// Body: { version: "1.2.3" }
// Starts update process

// WebSocket Events:
// - SystemModule.Update.Status (broadcast update progress)
// - SystemModule.Update.Start.Set (command to start update)
// - SystemModule.Update.Check.Set (command to check for updates)
```

#### 1.4 Event Types (add to `system.constants.ts`)

```typescript
export enum EventType {
  // ... existing events

  // Update events
  SYSTEM_UPDATE_AVAILABLE = 'SystemModule.Update.Available',
  SYSTEM_UPDATE_STATUS = 'SystemModule.Update.Status',
  SYSTEM_UPDATE_START_SET = 'SystemModule.Update.Start.Set',
  SYSTEM_UPDATE_CHECK_SET = 'SystemModule.Update.Check.Set',
}
```

### 2. Admin Frontend Implementation

#### 2.1 Update Store (`apps/admin/src/modules/system/store/update.store.ts`)

```typescript
interface UpdateState {
  availableVersions: AvailableVersion[];
  currentVersion: string;
  updateStatus: UpdateStatus;
  isChecking: boolean;
  isUpdating: boolean;
  lastChecked: Date | null;
}
```

#### 2.2 Update UI Component (`apps/admin/src/modules/system/components/system-update/`)

- `system-update.vue` - Main update component
- `version-selector.vue` - Version list with upgrade/downgrade options
- `update-progress.vue` - Progress indicator during update

**UI Flow:**
1. Show current version
2. "Check for Updates" button
3. Display available versions (grouped by tag: stable, beta, alpha)
4. "Update" button with confirmation dialog
5. Progress overlay during update
6. "Waiting for panel to restart" state
7. Auto-reconnect when backend comes back online

#### 2.3 Integration into Manage System

Add update section to `manage-system.vue` alongside existing restart/power-off/factory-reset options.

### 3. Update Process Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UPDATE PROCESS FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Admin clicks "Update to v1.2.3"                                │
│     └─> Frontend sends WebSocket command                           │
│                                                                     │
│  2. Backend receives command                                        │
│     ├─> Validates user permissions (admin/owner only)              │
│     ├─> Writes update request to status file                       │
│     ├─> Spawns detached update process                             │
│     └─> Sends acknowledgment to frontend                           │
│                                                                     │
│  3. Frontend shows "Update in progress" overlay                    │
│                                                                     │
│  4. Update process (detached):                                     │
│     ├─> Writes status: "stopping"                                  │
│     ├─> Stops smart-panel service                                  │
│     ├─> Writes status: "installing"                                │
│     ├─> Runs: npm install @fastybird/smart-panel@1.2.3 -g         │
│     ├─> Writes status: "migrating"                                 │
│     ├─> Runs database migrations                                   │
│     ├─> Writes status: "starting"                                  │
│     ├─> Starts smart-panel service                                 │
│     └─> Writes status: "completed" or "failed"                     │
│                                                                     │
│  5. Frontend polls health endpoint every 3 seconds                 │
│     └─> When backend responds, reconnect WebSocket                 │
│                                                                     │
│  6. Show success/failure notification                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Security Considerations

1. **Permission Check**: Only `admin` or `owner` roles can initiate updates
2. **Sudo Requirements**: Update process needs elevated privileges
   - Option A: Configure sudoers for specific commands
   - Option B: Run update service as root (less preferred)
3. **Database Backup**: Create backup before migration
4. **Version Validation**: Verify version exists in npm registry before updating
5. **Signature Verification**: (Future) Verify package integrity

### 5. Error Handling

| Scenario | Handling |
|----------|----------|
| npm install fails | Rollback to previous version, log error |
| Migration fails | Keep old code, show error message |
| Service won't start | Keep status file, allow retry from CLI |
| Network error during check | Show error, allow retry |
| User closes browser during update | Update continues, reconnect on return |

### 6. Configuration

Add to system module config:

```typescript
interface UpdateConfig {
  enabled: boolean;           // Enable/disable update feature
  checkInterval?: number;     // Auto-check interval in hours (0 = disabled)
  allowBeta: boolean;         // Show beta versions
  allowAlpha: boolean;        // Show alpha versions
  allowDowngrade: boolean;    // Allow downgrade to older versions
}
```

## Implementation Steps

### Phase 1: Backend Foundation
- [ ] Create `UpdateService` with npm registry integration
- [ ] Add version fetching from registry.npmjs.org API
- [ ] Create update status file management
- [ ] Add update-related event types
- [ ] Create detached update executor script

### Phase 2: API & Commands
- [ ] Add REST endpoints for update operations
- [ ] Register WebSocket command handlers
- [ ] Add permission checks (admin/owner only)
- [ ] Implement update status broadcasting

### Phase 3: Update Executor
- [ ] Create standalone update runner script
- [ ] Implement service stop/start via systemctl
- [ ] Add npm update execution
- [ ] Add migration runner
- [ ] Implement status file updates

### Phase 4: Admin UI
- [ ] Create update store with Pinia
- [ ] Build version list component
- [ ] Create update progress overlay
- [ ] Add to manage-system section
- [ ] Implement WebSocket event handling
- [ ] Add health check polling for reconnection

### Phase 5: Testing & Polish
- [ ] Unit tests for update service
- [ ] E2E tests for update flow
- [ ] Error handling and edge cases
- [ ] Documentation updates

## File Changes Summary

### New Files
```
apps/backend/src/modules/system/services/update.service.ts
apps/backend/src/modules/system/services/update.service.spec.ts
apps/backend/src/modules/system/controllers/updates.controller.ts
apps/backend/src/modules/system/dto/update-request.dto.ts
apps/backend/src/modules/system/models/update.model.ts
apps/backend/src/modules/system/models/update-response.model.ts

apps/admin/src/modules/system/store/update.store.ts
apps/admin/src/modules/system/store/update.store.types.ts
apps/admin/src/modules/system/store/update.store.schemas.ts
apps/admin/src/modules/system/composables/useSystemUpdate.ts
apps/admin/src/modules/system/components/system-update/system-update.vue
apps/admin/src/modules/system/components/system-update/version-selector.vue
apps/admin/src/modules/system/components/system-update/update-progress.vue

build/src/updater/update-runner.ts
build/src/updater/status-manager.ts
```

### Modified Files
```
apps/backend/src/modules/system/system.module.ts
apps/backend/src/modules/system/system.constants.ts
apps/backend/src/modules/system/system.openapi.ts
apps/backend/src/modules/system/models/config.model.ts
apps/backend/src/modules/system/dto/update-config.dto.ts

apps/admin/src/modules/system/components/system-info/manage-system.vue
apps/admin/src/modules/system/locales/en-US.json
apps/admin/src/modules/system/services/system-actions.service.ts
apps/admin/src/modules/system/composables/useSystemActions.ts
```

## npm Registry API

The npm registry provides a JSON API for package metadata:

```bash
# Get all versions
curl https://registry.npmjs.org/@fastybird/smart-panel

# Response includes:
# - versions: { "1.0.0": {...}, "1.1.0": {...} }
# - dist-tags: { "latest": "1.1.0", "beta": "1.2.0-beta.1" }
# - time: { "1.0.0": "2024-01-01T...", ... }
```

## Alternatives Considered

### Alternative 1: Direct npm Command Execution
Execute npm commands directly from the backend process.
- **Pros**: Simple implementation
- **Cons**: Process dies when service restarts, no status tracking

### Alternative 2: Systemd Timer-Based Update
Create a systemd timer that checks for updates.
- **Pros**: System-level reliability
- **Cons**: More complex setup, harder to trigger on-demand

### Alternative 3: Docker-Based Updates (Future)
Package as Docker image and use container orchestration.
- **Pros**: Cleaner updates, rollback support
- **Cons**: Requires Docker, more complex deployment

## Acceptance Criteria

1. [ ] Admin can see current installed version
2. [ ] Admin can check for available updates
3. [ ] Admin can see list of available versions (stable, beta, alpha)
4. [ ] Admin can select a specific version to update to (newer or older)
5. [ ] Update process shows progress feedback
6. [ ] System automatically reconnects after update completes
7. [ ] Failed updates show appropriate error messages
8. [ ] Only admin/owner users can access update functionality
9. [ ] Update works on Raspberry Pi (ARM) and x64 systems
10. [ ] Database migrations run automatically after update
