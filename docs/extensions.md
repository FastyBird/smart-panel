# Smart Panel Extensions

This document describes the extensions system in Smart Panel, including how extensions work, how to develop new ones, and how to integrate them into the system.

## Overview

Smart Panel uses an extensions architecture to provide modularity and extensibility. Extensions come in two types:

- **Modules** - Core functionality units (devices, dashboard, users, etc.)
- **Plugins** - Add-on functionality that extends modules (device integrations, data sources, etc.)

## Extension Categories

| Category | Can Disable? | Can Remove? | Examples |
|----------|--------------|-------------|----------|
| Core Module | No | No | devices-module, dashboard-module, users-module |
| Core Plugin | Yes | No | weather-openweathermap-plugin, devices-shelly-ng-plugin |
| Third-Party Module | Yes | Yes (future) | Custom modules installed via npm |
| Third-Party Plugin | Yes | Yes (future) | Custom plugins installed via npm |

## Architecture

### Backend Structure

Extensions are located in:
- `apps/backend/src/modules/` - Core modules
- `apps/backend/src/plugins/` - Core plugins
- `packages/` - Third-party/external extensions

Each extension typically contains:
```
my-extension/
├── controllers/       # REST API endpoints
├── dto/              # Data Transfer Objects
├── entities/         # Database entities (TypeORM)
├── models/           # Response models
├── services/         # Business logic
├── my-extension.module.ts    # NestJS module definition
├── my-extension.constants.ts # Constants and enums
└── my-extension.openapi.ts   # Swagger extra models
```

### Admin Structure

Admin extensions mirror the backend structure:
```
apps/admin/src/modules/my-module/
├── components/       # Vue components
├── composables/      # Vue composables (hooks)
├── locales/          # i18n translations
├── router/           # Vue Router configuration
├── store/            # Pinia stores
├── views/            # Page components
└── index.ts          # Module exports
```

## Developing a New Extension

### 1. Create the Backend Module/Plugin

#### For a Module

```typescript
// my-module.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';

import { MY_MODULE_NAME } from './my-module.constants';
import { MyModuleConfigModel } from './models/config.model';
import { UpdateMyModuleConfigDto } from './dto/update-config.dto';

@Module({
  imports: [
    forwardRef(() => ConfigModule),
    forwardRef(() => ExtensionsModule),
  ],
  // ... providers, controllers, exports
})
export class MyModule implements OnModuleInit {
  constructor(
    private readonly modulesMapperService: ModulesTypeMapperService,
    private readonly extensionsService: ExtensionsService,
  ) {}

  onModuleInit() {
    // Register with config mapper (required for extensions list)
    this.modulesMapperService.registerMapping<MyModuleConfigModel, UpdateMyModuleConfigDto>({
      type: MY_MODULE_NAME,
      class: MyModuleConfigModel,
      configDto: UpdateMyModuleConfigDto,
    });

    // Register metadata (for display in admin)
    this.extensionsService.registerModuleMetadata({
      type: MY_MODULE_NAME,
      name: 'My Module',
      description: 'Description of what this module does',
      author: 'Your Name',
      readme: `# My Module\n\nDocumentation here...`,
      links: {
        documentation: 'https://docs.example.com',
        repository: 'https://github.com/example/my-module',
      },
    });
  }
}
```

#### For a Plugin

```typescript
// my-plugin.plugin.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';

import { MY_PLUGIN_NAME } from './my-plugin.constants';
import { MyPluginConfigModel } from './models/config.model';
import { UpdateMyPluginConfigDto } from './dto/update-config.dto';

@Module({
  imports: [
    forwardRef(() => ConfigModule),
    forwardRef(() => ExtensionsModule),
  ],
  // ... providers, exports
})
export class MyPlugin implements OnModuleInit {
  constructor(
    private readonly pluginsMapperService: PluginsTypeMapperService,
    private readonly extensionsService: ExtensionsService,
  ) {}

  onModuleInit() {
    // Register with config mapper
    this.pluginsMapperService.registerMapping<MyPluginConfigModel, UpdateMyPluginConfigDto>({
      type: MY_PLUGIN_NAME,
      class: MyPluginConfigModel,
      configDto: UpdateMyPluginConfigDto,
    });

    // Register metadata
    this.extensionsService.registerPluginMetadata({
      type: MY_PLUGIN_NAME,
      name: 'My Plugin',
      description: 'Description of what this plugin does',
      author: 'Your Name',
      readme: `# My Plugin\n\nDocumentation here...`,
      links: {
        documentation: 'https://docs.example.com',
        repository: 'https://github.com/example/my-plugin',
      },
    });
  }
}
```

### 2. Create Config Model and DTO

Every extension needs a config model and update DTO:

```typescript
// models/config.model.ts
import { ApiSchema } from '@nestjs/swagger';
import { ModuleConfigModel } from '../../config/models/config.model';
// or for plugins:
// import { PluginConfigModel } from '../../config/models/config.model';

@ApiSchema({ name: 'MyModuleDataConfig' })
export class MyModuleConfigModel extends ModuleConfigModel {
  // Add module-specific config properties here
}
```

```typescript
// dto/update-config.dto.ts
import { ApiSchema } from '@nestjs/swagger';
import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
// or for plugins:
// import { UpdatePluginConfigDto } from '../../config/dto/config.dto';

@ApiSchema({ name: 'MyModuleUpdateConfig' })
export class UpdateMyModuleConfigDto extends UpdateModuleConfigDto {
  // Add module-specific update properties here
}
```

### 3. Register in AppModule

Add your extension to the imports in `app.module.ts`:

```typescript
@Module({
  imports: [
    // ... other modules
    MyModule,
    // or for plugins:
    MyPlugin,
  ],
})
export class AppModule {}
```

### 4. Create Admin Extension (Optional)

If your extension has a UI, create the admin module:

```typescript
// apps/admin/src/modules/my-module/index.ts
import type { App } from 'vue';
import type { Router } from 'vue-router';

import { registerRoutes } from './router';
import { registerStore } from './store';

export function register(app: App, router: Router): void {
  registerStore(app);
  registerRoutes(router);
}

export * from './my-module.constants';
```

## Extension Metadata

Extensions can register rich metadata for display in the admin UI:

```typescript
interface ExtensionMetadata {
  type: string;           // Unique identifier (e.g., 'my-module')
  name: string;           // Display name
  description?: string;   // Short description
  version?: string;       // Semantic version
  author?: string;        // Author name
  readme?: string;        // Full markdown documentation
  docs?: string;          // Additional documentation (markdown)
  links?: {
    documentation?: string;    // Docs URL
    devDocumentation?: string; // Developer docs URL
    bugsTracking?: string;     // Issue tracker URL
    repository?: string;       // Source code URL
    homepage?: string;         // Project homepage
  };
}
```

## Remote Access Providers

A plugin can offer a way to reach the installation from outside the LAN — Tailscale is the built-in example
— by registering with the `remote-access` module instead of inventing its own URL/status surface. See
[Remote Access Architecture](./remote-access-architecture.md) for the full contract.

### Backend: Register an `IRemoteAccessProvider`

Implement `IRemoteAccessProvider` and register it with `RemoteAccessProviderRegistryService` in your
plugin's own `onModuleInit`, exactly like the config mapper and extension metadata above:

```typescript
// services/my-provider.service.ts
import { Injectable } from '@nestjs/common';
import {
  IRemoteAccessProvider,
  RemoteAccessProviderCapabilities,
  RemoteAccessProviderKind,
  RemoteAccessProviderStatus,
} from '../../../modules/remote-access/platforms/remote-access-provider.platform';

@Injectable()
export class MyProviderService implements IRemoteAccessProvider {
  readonly type = 'my-remote-access-plugin'; // matches this plugin's own IPlugin.type
  readonly kind: RemoteAccessProviderKind = 'tunnel'; // 'mesh' | 'tunnel' | 'vpn' | 'external'
  readonly capabilities: RemoteAccessProviderCapabilities = {
    https: true,
    publicUrl: true,
    identityHeaders: false,
    ssh: false,
  };

  async getStatus(): Promise<RemoteAccessProviderStatus> {
    // state, endpoints, proxyAddresses, advisories, details, updatedAt — never an
    // auth URL, QR code or key material; those stay in this plugin's own REST endpoints.
    return { /* ... */ };
  }
}
```

```typescript
// my-plugin.plugin.ts
onModuleInit() {
  // ... registerMapping(), registerPluginMetadata() as above ...

  this.providerRegistry.register(this.providerService);
}
```

The `remote-access` module never shells out and never knows a provider's binary; it only calls `getStatus()`
on demand and folds a `connected` provider's endpoints into its URL registry. If the connection needs a
loopback proxy trusted platform-wide while active (a local reverse tunnel, for example), report those
addresses in `proxyAddresses` — the module contributes them to the shared trusted-proxy registry only while
the provider is `connected`.

`proxyAddresses` carries the same trust weight as an administrator-entered `trusted_proxies` entry, so it is
held to the same contract: only a loopback or single-host address, never a CIDR range — a provider is
reporting the exact addresses its own connection proxies from, not delegating trust to a network. Every
entry is validated the same way `trusted_proxies` is; a malformed value or a range broader than a single
host is dropped rather than trusted, with a warning logged so a misbehaving provider is visible instead of
silently widening the trust boundary.

### Admin: Register a Provider Element

The Remote access overview finds a connected provider's card the same way `useChannelsPlugin.ts` finds
device plugin elements: by the owning plugin's own `IPlugin.type` (matching `provider.type` from the status
payload), then a `provider` element on that plugin scoped to the `remote-access-module`:

```typescript
// apps/admin/src/plugins/my-remote-access-plugin/my-remote-access-plugin.plugin.ts
import { injectPluginsManager } from '../../common';
import { REMOTE_ACCESS_MODULE_NAME, REMOTE_ACCESS_MODULE_PROVIDER_TYPE } from '../../modules/remote-access';

export default {
  install: (app, options) => {
    const pluginsManager = injectPluginsManager(app);

    pluginsManager.addPlugin(myRemoteAccessPluginKey, {
      type: 'my-remote-access-plugin', // must equal the backend provider's own `type`
      // ... source, name, description, links ...
      elements: [
        {
          type: REMOTE_ACCESS_MODULE_PROVIDER_TYPE, // shared marker: 'provider'
          modules: [REMOTE_ACCESS_MODULE_NAME],
          components: {
            providerCard: MyProviderCard, // rendered on the Remote access overview
            providerSetup: MyProviderSetup, // rendered only by this plugin's own setup views
          },
        },
        // ... a CONFIG_MODULE_PLUGIN_TYPE element for the plugin's own settings form, as usual ...
      ],
      modules: [REMOTE_ACCESS_MODULE_NAME],
    });
  },
};
```

## Notifications

The `notifications` module gives the administrator one place to see what needs attention (a
lost connection, a failed update, a security alert) and can forward those notifications to
external channels such as Discord or a generic webhook. See [Notifications](./notifications.md)
for the full guide: the lifecycle table, the emitter rules, the REST and websocket surface,
and how to write a channel.

### Backend: Emit a notification

`NotificationsModule` is `@Global()` and exports `NotificationsService`, so any module or
plugin injects it directly - no `imports` entry needed, exactly like `ExtensionsModule`
exports `ExtensionActionRegistryService`:

```typescript
// services/my-service.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../../modules/notifications/services/notifications.service';
import { NotificationActionType, NotificationKind, NotificationSeverity } from '../../../modules/notifications/notifications.constants';

@Injectable()
export class MyService {
  constructor(private readonly notifications: NotificationsService) {}

  async onConnectionLost(reason: string): Promise<void> {
    // kind/severity/action type are enums, not string literals - `'issue'` on its own is not
    // assignable to `NotificationKind`, so use the real enum members here.
    await this.notifications.notify({
      source: MY_PLUGIN_NAME,
      kind: NotificationKind.ISSUE,
      key: 'connection',
      severity: NotificationSeverity.ERROR,
      title: 'Connection lost',
      message: reason,
      actions: [{ type: NotificationActionType.SERVICE, label: 'Restart', extension_kind: 'plugin', extension_type: MY_PLUGIN_NAME, service_id: 'my-service', operation: 'restart', primary: true }],
    });
  }

  async onConnectionRestored(): Promise<void> {
    await this.notifications.resolve(MY_PLUGIN_NAME, 'connection');
  }
}
```

### Backend: Register a notification channel

A channel plugin forwards notifications somewhere else. Extend `BaseNotificationChannel` and
register with `NotificationChannelRegistryService` in your plugin's own `onModuleInit`, the
same pattern as a remote access provider above:

```typescript
// services/my-channel.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BaseNotificationChannel } from '../../../modules/notifications/platforms/notification-channel.platform';
import { NotificationEntity } from '../../../modules/notifications/entities/notifications.entity';

@Injectable()
export class MyChannelService extends BaseNotificationChannel {
  constructor(configService: ConfigService) {
    super(configService, 'notifications-my-channel-plugin');
  }

  protected hasRequiredConfig(config: PluginConfigModel): boolean {
    return Boolean((config as unknown as { webhook_url?: string }).webhook_url);
  }

  async send(notification: NotificationEntity, signal: AbortSignal): Promise<void> {
    await this.fetchWithSignal('https://example.com/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: this.formatText(notification) }),
    }, signal);
  }
}
```

```typescript
// my-channel.plugin.ts
onModuleInit() {
  // ... registerMapping(), registerPluginMetadata() as above ...

  this.channelRegistry.register(this.channelService); // NotificationChannelRegistryService
}
```

An extension package built against `@fastybird/smart-panel-extension-sdk`, outside the
backend's own TypeScript program, types against the SDK's plain mirrors of these contracts
(`CreateNotificationInput`, `NotificationChannel`, `ChannelDeliveryError`, ...) instead of the
backend's own classes - see `packages/extension-sdk/src/notification.types.ts`.
`packages/example-extension/src/example.service.ts` shows the other path: it depends on
`@fastybird/smart-panel-backend` directly and calls the real `NotificationsService`, the way
a plugin compiled as part of the backend itself would.

## Adding automation cards

An automation is a graph of cards ("node types"): triggers start a run, conditions choose between their `yes`
and `no` outputs, actions do the work and take `done` or `error`. Any extension can add triggers, conditions and
actions; flow blocks (Delay, Wait until, Any, All) are run by the engine itself and are not open to extensions.
See [ADR 0003](./adr/0003-automations-spike-and-decisions.md) for the decisions behind the rules below.

### The contract

The contract is published by `@fastybird/smart-panel-extension-sdk` (`packages/extension-sdk/src/automation.types.ts`),
so a card is typed without importing anything from the backend:

| Export | What it is |
|--------|------------|
| `AutomationTriggerNodeType`, `AutomationConditionNodeType`, `AutomationActionNodeType` | The card of each kind; `AutomationExtensionNodeType` is any of them. Generic over the configuration type. |
| `AutomationNodeTypeBase` | What every card declares: `type`, `kind`, `name`, `description`, `validateConfig`, and optionally `ports`, `configSchema`, `references`, `owner`, `unavailableReason`. |
| `AutomationRunContext`, `AutomationTriggerContext`, `AutomationRunTrigger`, `AutomationTriggerData` | What the engine hands to a card. |
| `AutomationConditionResult`, `AutomationActionResult`, `AutomationActionCommand` | What a card answers; what an action declares to the safety policy. |
| `AutomationNodeConfigProblem`, `AutomationNodeReference`, `AutomationNodeTypeOwner`, `AutomationNodePorts` | Helper shapes. |
| `AutomationNodeTypeRegistrar` | The part of the backend registry an extension calls (`register()`). |
| `defineAutomationTrigger` / `defineAutomationCondition` / `defineAutomationAction` | Type a card and keep its configuration type. |
| `checkAutomationConfigKeys`, `isAutomationNodeTypeId` | Refuse configuration keys a card does not declare; check an identifier the way the registry does. |
| `AUTOMATION_NODE_DEFAULT_PORTS`, `AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS`, `AUTOMATION_NODE_MAX_TIMEOUT_SECONDS`, `AUTOMATION_NODE_TYPE_MAX_LENGTH` | The limits and defaults the engine uses. |

These are plain mirrors of the backend's own contract (`apps/backend/src/modules/automations/graph/node-type.ts`),
which cards compiled into the backend keep using. A backend test
(`apps/backend/src/modules/automations/graph/node-type.sdk-contract.spec.ts`) fails to compile as soon as the two
differ, so a change to the contract has to be made in both places.

### Lifecycle

1. **Registration.** Import `AutomationsModule` into your module (its registry is not global, unlike the extensions,
   config and notifications services), inject `AutomationNodeTypeRegistryService` - both from
   `@fastybird/smart-panel-backend` - and call `register()` for every card in `onModuleInit`. A card the engine could
   not use - an identifier that is not lower-case words joined by `.`, `_` or `-`, a missing validator, a trigger
   with input ports - is refused with an error, so it fails at start. Prefix the identifier with your extension
   type; registering an identifier that exists replaces the card.
2. **Owner gating.** Set `owner: { kind: 'plugin', type: '<your extension type>' }` (or `kind: 'module'`). The card
   stays registered when the extension is disabled, but the catalogue (`GET /api/v1/modules/automations/node-types`)
   leaves it out, the engine does not arm it as a trigger and refuses to execute it as a condition or an action (an
   action then takes `error`, traced as refused). Enabling the extension again re-arms the automations that use it.
3. **Validation.** `validateConfig(config)` is called whenever a graph is saved or validated, with whatever was
   submitted, and returns `{ field, reason }` problems; an empty list accepts the configuration. Check every field
   the `configSchema` declares, with its type: the schema only shapes the admin form, nothing enforces it. A reason is shown to
   the user, so it describes the rule and never repeats the value. An invalid configuration stops the save of an
   enabled automation; a disabled draft may hold it. `references(config)` lists the devices, scenes or other
   automations the node depends on, so it is invalidated when one of them is removed.
4. **Safety policy.** An action lists what it does to the home in `commands(config)`:
   `{ kind: 'property_write', propertyId, value, field }` for every device value it writes and
   `{ kind: 'scene_run', sceneId, field }` for every scene it runs. The same policy as for the built-in cards judges
   that list when the graph is saved - unlocking, disarming or opening is an error that stops even a draft - and
   again before every execution, where a refusal takes `error` without calling `execute`. `commands()` is called
   with configurations that were not validated, so it skips what it can not read and never throws. An action that
   acts on the home and declares nothing is a bug in that card.
5. **Running.** A trigger's `subscribe(config, fire, context)` is called when an enabled, valid automation is armed;
   it starts watching and returns the function that stops watching, which the engine calls when the automation is
   disabled, changed or removed. Do not call `fire` from inside `subscribe`. A condition's `evaluate(config, context)`
   and an action's `execute(config, context)` get the run context: `automationId`, `runId`, `nodeId`, the `trigger`
   that started the run and an `AbortSignal` that is aborted when the run is cancelled or the node runs into its
   timeout (30 s unless `timeoutSeconds` says otherwise, at most 300 s). Stop early when it is aborted. A condition
   that throws or times out is `no`; an action that throws or times out takes `error`. Branches of one run execute
   in parallel and in no guaranteed order.

### Example

`packages/example-extension/src/automation-cards.ts` adds a trigger, a condition and an action around in-memory
"signals". In short:

```typescript
// automation-cards.ts - imports nothing from the backend
import { checkAutomationConfigKeys, defineAutomationAction } from '@fastybird/smart-panel-extension-sdk';

export const createPulseAction = (bridge: AcmeBridge) =>
  defineAutomationAction<{ property_id: string; value: boolean }>({
    type: 'acme.property.pulse',
    kind: 'action',
    name: 'Pulse a value',
    description: 'Writes a value through the Acme bridge.',
    owner: { kind: 'plugin', type: ACME_PLUGIN_NAME },
    configSchema: {
      type: 'object',
      properties: { property_id: { type: 'string', title: 'Property' }, value: { type: 'boolean', title: 'Value' } },
      required: ['property_id', 'value'],
      additionalProperties: false,
    },
    validateConfig: (config) => [
      ...checkAutomationConfigKeys(config, ['property_id', 'value']),
      ...(typeof config.property_id === 'string' ? [] : [{ field: 'property_id', reason: 'A property is needed.' }]),
      ...(typeof config.value === 'boolean' ? [] : [{ field: 'value', reason: 'The value must be yes or no.' }]),
    ],
    references: (config) => (typeof config.property_id === 'string' ? [{ kind: 'property', id: config.property_id }] : []),
    // What the safety policy judges; never throws
    commands: (config) =>
      typeof config.property_id === 'string'
        ? [{ kind: 'property_write', propertyId: config.property_id, value: config.value, field: 'value' }]
        : [],
    execute: async (config, context) => {
      if (context.signal.aborted) return { success: false, reason: 'The run was cancelled.' };

      await bridge.write(config.property_id, config.value, { signal: context.signal });

      return { success: true };
    },
  });
```

```typescript
// acme.plugin.ts
import { AutomationNodeTypeRegistryService, AutomationsModule } from '@fastybird/smart-panel-backend';

@Module({ imports: [AutomationsModule], providers: [AcmeBridge] })
export class AcmePlugin implements OnModuleInit {
  constructor(
    private readonly automationNodeTypes: AutomationNodeTypeRegistryService,
    private readonly bridge: AcmeBridge,
  ) {}

  onModuleInit() {
    // ... registerMapping(), registerPluginMetadata() as above ...
    this.automationNodeTypes.register(createPulseAction(this.bridge));
  }
}
```

### Admin

A card of an extension needs nothing in the admin: the palette lists everything the catalogue offers, and a card
without an admin element is edited with the generic form, built from its `configSchema`. `string`, `number`,
`integer` (with `minimum` / `maximum`), `boolean`, `enum` and arrays of those get their own field, labelled by
`title` and explained by `description`, with `required` marking a field; anything else, or a card without a schema,
is edited as JSON. The backend validates what is saved either way. An admin plugin can bring its own form, card
summary and Zod schema for a card with an element of the automations module (`automationNodeForm`,
`automationNodeCard`, `automationNodeConfigSchema`), the way `spaces-home-control` does.

### Testing

Cards are plain objects, so they can be unit-tested without the backend - see
`packages/example-extension/test/automation-cards.test.ts`. The backend runs SDK-typed cards through its registry,
catalogue, save check, engine and safety policy in
`apps/backend/src/modules/automations/services/extension-node-types.spec.ts`.

## Third-Party Extensions

### Creating a Standalone Package

For extensions distributed via npm, create a package in `packages/`:

```
packages/my-extension/
├── src/
│   ├── index.ts              # Main exports
│   ├── my-extension.plugin.ts
│   ├── dto/
│   ├── models/
│   └── services/
├── package.json
├── tsconfig.json
└── README.md
```

Your `package.json` should include:
```json
{
  "name": "@fastybird/smart-panel-my-extension",
  "peerDependencies": {
    "@fastybird/smart-panel-backend": "^1.0.0"
  }
}
```

Import from the backend's public API:
```typescript
import {
  ExtensionsModule,
  ExtensionsService,
  ConfigModule,
  PluginsTypeMapperService,
  PluginConfigModel,
  UpdatePluginConfigDto,
} from '@fastybird/smart-panel-backend';
```

### Installing Third-Party Extensions

```bash
pnpm add @vendor/smart-panel-extension
```

Then register in `app.module.ts`:
```typescript
import { MyExtension } from '@vendor/smart-panel-extension';

@Module({
  imports: [
    // ... core modules
    MyExtension,
  ],
})
export class AppModule {}
```

## Core Modules Protection

Core modules listed in `NON_TOGGLEABLE_MODULES` cannot be disabled:

- auth-module
- config-module
- dashboard-module
- devices-module
- displays-module
- extensions-module
- mdns-module
- system-module
- users-module
- weather-module

These are essential for the application to function and are always enabled.

## Best Practices

1. **Naming Convention**: Use `{name}-module` for modules and `{name}-plugin` for plugins
2. **Always Register Metadata**: Register with both the mapper service and extensions service
3. **Use forwardRef**: When importing ConfigModule or ExtensionsModule to avoid circular dependencies
4. **Provide Documentation**: Include a meaningful README in your metadata
5. **Follow API Conventions**: See `.ai-rules/API_CONVENTIONS.md` for REST API guidelines
6. **Add Tests**: Include unit tests for services and controllers
7. **Regenerate OpenAPI**: Run `pnpm run generate:openapi` after adding new endpoints

## API Endpoints

Extensions are accessible via:

- `GET /api/modules/extensions/extensions` - List all extensions
- `GET /api/modules/extensions/extensions/modules` - List modules only
- `GET /api/modules/extensions/extensions/plugins` - List plugins only
- `GET /api/modules/extensions/extensions/{type}` - Get specific extension
- `PATCH /api/modules/extensions/extensions/{type}` - Update extension (enable/disable)

## See Also

- [API Conventions](../.ai-rules/API_CONVENTIONS.md)
- [Development Guidelines](../.ai-rules/GUIDELINES.md)
- [Notifications](./notifications.md)
- [Example Extension](../packages/example-extension/)
