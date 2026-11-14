# @fastybird/example-extension

This is a minimal example of a **Smart Panel extension**.

### 🧩 Manifest

```json
{
  "name": "@fastybird/smart-panel-extension-example",
  "main": "dist/index.js",
  "fastybird": {
    "smartPanelBackend": {
      "kind": "plugin",
      "routePrefix": "example-extension",
      "extensionExport": "ExampleExtensionModule",
      "sdkVersion": "^1.0.0",
      "displayName": "Example Extension",
      "description": "Shows how to build a minimal extension for Smart Panel.",
      "numericOperatorsExport": "exampleNumericOperators",
      "configOwnerType": "example-extension"
    },
    "smartPanelAdmin": {
      "kind": "plugin",
      "extensionEntry": "admin/index.js",
      "displayName": "Example Admin",
      "description": "Tiny demo admin plugin"
    }
  }
}
```

The backend entry also exports a typed `temperature_offset` numeric operator, the registered config model and update
DTO. Both manifest opt-in fields identify the real `example-extension` owner. The module registers its config mapper
and package-owned extension metadata explicitly; discovery does not do this for it. The fixture defaults disabled.
See [trusted numeric operators](../../docs/trusted-numeric-operators.md). This is trusted synchronous Node code,
with no sandbox, CPU timeout or protective-device authority.

### Automation cards

`src/automation-cards.ts` adds one trigger (`example-extension.signal.received`), one condition
(`example-extension.signal.recent`) and one action (`example-extension.signal.send`) to automations. They are typed
against `@fastybird/smart-panel-extension-sdk` only; the module imports `AutomationsModule` and registers them with
`AutomationNodeTypeRegistryService` in `onModuleInit`. They are offered and run only while the plugin is enabled, and
the admin edits them with the generic form built from their `configSchema`. See
[Adding automation cards](../../docs/extensions.md#adding-automation-cards).

```bash
pnpm --filter @fastybird/smart-panel-extension-sdk build
cd packages/example-extension && npm test
```

The tests run the TypeScript sources directly, which needs Node.js 22.18 or newer (the monorepo uses 24); the test
script stops with a message on an older one. The `engines` range of the package is about its built output, which
the backend loads.
