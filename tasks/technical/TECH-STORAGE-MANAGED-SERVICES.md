# Task: Register storage plugins as managed services

ID: TECH-STORAGE-MANAGED-SERVICES
Type: technical
Scope: backend
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to monitor and control storage backends (InfluxDB v1, InfluxDB v2) the same way as device plugins,
As a system administrator,
I want storage plugins to appear as managed services with start/stop/restart controls, health monitoring, and status visibility in the admin UI.

## 2. Context

- Device plugins (Shelly NG, Shelly V1, Home Assistant, Zigbee2MQTT) and messaging bots (Discord, WhatsApp) implement `IManagedPluginService` for centralized lifecycle management.
- Storage plugins (influx-v1, influx-v2, memory-storage) currently use a factory pattern in `StorageService` — they're initialized once during app bootstrap with no lifecycle management.
- If InfluxDB crashes or becomes unavailable after startup, there's no way to restart the connection without restarting the entire application.
- The `PluginServiceManagerService` already provides: dependency-aware startup, config change handling, REST API for start/stop/restart, CLI commands, runtime metrics (uptime, restart count, last error), and health check support.
- The admin UI already displays services registered through this system.

### Current architecture

```
StorageService (modules/storage/)
  ├── registerPluginFactory(name, factory)     ← called by each plugin during onModuleInit
  ├── onApplicationBootstrap()                 ← creates plugin instances from factories
  ├── primary: StoragePlugin | null            ← initialized once, never reconnected
  └── fallback: StoragePlugin | null           ← same

InfluxV1Plugin (plugins/influx-v1/)
  ├── influx-v1.plugin.ts                      ← registers factory with StorageService
  └── services/influx-v1.storage.ts            ← implements StoragePlugin interface
      ├── initialize()                         ← connects to InfluxDB
      ├── destroy()                            ← cleanup
      ├── isAvailable()                        ← returns this.connection !== null
      └── writePoints/query/...                ← actual I/O
```

### Target architecture

```
InfluxV1Plugin (plugins/influx-v1/)
  ├── influx-v1.plugin.ts                      ← registers factory AND managed service
  ├── services/influx-v1.service.ts            ← NEW: implements IManagedPluginService
  │   ├── start()                              ← creates & initializes InfluxV1Storage
  │   ├── stop()                               ← destroys storage, sets unavailable
  │   ├── getState()                           ← stopped | starting | started | error
  │   ├── isHealthy()                          ← pings InfluxDB
  │   └── onConfigChanged()                    ← detects host/db/auth changes → restartRequired
  └── services/influx-v1.storage.ts            ← unchanged, still implements StoragePlugin

StorageService (modules/storage/)
  ├── same factory pattern for plugin creation
  ├── onPluginStarted(pluginName)              ← NEW: reinitializes storage from factory
  └── onPluginStopped(pluginName)              ← NEW: marks storage as unavailable
```

## 3. Scope

**In scope**

- Create `InfluxV1Service` implementing `IManagedPluginService` in `plugins/influx-v1/`
- Create `InfluxV2Service` implementing `IManagedPluginService` in `plugins/influx-v2/`
- Register both services with `PluginServiceManagerService` during plugin `onModuleInit()`
- Implement health check via InfluxDB ping
- Implement `onConfigChanged()` to detect connection parameter changes
- Coordinate with `StorageService` — when managed service starts/stops, storage plugin availability updates accordingly
- Both services appear in admin UI services list with status, uptime, restart controls
- Memory storage plugin does NOT need managed service (always available, no external dependency)

**Out of scope**

- Automatic reconnection with backoff (service restart is manual or config-triggered)
- Changes to the `StoragePlugin` interface
- Changes to the memory storage plugin
- Multi-instance support (one InfluxDB connection per plugin)
- Database migration or historical data backfill after reconnection

## 4. Acceptance criteria

- [ ] `InfluxV1Service` implements `IManagedPluginService` with start/stop/getState/isHealthy/onConfigChanged
- [ ] `InfluxV2Service` implements `IManagedPluginService` with the same contract
- [ ] Both services are registered with `PluginServiceManagerService` during plugin module init
- [ ] Services appear in `GET /modules/extensions/services` API response
- [ ] `POST /modules/extensions/services/:pluginName/:serviceId/restart` successfully reconnects to InfluxDB
- [ ] `isHealthy()` pings InfluxDB and returns connection status
- [ ] `onConfigChanged()` returns `{ restartRequired: true }` when host, port, database, or auth changes
- [ ] When managed service is stopped, `StorageService` falls back to the other storage plugin
- [ ] When managed service is started, `StorageService` uses it as the configured primary/fallback
- [ ] Admin UI shows influx services with state indicators and start/stop/restart buttons (existing UI, no changes needed)
- [ ] Unit tests for service lifecycle: start → started, stop → stopped, start failure → error state
- [ ] No changes to existing `StoragePlugin` interface or memory storage plugin

## 5. Example scenarios

### Scenario: InfluxDB becomes available after initial failure

Given the backend started without InfluxDB running
And the influx-v1 service shows state "error" in the admin UI
When the administrator starts InfluxDB and clicks "Restart" on the influx-v1 service
Then the service reconnects and transitions to state "started"
And `StorageService` begins using InfluxDB as the primary storage
And writes go to both InfluxDB and the fallback storage

### Scenario: InfluxDB crashes during operation

Given the backend is running with InfluxDB as primary storage
When InfluxDB crashes
Then the health check reports unhealthy
And subsequent queries fall back to memory storage
When the administrator clicks "Restart" on the influx-v1 service
Then it reconnects to the recovered InfluxDB
And normal operation resumes

### Scenario: Config change triggers restart

Given the influx-v1 service is running
When the administrator changes the InfluxDB host in plugin config
Then `onConfigChanged()` returns `{ restartRequired: true }`
And the `PluginServiceManagerService` stops and restarts the service with new config
And the service connects to the new InfluxDB host

## 6. Technical constraints

- Follow the `ShellyNgService` pattern for state machine with start/stop lock
- Use `Intl` or standard Node.js APIs for health check (no new dependencies)
- The `StoragePlugin.initialize()` method should be called inside the managed service's `start()`, not by `StorageService` directly
- Keep the factory pattern in `StorageService` — the managed service uses the factory to create/recreate storage instances
- Services must be idempotent: calling `start()` when already started is a no-op
- Do not modify the `PluginServiceManagerService` — it's generic enough to handle storage services as-is

## 7. Implementation hints

### InfluxV1Service skeleton

```typescript
@Injectable()
export class InfluxV1Service implements IManagedPluginService {
  readonly pluginName = INFLUX_V1_PLUGIN_NAME;
  readonly serviceId = 'connection';

  private state: ServiceState = 'stopped';
  private startStopLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    return this.withLock(async () => {
      if (this.state === 'started') return;
      this.state = 'starting';

      try {
        // Tell StorageService to (re)create the influx-v1 plugin from its factory
        await this.storageService.initializePlugin(INFLUX_V1_PLUGIN_NAME);
        this.state = 'started';
      } catch (error) {
        this.state = 'error';
        throw error;
      }
    });
  }

  async stop(): Promise<void> {
    return this.withLock(async () => {
      if (this.state === 'stopped') return;
      this.state = 'stopping';

      await this.storageService.destroyPlugin(INFLUX_V1_PLUGIN_NAME);
      this.state = 'stopped';
    });
  }

  getState(): ServiceState { return this.state; }

  async isHealthy(): Promise<boolean> {
    return this.storageService.isPluginAvailable(INFLUX_V1_PLUGIN_NAME);
  }

  async onConfigChanged(): Promise<ConfigChangeResult> {
    // Compare cached vs current config for host/port/database/auth changes
    return { restartRequired: true }; // Safe default: always restart on config change
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => fn();
    this.startStopLock = this.startStopLock.then(run, run);
    return this.startStopLock as unknown as Promise<T>;
  }
}
```

### StorageService additions needed

```typescript
// New methods on StorageService:
async initializePlugin(pluginName: string): Promise<void> {
  const factory = this.pluginFactories.get(pluginName);
  if (!factory) throw new Error(`No factory for ${pluginName}`);

  const plugin = factory();
  await plugin.initialize();

  // Determine if this is primary or fallback based on config
  const config = this.getStorageConfig();
  if (config.primaryStorage === pluginName) {
    this.primary?.destroy();
    this.primary = plugin;
  } else if (config.fallbackStorage === pluginName) {
    this.fallback?.destroy();
    this.fallback = plugin;
  }
}

async destroyPlugin(pluginName: string): Promise<void> {
  const config = this.getStorageConfig();
  if (config.primaryStorage === pluginName && this.primary) {
    await this.primary.destroy();
    this.primary = null;
  } else if (config.fallbackStorage === pluginName && this.fallback) {
    await this.fallback.destroy();
    this.fallback = null;
  }
}

isPluginAvailable(pluginName: string): boolean {
  const config = this.getStorageConfig();
  if (config.primaryStorage === pluginName) return this.primary?.isAvailable() ?? false;
  if (config.fallbackStorage === pluginName) return this.fallback?.isAvailable() ?? false;
  return false;
}
```

### Plugin registration

```typescript
// In influx-v1.plugin.ts onModuleInit():
this.pluginServiceManager.register(this.influxV1Service);
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Use `ShellyNgService` as the reference implementation for the state machine pattern.
- Keep `StorageService` changes minimal — add only the methods needed for managed service coordination.
- Do NOT modify the `PluginServiceManagerService` or `IManagedPluginService` interface.
- The memory storage plugin does NOT get a managed service.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
