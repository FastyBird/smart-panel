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
