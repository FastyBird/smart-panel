<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Extensions SDK

> 🧩 The official Software Development Kit for creating **extensions** (modules & plugins) for the [FastyBird Smart Panel](https://github.com/FastyBird/smart-panel) platform.

This SDK defines the **manifest structure**, **type contracts**, and **validation helpers** that allow external packages to integrate seamlessly with the Smart Panel backend.

---

## 📦 What is an Extension?

An **Extension** is an installable NPM package that adds new features or integrations to the Smart Panel ecosystem.
Extensions can be of two types:

- **`module`** — integrates into the core API directly (e.g., `/api/devices` or `/api/weather`).
- **`plugin`** — lives under `/api/plugins/...` and usually provides optional or third-party functionality.

Extensions are discovered automatically at runtime by the backend through the manifest defined in their `package.json`.

---

## 🧠 Key Features

- 💡 **Unified manifest** structure under `fastybird.smartPanel`
- 🧩 **Supports both CJS and ESM** module formats
- 🧰 **Type-safe** definitions for manifests and discovery results
- 🧪 **Runtime validation** via small helper functions
- 🔗 **Used by the backend discovery system** to dynamically mount routes

---

## 🚀 Installation

From within the Smart Panel monorepo or any compatible project:

```bash
pnpm add @fastybird/smart-panel-extension-sdk
# or
npm install @fastybird/smart-panel-extension-sdk
```

This package is a **runtime + type dependency** — extensions use it to type their manifest and, optionally, to validate it.

---

## 🧩 Defining an Extension

Every extension is an NPM package that includes a special manifest field in its `package.json`:

```jsonc
{
  "name": "@fastybird/example-extension",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "fastybird": {
    "smartPanel": {
      "kind": "plugin",                    // "module" | "plugin"
      "routePrefix": "example-extension",  // Mounted as /api/plugins/example-extension
      "moduleExport": "ExampleExtensionModule", // Named export from entry file
      "sdkVersion": "^0.1.0",
      "displayName": "Example Extension",
      "description": "Adds demonstration endpoints for Smart Panel."
    }
  }
}
```

---

## 🧱 Example Extension

A minimal working example:

```ts
// src/index.ts
import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class ExampleController {
  @Get('status')
  getStatus() {
    return { ok: true, time: new Date().toISOString() };
  }
}

@Module({
  controllers: [ExampleController],
})
export class ExampleExtensionModule {}
```

After building and installing, the backend automatically mounts it at:

```
GET /api/plugins/example-extension/status
```

---

## 🧾 SDK Types

```ts
import type {
  SmartPanelExtensionManifest,
  DiscoveredExtension,
  ExtensionKind,
} from '@fastybird/smart-panel-extension-sdk';
```

### `ExtensionKind`

```ts
type ExtensionKind = 'module' | 'plugin';
```

### `SmartPanelExtensionManifest`

Describes the metadata that must appear in `package.json` under `fastybird.smartPanel`.

```ts
interface SmartPanelExtensionManifest {
  kind: ExtensionKind;
  routePrefix: string;
  moduleExport: string;
  sdkVersion?: string;
  displayName?: string;
  description?: string;
}
```

### `DiscoveredExtension`

Returned by the backend discovery process once an extension is successfully loaded.

```ts
interface DiscoveredExtension {
  pkgName: string;      // e.g. "@fastybird/extension-devices-acme"
  routePrefix: string;  // sanitized route
  moduleClass: unknown; // Nest module class
  kind: ExtensionKind;
  displayName?: string;
  description?: string;
}
```

---

## 🔍 Runtime Validation Helpers

The SDK provides small utility functions to make runtime checking safe and easy.

```ts
import {
  isSmartPanelExtensionManifest,
  normalizeRoutePrefix,
} from '@fastybird/smart-panel-extension-sdk';

const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = pkgJson?.fastybird?.smartPanel;

if (isSmartPanelExtensionManifest(manifest)) {
  console.log('Valid Smart Panel extension manifest ✅');
} else {
  console.warn('Invalid or missing Smart Panel manifest ❌');
}

// Normalize route prefix (strip leading/trailing slashes)
const route = normalizeRoutePrefix(manifest.routePrefix); // "devices/acme"
```

---

## Notifications

The backend's notifications module gives the administrator one place to see what needs
attention (a lost connection, a failed update, a security alert) and can forward those
notifications to external channels such as Discord or a generic webhook. See
`docs/notifications.md` in the repository root for the full developer guide: the lifecycle
table, the emitter rules, the REST and websocket surface, and how to write a channel.

This SDK exports plain mirrors of that contract, for extension packages built outside the
backend's own TypeScript program: `NotificationKind`, `NotificationSeverity`,
`NotificationActionType`, `NotificationAction`, `CreateNotificationInput`, `Notification`,
`NotificationChannel` and `ChannelDeliveryError` (see `src/notification.types.ts`). A plugin
compiled as part of the backend itself (`apps/backend/src/plugins/**`) keeps using the real
`NotificationsService` and `INotificationChannel` from `apps/backend/src/modules/notifications/`.

### Emitting a notification

`NotificationsModule` is global, so a backend-compiled plugin injects `NotificationsService`
with no `imports` entry needed and calls it directly, using the real `NotificationKind` /
`NotificationSeverity` / `NotificationActionType` enums re-exported from
`@fastybird/smart-panel-backend` (a string literal like `'issue'` is not assignable to those
enum-typed fields) - see `packages/example-extension/src/example.service.ts` for that path.
The snippet below is for the other case: an extension with no dependency on the backend,
typed purely against the SDK's plain `CreateNotificationInput`:

```ts
import type { CreateNotificationInput } from '@fastybird/smart-panel-extension-sdk';

const input: CreateNotificationInput = {
  source: 'my-plugin', // this extension's own type
  kind: 'issue',
  key: 'connection', // required for an issue; aggregates repeats of the same condition
  severity: 'error',
  title: 'Connection lost',
  message: 'The websocket connection was refused: 401 Unauthorized.',
  actions: [
    {
      type: 'service',
      label: 'Restart',
      extension_kind: 'plugin',
      extension_type: 'my-plugin',
      service_id: 'my-service',
      operation: 'restart',
      primary: true,
    },
  ],
};

await notificationsService.notify(input);
```

Raise an issue when a condition starts and resolve it
(`await notificationsService.resolve(source, key)`) when it clears - never on every retry
tick. Call `await notificationsService.resolveAll(source)` when your service stops, so
disabling the plugin clears its open issues. Never put secrets in `title`, `message` or
`data`; pass operational error text through the notifications module's `sanitizeErrorMessage()`
first.

### Writing a channel

Implement `NotificationChannel` and register it with the backend's
`NotificationChannelRegistryService` in your plugin's own `onModuleInit`:

```ts
import type {
  ChannelDeliveryError,
  Notification,
  NotificationChannel,
  NotificationSeverity,
} from '@fastybird/smart-panel-extension-sdk';

class MyChannel implements NotificationChannel {
  getType(): string {
    return 'notifications-my-channel-plugin';
  }

  async isConfigured(): Promise<boolean> {
    // read this plugin's own config through ConfigService.getPluginConfig()
    return true;
  }

  async getMinSeverity(): Promise<NotificationSeverity> {
    return 'warning';
  }

  async send(notification: Notification, signal: AbortSignal): Promise<void> {
    // fetch(url, { signal, redirect: 'error', ... }); throw a ChannelDeliveryError with
    // retryable: true only for a connection failure or an HTTP 429/5xx response
  }
}
```

See `docs/notifications.md` for the dispatcher's per-attempt timeout and retry policy, the
`send-test` action every channel should register, and the HTTPS rules (the generic webhook
channel is the one documented exception, for trusted-network targets over plain `http:`).

---

## ⚙️ Building & Publishing

Extensions should be built to either **CJS** or **ESM** format — both are supported by the backend discovery system.

### Example build setup

`tsconfig.json`
```json
{
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "module": "ES2022",   // or "CommonJS"
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`package.json`
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist",
    "prepublishOnly": "npm run clean && npm run build"
  }
}
```

---

## 🧩 For Backend Integrators

The backend uses this SDK during discovery:

```ts
import {
  SmartPanelExtensionManifest,
  DiscoveredExtension,
  isSmartPanelExtensionManifest,
  normalizeRoutePrefix,
} from '@fastybird/smart-panel-extension-sdk';

// used in discoverExtensions()
```

It scans installed NPM packages, validates the manifest, loads the entry file, and dynamically mounts the exported Nest module at runtime.

---

## 🧪 Compatibility

| Backend Runtime | Supported Extension Types | Loader Used      |
|-----------------|---------------------------|------------------|
| CommonJS        | CJS & ESM                 | `require()` + native `import()` shim |
| ES Module       | ESM only (recommended)    | native `import()` |

> The backend automatically handles both formats; you just need to build your extension.

---

## 🪄 Architecture Overview

```text
 ┌────────────────────────────────────────────┐
 │            Smart Panel Backend             │
 │                                            │
 │  ┌───────────────┐   ┌─────────────────┐   │
 │  │  Discovery    │──▶│  Extension SDK  │   │
 │  └───────────────┘   └─────────────────┘   │
 │          │                  ▲              │
 │          ▼                  │              │
 │   Scans node_modules        │              │
 │  for fastybird.smartPanel   │              │
 │          │                  │              │
 │          ▼                  │              │
 │    Loads moduleExport from  │              │
 │      dist/index.js          │              │
 │          │                  │              │
 │          ▼                  │              │
 │     Mounts as route under   │              │
 │   /api or /api/plugins/...  │              │
 └────────────────────────────────────────────┘
```

## 📜 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](../../LICENSE.md) file for details.

## 👨‍💻 Maintainers

<table>
	<tbody>
		<tr>
			<td align="center">
				<a href="https://github.com/akadlec">
					<img alt="akadlec" width="80" height="80" src="https://avatars3.githubusercontent.com/u/1866672?s=460&amp;v=4" />
				</a>
				<br>
				<a href="https://github.com/akadlec">Adam Kadlec</a>
			</td>
		</tr>
	</tbody>
</table>

***
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
