# Managed Extension Service Manager

## Overview

`ManagedServiceManagerService` centralizes the lifecycle of independently restartable backend services owned by either a
module or a plugin. It is the source of truth for startup ordering, configuration-driven desired state, manual controls,
health status, graceful shutdown, and the Extensions → Services inventory.

The legacy filename is retained for existing documentation links. The implementation and public terminology are generic:
managed *extension* services, not plugin-only services.

## Contract

The contract is defined in `src/modules/extensions/services/managed-extension-service.interface.ts`:

```typescript
interface ManagedServiceOwner {
	kind: 'module' | 'plugin';
	type: string;
}

interface IManagedExtensionService {
	readonly owner: ManagedServiceOwner;
	readonly serviceId: string;
	readonly activationPolicy?: 'owner-enabled' | 'always';

	start(): Promise<void>;
	stop(): Promise<void>;
	getState(): ServiceState;

	getPriority?(): number;
	getDependencies?(): string[];
	isHealthy?(): Promise<boolean>;
	onConfigChanged?(): Promise<void | ConfigChangeResult>;
}
```

The authoritative service key is `<owner-kind>:<owner-type>:<service-id>`. Dependencies must use the same key.

`owner-enabled` is the default activation policy. The manager starts and stops those services according to the owner
configuration's `enabled` value. `always` services start even while their owner is disabled; use this only when a
runtime must remain available for discovery or setup.

## Registration

Register a service from the owning module or plugin during `onModuleInit`:

```typescript
@Injectable()
export class MyService implements IManagedExtensionService {
	readonly owner = { kind: 'plugin', type: 'my-plugin' } as const;
	readonly serviceId = 'connector';

	async start(): Promise<void> {
		// idempotent start logic
	}

	async stop(): Promise<void> {
		// idempotent stop logic
	}

	getState(): ServiceState {
		return this.state;
	}
}

// In the owner module/plugin
this.managedServiceManager.register(this.myService);
```

Services should have a persistent connection, server, external resource, hardware poller, discovery browser, or
business heartbeat with a meaningful independent start/stop boundary. Caches, handlers, one-shot loaders, and child
adapters controlled by a parent managed service do not belong in the inventory.

## Lifecycle

1. Owners register services during Nest module initialization.
2. On application bootstrap, the manager skips runtime startup in CLI mode and otherwise starts services whose desired
   state is `started`, respecting priority and dependencies.
3. On matching module or plugin configuration events, it re-evaluates desired state. Enabled running services receive
   `onConfigChanged`; a result requiring restart is restarted safely.
4. On shutdown and factory reset, started services stop in reverse priority order.

The manager records state, desired state, health, timestamps, start count, uptime, and the last error. Health checks
must use current runtime state or a bounded probe; services-list requests must not trigger unbounded network calls.

## Administration API

The extensions API exposes module and plugin services using owner-specific routes:

```text
GET  /modules/extensions/services
GET  /modules/extensions/services/:extensionKind/:extensionType/:serviceId
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/start
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/stop
POST /modules/extensions/services/:extensionKind/:extensionType/:serviceId/restart
```

Each status includes `extension_kind`, `extension_type`, `service_id`, `activation_policy`, `state`, `desired_state`,
and owner configuration/health/runtime fields. The admin UI groups these records by Modules and Plugins and identifies
always-active services that can run while their owner is disabled.
