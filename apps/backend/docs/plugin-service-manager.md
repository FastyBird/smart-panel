# Plugin Service Manager Architecture

## Overview

The Plugin Service Manager provides centralized lifecycle management for plugin services in the backend. It eliminates duplicate enabled/disabled checks across plugins and provides a single source of truth for service state management.

## Components

### IManagedPluginService Interface

Located at: `src/modules/extensions/services/managed-plugin-service.interface.ts`

Services implementing this interface can be managed by the PluginServiceManagerService:

```typescript
interface IManagedPluginService {
  readonly pluginName: string;    // Plugin name (e.g., 'devices-shelly-v1')
  readonly serviceId: string;     // Service identifier (e.g., 'discovery')

  start(): Promise<void>;         // Called when plugin is enabled
  stop(): Promise<void>;          // Called when plugin is disabled or app shuts down
  getState(): ServiceState;       // Current state: 'stopped' | 'starting' | 'started' | 'stopping' | 'error'

  // Optional
  getPriority?(): number;         // Startup ordering (lower = first)
  getDependencies?(): string[];   // Dependencies on other services
  isHealthy?(): Promise<boolean>; // Health check
  onConfigChanged?(): Promise<void>; // Config change notification
}
```

### PluginServiceManagerService

Located at: `src/modules/extensions/services/plugin-service-manager.service.ts`

The manager handles:
- Service registration during `onModuleInit`
- Automatic startup during `onApplicationBootstrap` (respects CLI mode)
- Config-based enable/disable via `CONFIG_UPDATED` events
- Graceful shutdown during `onModuleDestroy`
- Service status reporting

## Usage

### Registering a Service

In your plugin module's `onModuleInit`:

```typescript
@Module({
  imports: [ExtensionsModule, ...],
  providers: [MyService],
})
export class MyPlugin {
  constructor(
    private readonly myService: MyService,
    private readonly extensionsService: ExtensionsService,
    private readonly pluginServiceManager: PluginServiceManagerService,
  ) {}

  onModuleInit() {
    // Other registrations...

    // Register plugin metadata for extension discovery
    this.extensionsService.registerPluginMetadata({
      type: 'my-plugin',
      name: 'My Plugin',
      description: 'Description of my plugin',
      author: 'Author',
    });

    // Register service with the manager
    this.pluginServiceManager.register(this.myService);
  }
}
```

### Implementing a Managed Service

```typescript
@Injectable()
export class MyService implements IManagedPluginService {
  readonly pluginName = 'my-plugin';
  readonly serviceId = 'main';

  private state: ServiceState = 'stopped';

  async start(): Promise<void> {
    if (this.state !== 'stopped') return;

    this.state = 'starting';
    // Start logic here (NO enabled checks needed!)
    this.state = 'started';
  }

  async stop(): Promise<void> {
    if (this.state !== 'started') return;

    this.state = 'stopping';
    // Stop logic here
    this.state = 'stopped';
  }

  getState(): ServiceState {
    return this.state;
  }

  async onConfigChanged(): Promise<void> {
    // Clear cached config
    this.cachedConfig = null;
  }
}
```

## Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────────┘

1. NestJS Module Initialization (onModuleInit)
   ├─ Plugins register services with PluginServiceManagerService
   └─ Manager stores registrations in Map<key, ServiceRegistration>

2. Application Bootstrap (onApplicationBootstrap)
   ├─ Manager checks CLI mode (FB_CLI env var)
   ├─ If CLI mode: skip service startup
   └─ Otherwise: for each registered service
       ├─ Check if plugin is enabled via ConfigService
       └─ If enabled: call service.start()

3. Configuration Update (CONFIG_UPDATED event)
   └─ For each registered service:
       ├─ If plugin enabled AND service stopped → start service
       ├─ If plugin disabled AND service started → stop service
       └─ If plugin enabled AND service started → call onConfigChanged()

4. Application Shutdown (onModuleDestroy)
   └─ Stop all running services in reverse priority order
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Single source of truth** | One place checks `enabled` state |
| **Consistent patterns** | All plugins follow the same lifecycle |
| **Centralized CLI handling** | Check once in manager |
| **Observability** | `getStatus()` gives visibility into all services |
| **Simplified plugin code** | Services focus on core logic only |
| **Graceful shutdown** | Controlled shutdown order |

## Migrated Plugins

- `devices-shelly-v1` - ShellyV1Service
- `devices-shelly-ng` - ShellyNgService
- `devices-home-assistant` - HomeAssistantWsService
- `logger-rotating-file` - FileLoggerService

## API

### Service Status

Get status of all managed services:

```typescript
const statuses = await pluginServiceManager.getStatus();
// Returns: ServiceStatus[]
// {
//   pluginName: string;
//   serviceId: string;
//   state: ServiceState;
//   enabled: boolean;
//   healthy?: boolean;
// }
```

### Manual Restart

Restart a specific service:

```typescript
await pluginServiceManager.restartService('devices-shelly-v1', 'discovery');
```

### Check Registration

```typescript
const isRegistered = pluginServiceManager.isRegistered('devices-shelly-v1', 'discovery');
const allServices = pluginServiceManager.getRegisteredServices();
```
