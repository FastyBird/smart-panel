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
