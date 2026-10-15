# @fastybird/example-extension

This is a minimal example of a **Smart Panel extension**.

### 🧩 Manifest

```json
"fastybird": {
  "smartPanel": {
    "kind": "plugin",
    "routePrefix": "example-extension",
    "moduleExport": "ExampleExtensionModule",
    "sdkVersion": "^0.1.0"
  }
}

The backend entry also exports a typed `temperature_offset` numeric operator, the registered config model and update
DTO. Both manifest opt-in fields identify the real `example-extension` owner. The module registers its config mapper
and package-owned extension metadata explicitly; discovery does not do this for it. The fixture defaults disabled.
See [trusted numeric operators](../../docs/trusted-numeric-operators.md). This is trusted synchronous Node code,
with no sandbox, CPU timeout or protective-device authority.
