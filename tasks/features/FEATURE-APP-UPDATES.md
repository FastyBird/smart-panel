# Task: Application Updates Mechanism

ID: FEATURE-APP-UPDATES
Type: feature
Scope: backend, admin
Size: large
Parent: FEATURE-LINUX-DEVICE-INSTALLATION
Status: planned

## 1. Business goal

In order to easily keep my Smart Panel installation up to date with the latest features and bug fixes
As a home automation administrator
I want to check for available updates and trigger updates through both the CLI and admin web interface, with clear progress feedback and automatic service restart.

## 2. Context

### Current State

The project already has a basic update mechanism via the CLI:
- `smart-panel-service update` command exists in `build/bin/smart-panel-service.js`
- The command stops the service, runs `npm update`, runs migrations, and restarts
- No version check before update (always attempts update)
- No API endpoint for updates (admin UI cannot trigger updates)
- No progress feedback beyond CLI output

### Existing Infrastructure

**Build Package** (`build/`):
- `bin/smart-panel-service.js` - Service management CLI with `update` command
- `src/installers/linux.ts` - Linux installer with `runMigrations()` method
- Uses Commander.js for CLI parsing, chalk/ora for output

**Backend System Module** (`apps/backend/src/modules/system/`):
- `SystemService` - System info, throttle status, temperature
- `SystemLoggerService` - Ring buffer for logs
- `system.controller.ts` - `/system/info`, `/system/health`, `/system/reboot`, `/system/power-off`
- `system-command.service.ts` - Executes system commands

**Admin System Module** (`apps/admin/src/modules/system/`):
- `SystemActionsService` - Handles reboot/power-off with loading states
- `useSystemActions` composable - Triggers system actions from UI
- `ManageSystem.vue` - System management options (restart, power off, factory reset, logs)

**WebSocket Gateway** (`apps/backend/src/modules/websocket/`):
- Existing real-time event distribution
- Used for system info broadcasts

### Reference Files

| Component | Location |
|-----------|----------|
| Service CLI | `build/bin/smart-panel-service.js` |
| Linux Installer | `build/src/installers/linux.ts` |
| System Controller | `apps/backend/src/modules/system/controllers/system.controller.ts` |
| System Service | `apps/backend/src/modules/system/services/system.service.ts` |
| Command Service | `apps/backend/src/modules/system/services/system-command.service.ts` |
| System Constants | `apps/backend/src/modules/system/system.constants.ts` |
| Admin System Actions | `apps/admin/src/modules/system/services/system-actions.service.ts` |
| Manage System Component | `apps/admin/src/modules/system/components/system-info/manage-system.vue` |
| About Application | `apps/admin/src/modules/system/components/system-info/about-application.vue` |

## 3. Scope

**In scope**

- Backend service to check for available updates via npm registry
- REST API endpoints for version info and update triggering
- Enhanced CLI update command with version checking
- WebSocket events for update progress and status
- Admin UI to display current version and available updates
- Admin UI to trigger updates with progress feedback
- Update notification in admin header/dashboard
- Rollback information and warnings for major version updates
- Update changelog display

**Out of scope**

- Automatic/scheduled updates (security concern - requires explicit user action)
- Panel (Flutter) app updates (separate Flutter update mechanism)
- Beta/alpha channel switching via API (CLI only)
- Plugin/extension individual updates
- Backup before update (should be separate feature)
- Multi-node cluster updates

## 4. Acceptance criteria

### 4.1 Backend - Update Service

- [ ] Create `UpdateService` in system module to manage update operations
- [ ] Implement npm registry query to check for latest version (`https://registry.npmjs.org/@fastybird/smart-panel`)
- [ ] Compare current version with latest available using semver
- [ ] Cache version check results (refresh every 6 hours or on demand)
- [ ] Detect update type (patch, minor, major) and include in response
- [ ] Fetch release notes/changelog from GitHub releases API
- [ ] Track update status (idle, checking, downloading, installing, migrating, restarting, complete, failed)
- [ ] Implement update lock to prevent concurrent updates
- [ ] Log all update operations for debugging

### 4.2 Backend - REST API Endpoints

- [ ] `GET /api/v1/system/update/status` - Get current update status and available version
  - Returns: `{ current_version, latest_version, update_available, update_type, status, last_checked, changelog_url }`
- [ ] `POST /api/v1/system/update/check` - Force check for updates (invalidate cache)
  - Returns: Same as status endpoint with fresh data
- [ ] `POST /api/v1/system/update/install` - Trigger update installation
  - Accepts: `{ version?: string, allow_major?: boolean }`
  - Returns: `{ status: 'started', message: string }`
- [ ] All endpoints require authentication and admin role
- [ ] Update OpenAPI documentation for new endpoints

### 4.3 Backend - WebSocket Events

- [ ] Emit `system.update.status` event when update status changes
- [ ] Emit `system.update.progress` event during update with phase info
- [ ] Event payload: `{ status, phase, progress_percent, message, error? }`
- [ ] Phases: `checking`, `downloading`, `stopping`, `installing`, `migrating`, `starting`, `complete`, `failed`

### 4.4 Backend - Update Execution

- [ ] Create `UpdateExecutorService` to handle the update process
- [ ] Execute update in a detached child process (survive parent restart)
- [ ] Write update status to a status file for recovery (`/var/lib/smart-panel/update-status.json`)
- [ ] On startup, check for pending update status and report completion/failure
- [ ] Handle graceful service restart after update
- [ ] Implement timeout for update operations (10 minutes max)
- [ ] Clean up temporary files after update

### 4.5 CLI - Enhanced Update Command

- [ ] Add `--check` flag to only check for updates without installing
- [ ] Add `--changelog` flag to display release notes
- [ ] Add `--yes` / `-y` flag to skip confirmation prompts
- [ ] Display update type (patch/minor/major) with appropriate warnings
- [ ] Show progress with spinner and phase information
- [ ] Add `--allow-major` flag to explicitly allow major version updates
- [ ] Default behavior: Prompt for confirmation on major updates

### 4.6 Admin - Update Status Display

- [ ] Create `useUpdateStatus` composable for fetching and tracking update status
- [ ] Create `UpdateStatusStore` Pinia store for caching update information
- [ ] Display current version in system info page
- [ ] Display available update with version number and type badge
- [ ] Show last checked timestamp
- [ ] Link to changelog/release notes

### 4.7 Admin - Update Trigger UI

- [ ] Add "Check for Updates" button in system info page
- [ ] Add "Install Update" button when update is available
- [ ] Show confirmation dialog before installing (especially for major updates)
- [ ] Display progress overlay during update with phase information
- [ ] Handle reconnection after service restart
- [ ] Show success/failure notification after update completes
- [ ] Add update option to manage-system component

### 4.8 Admin - Update Notification

- [ ] Show notification badge/indicator when update is available
- [ ] Add notification in header or system tray area
- [ ] Notification links to update page/dialog
- [ ] Persist notification dismissal until new version available

### 4.9 Quality

- [ ] All lint checks pass (`pnpm run lint:js`)
- [ ] Code is formatted (`pnpm run pretty`)
- [ ] OpenAPI spec is regenerated (`pnpm run generate:openapi`)
- [ ] Unit tests for UpdateService (version comparison, cache logic)
- [ ] Unit tests for UpdateExecutorService (status file handling)
- [ ] E2E tests for update API endpoints
- [ ] Admin composable tests

## 5. Example scenarios

### Scenario: Check for updates via admin UI

Given I am logged in as an administrator
And my current version is 1.2.0
When I navigate to the system info page
Then I see my current version "1.2.0"
And I see a "Check for Updates" button
When I click "Check for Updates"
Then I see a loading indicator
And the button becomes disabled
When the check completes
Then I see "Update available: 1.3.0 (minor)"
And I see an "Install Update" button.

### Scenario: Install update via admin UI

Given an update is available (1.2.0 -> 1.3.0)
When I click "Install Update"
Then I see a confirmation dialog with release notes summary
When I confirm the update
Then I see a full-screen progress overlay
And I see the current phase (e.g., "Downloading update...")
And I see a progress indicator
When the service restarts
Then I see "Waiting for service to restart..."
When the service comes back online
Then I see "Update complete! Now running version 1.3.0"
And the page reloads with the new version.

### Scenario: Major version update warning

Given an update is available (1.9.0 -> 2.0.0)
When I click "Install Update"
Then I see a warning dialog about major version changes
And I see a list of breaking changes from changelog
And I must check a confirmation checkbox
When I confirm the update
Then the update proceeds normally.

### Scenario: CLI update check

Given Smart Panel is installed with version 1.2.0
When I run `smart-panel-service update --check`
Then I see "Current version: 1.2.0"
And I see "Latest version: 1.3.0"
And I see "Update type: minor"
And I see "Run 'smart-panel-service update' to install".

### Scenario: CLI update with confirmation

Given an update is available (1.2.0 -> 1.3.0)
When I run `sudo smart-panel-service update`
Then I see the update details
And I am prompted "Do you want to proceed? (yes/no)"
When I type "yes"
Then the update proceeds with progress output.

### Scenario: Update failure recovery

Given an update is in progress
And the update fails during migration
When the service restarts
Then I see an error notification in the admin UI
And the update status shows "failed"
And I see the error message and suggested actions.

## 6. Technical constraints

- Use Commander.js for CLI argument parsing (already used)
- Follow existing NestJS module patterns in the codebase
- Use existing WebSocket gateway for real-time events
- Breaking changes to API are allowed (app is in development)
- Do not modify generated code in `apps/admin/src/api/`
- Tests are expected for new business logic
- Update process must survive the parent process restart
- Must handle network failures gracefully during update
- Status file must be atomic writes to prevent corruption
- All file operations must handle permissions correctly

## 7. Implementation hints

### Phase 1: Backend - Update Service

#### 7.1 Create UpdateService

Create `apps/backend/src/modules/system/services/update.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as semver from 'semver';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  updateType: 'patch' | 'minor' | 'major' | null;
  lastChecked: Date | null;
  changelogUrl: string | null;
  releaseNotes: string | null;
}

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'stopping' | 'installing' | 'migrating' | 'starting' | 'complete' | 'failed';
  phase: string | null;
  progressPercent: number | null;
  message: string | null;
  error: string | null;
  startedAt: Date | null;
}

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly NPM_REGISTRY = 'https://registry.npmjs.org/@fastybird/smart-panel';
  private readonly GITHUB_RELEASES = 'https://api.github.com/repos/FastyBird/smart-panel/releases';
  private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  private cachedInfo: UpdateInfo | null = null;
  private cachedAt: Date | null = null;
  private updateStatus: UpdateStatus = { status: 'idle', phase: null, progressPercent: null, message: null, error: null, startedAt: null };
  private updateLock = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getUpdateInfo(forceRefresh = false): Promise<UpdateInfo> {
    if (!forceRefresh && this.cachedInfo && this.cachedAt) {
      const age = Date.now() - this.cachedAt.getTime();
      if (age < this.CACHE_TTL_MS) {
        return this.cachedInfo;
      }
    }

    return this.checkForUpdates();
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    this.setStatus({ status: 'checking', phase: 'Checking npm registry...', progressPercent: 0 });

    try {
      const currentVersion = this.getCurrentVersion();
      const response = await fetch(this.NPM_REGISTRY);
      const data = await response.json();
      const latestVersion = data['dist-tags']?.latest;

      const updateAvailable = latestVersion && semver.gt(latestVersion, currentVersion);
      let updateType: 'patch' | 'minor' | 'major' | null = null;

      if (updateAvailable) {
        if (semver.major(latestVersion) > semver.major(currentVersion)) {
          updateType = 'major';
        } else if (semver.minor(latestVersion) > semver.minor(currentVersion)) {
          updateType = 'minor';
        } else {
          updateType = 'patch';
        }
      }

      this.cachedInfo = {
        currentVersion,
        latestVersion,
        updateAvailable,
        updateType,
        lastChecked: new Date(),
        changelogUrl: `https://github.com/FastyBird/smart-panel/releases/tag/v${latestVersion}`,
        releaseNotes: null, // Fetched separately
      };
      this.cachedAt = new Date();

      this.setStatus({ status: 'idle' });

      return this.cachedInfo;
    } catch (error) {
      this.logger.error('Failed to check for updates', error);
      this.setStatus({ status: 'failed', error: error.message });
      throw error;
    }
  }

  getCurrentVersion(): string {
    // Read from package.json
    const packageJson = require('../../../../package.json');
    return packageJson.version;
  }

  getStatus(): UpdateStatus {
    return { ...this.updateStatus };
  }

  isUpdateInProgress(): boolean {
    return this.updateLock;
  }

  private setStatus(partial: Partial<UpdateStatus>): void {
    this.updateStatus = { ...this.updateStatus, ...partial };
    this.eventEmitter.emit('system.update.status', this.updateStatus);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledCheck(): Promise<void> {
    try {
      await this.checkForUpdates();
    } catch {
      // Ignore scheduled check failures
    }
  }
}
```

#### 7.2 Create Update Response Models

Create `apps/backend/src/modules/system/models/update.model.ts`:

```typescript
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { BaseSuccessResponseModel } from '../../api/models/response.model';

@ApiSchema({ name: 'SystemModuleDataUpdateInfo' })
export class UpdateInfoModel {
  @ApiProperty({ description: 'Current installed version' })
  @Expose({ name: 'current_version' })
  currentVersion: string;

  @ApiProperty({ description: 'Latest available version', nullable: true })
  @Expose({ name: 'latest_version' })
  latestVersion: string | null;

  @ApiProperty({ description: 'Whether an update is available' })
  @Expose({ name: 'update_available' })
  updateAvailable: boolean;

  @ApiProperty({ description: 'Type of update', enum: ['patch', 'minor', 'major'], nullable: true })
  @Expose({ name: 'update_type' })
  updateType: 'patch' | 'minor' | 'major' | null;

  @ApiProperty({ description: 'When the update was last checked', nullable: true })
  @Expose({ name: 'last_checked' })
  lastChecked: Date | null;

  @ApiProperty({ description: 'URL to changelog/release notes', nullable: true })
  @Expose({ name: 'changelog_url' })
  changelogUrl: string | null;
}

@ApiSchema({ name: 'SystemModuleDataUpdateStatus' })
export class UpdateStatusModel {
  @ApiProperty({ description: 'Current update status', enum: ['idle', 'checking', 'downloading', 'stopping', 'installing', 'migrating', 'starting', 'complete', 'failed'] })
  @Expose()
  status: string;

  @ApiProperty({ description: 'Current phase description', nullable: true })
  @Expose()
  phase: string | null;

  @ApiProperty({ description: 'Progress percentage', nullable: true })
  @Expose({ name: 'progress_percent' })
  progressPercent: number | null;

  @ApiProperty({ description: 'Status message', nullable: true })
  @Expose()
  message: string | null;

  @ApiProperty({ description: 'Error message if failed', nullable: true })
  @Expose()
  error: string | null;
}

@ApiSchema({ name: 'SystemModuleResUpdateInfo' })
export class UpdateInfoResponseModel extends BaseSuccessResponseModel<UpdateInfoModel> {
  @ApiProperty({ type: UpdateInfoModel })
  @Expose()
  @Type(() => UpdateInfoModel)
  declare data: UpdateInfoModel;
}

@ApiSchema({ name: 'SystemModuleResUpdateStatus' })
export class UpdateStatusResponseModel extends BaseSuccessResponseModel<UpdateStatusModel> {
  @ApiProperty({ type: UpdateStatusModel })
  @Expose()
  @Type(() => UpdateStatusModel)
  declare data: UpdateStatusModel;
}
```

#### 7.3 Create Update Controller

Create `apps/backend/src/modules/system/controllers/update.controller.ts`:

```typescript
import { Controller, Get, Post, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/users.constants';
import { UpdateService } from '../services/update.service';
import { UpdateExecutorService } from '../services/update-executor.service';
import { UpdateInfoResponseModel, UpdateStatusResponseModel } from '../models/update.model';
import { SYSTEM_MODULE_API_TAG_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('system/update')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UpdateController {
  constructor(
    private readonly updateService: UpdateService,
    private readonly updateExecutor: UpdateExecutorService,
  ) {}

  @ApiOperation({
    summary: 'Get update status',
    description: 'Returns current version, available updates, and update status',
    operationId: 'get-system-module-update-status',
  })
  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.USER)
  async getStatus(): Promise<UpdateInfoResponseModel> {
    const info = await this.updateService.getUpdateInfo();
    const status = this.updateService.getStatus();

    const response = new UpdateInfoResponseModel();
    response.data = { ...info, ...status };
    return response;
  }

  @ApiOperation({
    summary: 'Check for updates',
    description: 'Force check for available updates',
    operationId: 'post-system-module-update-check',
  })
  @Post('check')
  @Roles(UserRole.ADMIN)
  async checkForUpdates(): Promise<UpdateInfoResponseModel> {
    const info = await this.updateService.checkForUpdates();

    const response = new UpdateInfoResponseModel();
    response.data = info;
    return response;
  }

  @ApiOperation({
    summary: 'Install update',
    description: 'Start the update installation process',
    operationId: 'post-system-module-update-install',
  })
  @Post('install')
  @Roles(UserRole.ADMIN)
  async installUpdate(
    @Body() body: { version?: string; allow_major?: boolean },
  ): Promise<UpdateStatusResponseModel> {
    if (this.updateService.isUpdateInProgress()) {
      throw new ForbiddenException('An update is already in progress');
    }

    const info = await this.updateService.getUpdateInfo();
    if (!info.updateAvailable) {
      throw new ForbiddenException('No update available');
    }

    if (info.updateType === 'major' && !body.allow_major) {
      throw new ForbiddenException('Major version update requires explicit confirmation');
    }

    await this.updateExecutor.startUpdate(body.version || info.latestVersion);

    const response = new UpdateStatusResponseModel();
    response.data = this.updateService.getStatus();
    return response;
  }
}
```

### Phase 2: Backend - Update Executor

#### 7.4 Create UpdateExecutorService

Create `apps/backend/src/modules/system/services/update-executor.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const STATUS_FILE = '/var/lib/smart-panel/update-status.json';

export interface UpdateProgress {
  status: 'pending' | 'downloading' | 'stopping' | 'installing' | 'migrating' | 'starting' | 'complete' | 'failed';
  phase: string;
  targetVersion: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

@Injectable()
export class UpdateExecutorService implements OnModuleInit {
  private readonly logger = new Logger(UpdateExecutorService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    // Check for completed/failed update on startup
    this.checkPendingUpdateStatus();
  }

  private checkPendingUpdateStatus(): void {
    if (!existsSync(STATUS_FILE)) {
      return;
    }

    try {
      const status = JSON.parse(readFileSync(STATUS_FILE, 'utf-8')) as UpdateProgress;

      if (status.status === 'complete') {
        this.logger.log(`Update to ${status.targetVersion} completed successfully`);
        this.eventEmitter.emit('system.update.status', {
          status: 'complete',
          phase: 'Update complete',
          message: `Successfully updated to ${status.targetVersion}`,
        });
      } else if (status.status === 'failed') {
        this.logger.error(`Update to ${status.targetVersion} failed: ${status.error}`);
        this.eventEmitter.emit('system.update.status', {
          status: 'failed',
          phase: 'Update failed',
          error: status.error,
        });
      }

      // Clean up status file after processing
      unlinkSync(STATUS_FILE);
    } catch (error) {
      this.logger.error('Failed to read update status file', error);
    }
  }

  async startUpdate(targetVersion: string): Promise<void> {
    this.logger.log(`Starting update to version ${targetVersion}`);

    // Write initial status
    this.writeStatus({
      status: 'pending',
      phase: 'Preparing update',
      targetVersion,
      startedAt: new Date().toISOString(),
    });

    // Spawn detached update script
    // The update script will:
    // 1. Stop the service
    // 2. Run npm update
    // 3. Run migrations
    // 4. Start the service
    // 5. Update status file

    const updateScript = join(__dirname, '..', '..', '..', '..', '..', 'build', 'scripts', 'update-worker.sh');

    const child = spawn('bash', [updateScript, targetVersion], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        UPDATE_VERSION: targetVersion,
        STATUS_FILE,
      },
    });

    child.unref();

    this.eventEmitter.emit('system.update.status', {
      status: 'downloading',
      phase: 'Starting update process...',
      progressPercent: 10,
    });
  }

  private writeStatus(status: UpdateProgress): void {
    try {
      writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), { mode: 0o644 });
    } catch (error) {
      this.logger.error('Failed to write update status file', error);
    }
  }
}
```

#### 7.5 Create Update Worker Script

Create `build/scripts/update-worker.sh`:

```bash
#!/bin/bash
set -e

VERSION="${UPDATE_VERSION:-latest}"
STATUS_FILE="${STATUS_FILE:-/var/lib/smart-panel/update-status.json}"

update_status() {
  local status="$1"
  local phase="$2"
  local error="${3:-}"

  cat > "$STATUS_FILE" << EOF
{
  "status": "$status",
  "phase": "$phase",
  "targetVersion": "$VERSION",
  "startedAt": "$(date -Iseconds)",
  "error": "$error"
}
EOF
}

# Update status: downloading
update_status "downloading" "Downloading update..."

# Stop the service
update_status "stopping" "Stopping service..."
systemctl stop smart-panel || true

# Install the update
update_status "installing" "Installing packages..."
if [ "$VERSION" = "latest" ]; then
  npm update -g @fastybird/smart-panel
else
  npm install -g "@fastybird/smart-panel@$VERSION"
fi

# Run migrations
update_status "migrating" "Running database migrations..."
DATA_DIR="${FB_DATA_DIR:-/var/lib/smart-panel}"
# Migration commands here...

# Start the service
update_status "starting" "Starting service..."
systemctl start smart-panel

# Mark as complete
update_status "complete" "Update complete"

exit 0
```

### Phase 3: Admin UI

#### 7.6 Create Update Store

Create `apps/admin/src/modules/system/store/update.store.ts`:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

import { injectBackendClient } from '../../../common';

export const useUpdateStore = defineStore('system-update', () => {
  const currentVersion = ref<string | null>(null);
  const latestVersion = ref<string | null>(null);
  const updateAvailable = ref(false);
  const updateType = ref<'patch' | 'minor' | 'major' | null>(null);
  const lastChecked = ref<Date | null>(null);
  const status = ref<string>('idle');
  const phase = ref<string | null>(null);
  const progressPercent = ref<number | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  const isUpdating = computed(() =>
    ['downloading', 'stopping', 'installing', 'migrating', 'starting'].includes(status.value)
  );

  async function fetchStatus(app?: App): Promise<void> {
    loading.value = true;
    try {
      const client = injectBackendClient(app);
      const response = await client.GET('/api/v1/system/update/status');
      if (response.data?.data) {
        const data = response.data.data;
        currentVersion.value = data.current_version;
        latestVersion.value = data.latest_version;
        updateAvailable.value = data.update_available;
        updateType.value = data.update_type;
        lastChecked.value = data.last_checked ? new Date(data.last_checked) : null;
        status.value = data.status || 'idle';
        phase.value = data.phase;
        progressPercent.value = data.progress_percent;
        error.value = data.error;
      }
    } finally {
      loading.value = false;
    }
  }

  async function checkForUpdates(app?: App): Promise<void> {
    loading.value = true;
    try {
      const client = injectBackendClient(app);
      await client.POST('/api/v1/system/update/check');
      await fetchStatus(app);
    } finally {
      loading.value = false;
    }
  }

  async function installUpdate(app?: App, allowMajor = false): Promise<void> {
    const client = injectBackendClient(app);
    await client.POST('/api/v1/system/update/install', {
      body: { allow_major: allowMajor },
    });
    await fetchStatus(app);
  }

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    updateType,
    lastChecked,
    status,
    phase,
    progressPercent,
    error,
    loading,
    isUpdating,
    fetchStatus,
    checkForUpdates,
    installUpdate,
  };
});
```

#### 7.7 Create Update Status Component

Create `apps/admin/src/modules/system/components/system-info/update-status.vue`:

```vue
<template>
  <el-card class="mb-4">
    <template #header>
      <div class="flex justify-between items-center">
        <span class="font-600">{{ t('systemModule.headings.update.title') }}</span>
        <el-tag v-if="updateAvailable" type="warning">
          {{ t('systemModule.texts.update.available') }}
        </el-tag>
      </div>
    </template>

    <el-descriptions :column="1" border>
      <el-descriptions-item :label="t('systemModule.labels.update.currentVersion')">
        {{ currentVersion || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemModule.labels.update.latestVersion')">
        <span v-if="latestVersion">
          {{ latestVersion }}
          <el-tag v-if="updateType" size="small" :type="updateTypeColor">
            {{ updateType }}
          </el-tag>
        </span>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemModule.labels.update.lastChecked')">
        {{ lastCheckedFormatted || t('common.never') }}
      </el-descriptions-item>
    </el-descriptions>

    <div class="mt-4 flex gap-2">
      <el-button
        :loading="loading"
        :disabled="isUpdating"
        @click="onCheckForUpdates"
      >
        {{ t('systemModule.buttons.update.checkForUpdates') }}
      </el-button>
      <el-button
        v-if="updateAvailable"
        type="primary"
        :loading="isUpdating"
        @click="onInstallUpdate"
      >
        {{ t('systemModule.buttons.update.installUpdate') }}
      </el-button>
    </div>

    <!-- Update Progress -->
    <el-progress
      v-if="isUpdating"
      :percentage="progressPercent || 0"
      :status="status === 'failed' ? 'exception' : undefined"
      class="mt-4"
    />
    <el-text v-if="phase" class="block mt-2">{{ phase }}</el-text>
    <el-alert v-if="error" type="error" :title="error" class="mt-2" />
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElTag, ElProgress, ElText, ElAlert, ElMessageBox } from 'element-plus';

import { useUpdateStore } from '../../store/update.store';

const { t } = useI18n();
const updateStore = useUpdateStore();

const {
  currentVersion,
  latestVersion,
  updateAvailable,
  updateType,
  lastChecked,
  status,
  phase,
  progressPercent,
  error,
  loading,
  isUpdating,
} = storeToRefs(updateStore);

const updateTypeColor = computed(() => {
  switch (updateType.value) {
    case 'major': return 'danger';
    case 'minor': return 'warning';
    case 'patch': return 'success';
    default: return 'info';
  }
});

const lastCheckedFormatted = computed(() => {
  if (!lastChecked.value) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(lastChecked.value);
});

const onCheckForUpdates = () => updateStore.checkForUpdates();

const onInstallUpdate = async () => {
  const isMajor = updateType.value === 'major';

  try {
    await ElMessageBox.confirm(
      isMajor
        ? t('systemModule.messages.update.majorUpdateWarning', { version: latestVersion.value })
        : t('systemModule.messages.update.confirmInstall', { version: latestVersion.value }),
      t('systemModule.headings.update.confirmTitle'),
      {
        confirmButtonText: t('common.buttons.confirm'),
        cancelButtonText: t('common.buttons.cancel'),
        type: isMajor ? 'warning' : 'info',
      }
    );

    await updateStore.installUpdate(undefined, isMajor);
  } catch {
    // User cancelled
  }
};

onMounted(() => {
  updateStore.fetchStatus();
});
</script>
```

### Phase 4: CLI Enhancements

#### 7.8 Enhanced Update Command

Update `build/bin/smart-panel-service.js` update command:

```javascript
program
  .command('update')
  .description('Update Smart Panel to the latest version')
  .option('--version <version>', 'Update to a specific version')
  .option('--beta', 'Update to the latest beta version')
  .option('--check', 'Only check for updates, do not install')
  .option('--changelog', 'Show release notes for the latest version')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--allow-major', 'Allow major version updates without extra confirmation')
  .action(async (options) => {
    // ... implementation with version checking, confirmation prompts, etc.
  });
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Follow the API conventions from `/.ai-rules/API_CONVENTIONS.md`.
- Regenerate OpenAPI spec after backend changes with `pnpm run generate:openapi`.
- Start with backend changes (UpdateService, API endpoints) before admin UI.
- Use the existing SystemActionsService pattern as reference for admin UI.
- Implement in phases: 1) Backend service, 2) API endpoints, 3) CLI enhancements, 4) Admin UI.
- Test the update flow manually in a development environment before marking complete.

## 9. Sub-tasks breakdown

This large feature can be broken into smaller tasks:

1. **FEATURE-APP-UPDATES-SERVICE** - Create UpdateService for version checking
2. **FEATURE-APP-UPDATES-API** - Create REST API endpoints for update operations
3. **FEATURE-APP-UPDATES-EXECUTOR** - Create UpdateExecutorService for running updates
4. **FEATURE-APP-UPDATES-WEBSOCKET** - Add WebSocket events for update progress
5. **FEATURE-APP-UPDATES-CLI** - Enhance CLI update command
6. **FEATURE-APP-UPDATES-ADMIN-STORE** - Create admin Pinia store for updates
7. **FEATURE-APP-UPDATES-ADMIN-UI** - Create admin UI components

## 10. Dependencies

- `semver` package for version comparison (may need to add to dependencies)
- Existing npm registry API (public, no auth required)
- GitHub releases API for changelog (public, rate-limited)
- Existing systemd service infrastructure
- Existing WebSocket gateway

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Update fails mid-process | Use detached worker script that survives parent restart; write status to file |
| Network failure during update | Implement retry logic; rollback to previous state if critical failure |
| Major version breaks migrations | Warn user prominently; require explicit confirmation; document upgrade path |
| Concurrent update attempts | Use lock mechanism; reject new update requests while one is in progress |
| Service doesn't restart after update | Implement timeout and health check; provide manual recovery instructions |
| npm registry unavailable | Cache version info; provide manual update instructions via CLI |
| Permission issues on Linux | Document required permissions; run update as root via systemd |
| Update status file corruption | Use atomic writes; handle parse failures gracefully |

## 12. Future enhancements (out of scope)

- Automatic update scheduling (with user opt-in)
- Rollback to previous version
- Backup before update
- Plugin/extension individual updates
- Update channels management in admin UI
- Differential updates for faster downloads
- Multiple panel sync updates
