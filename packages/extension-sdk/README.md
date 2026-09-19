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
      "type": "plugin",
      "name": "example-extension",
      "displayName": "Example Extension",
      "description": "Demonstrates how to build an extension using the SDK",
      "version": "0.1.0",
      "routePrefix": "example",
      "entrypoint": "dist/index.js",
      "compatibility": {
        "panel": "^1.0.0"
      },
      "services": [
        {
          "id": "example-worker",
          "name": "Example Background Worker",
          "description": "Periodically synchronizes data from an external API",
          "defaultEnabled": true,
          "operations": ["start", "stop", "restart"]
        }
      ]
    }
  }
}
```

---

## 🏷️ Manifest Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `'module' \| 'plugin'` | ✅ | Extension category. |
| `name` | `string` | ✅ | Short slug, e.g. `'devices-shelly'`. |
| `displayName` | `string` | ❌ | Human-readable title for UI display. |
| `description` | `string` | ❌ | Brief description of the extension. |
| `version` | `string` | ✅ | Extension version (SemVer). |
| `routePrefix` | `string` | ❌ | Mount point under `/api/{type}s/{routePrefix}`. Defaults to `name`. |
| `entrypoint` | `string` | ❌ | Path to module entrypoint relative to package root. Defaults to `main`. |
| `compatibility.panel` | `string` | ❌ | SemVer range of compatible Smart Panel versions. |
| `services` | `Array<ExtensionServiceDefinition>` | ❌ | Declarative list of services exposed by this extension. |

---

## 🛠️ Background Services

Extensions can declare long-running background services so the host application can monitor their health and allow users to start, stop, or restart them from the admin UI.

### Declaring Services in the Manifest

Add a `services` array to `fastybird.smartPanel`:

```jsonc
"services": [
  {
    "id": "poller",
    "name": "Device Poller",
    "description": "Polls local network devices every 30 seconds",
    "defaultEnabled": true,
    "operations": ["start", "stop", "restart"]
  }
]
```

Each service must define:

- `id` — a kebab-case identifier, unique within this extension (e.g. `'poller'`).
- `name` — human-readable title shown in the UI.
- `description` — optional explanation of what the service does.
- `defaultEnabled` — whether the service runs automatically when the extension loads.
- `operations` — array of operations supported by this service; valid values are `'start'`, `'stop'`, `'restart'`.

### Implementing Service Control

Your NestJS module should implement an API endpoint or internal handler to respond to lifecycle operations:

```ts
import type { ExtensionServiceDefinition, ExtensionServiceStatus } from '@fastybird/smart-panel-extension-sdk';

// Report status back to Smart Panel
const currentStatus: ExtensionServiceStatus = 'running'; // 'stopped' | 'running' | 'degraded' | 'error'
```

---

## 🔔 Notifications

Extensions can raise issues, warnings, and alerts that surface in the Smart Panel bell popover,
push to external sinks (Slack, Discord, Telegram, Webhook), and can be resolved when the
underlying condition clears.

### Overview

There are two ways an extension interacts with notifications:

1. **Emit notifications** — raise an alert or issue from a plugin (e.g., connection lost, device offline, auth expired).
2. **Implement a delivery channel** — provide a new notification sink (like an SMS gateway or custom webhook) by implementing the `NotificationChannel` interface.

A standalone NPM package extension uses the types from this SDK. A built-in plugin
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

## Hardware Inputs and Occurrence Reporting

Extensions managing hardware devices with physical controls (e.g. pushbuttons, industrial
digital inputs, rotary encoders) can describe input capabilities and ingest physical event
occurrences via the dedicated input API contract.

### Ingestion Contract

Physical button gestures and discrete trigger events (such as `'press'`, `'double_press'`,
`'long_press'`, `'triple_press'`) are delivered using the dedicated occurrence contract
(`ReportInputOccurrencePayload` / `InputOccurrenceResult`).

```ts
import type {
  ReportInputOccurrencePayload,
  InputOccurrenceResult,
} from '@fastybird/smart-panel-extension-sdk';

const payload: ReportInputOccurrencePayload = {
  event: 'press',
  sourceOccurrenceId: 'evt-987213',
  sourceTimestamp: new Date().toISOString(),
  nativeEventType: 'click',
};

// Send to authenticated Smart Panel input ingestion endpoint
// POST /api/plugins/devices-third-party/devices/:id/channels/:channelId/occurrences
```

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
```
