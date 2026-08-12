# Write-only configuration secrets

Plugins and modules that store credentials in the shared configuration must register each credential as a write-only
secret. The config module then keeps the resolved value available to backend services while removing it from every
config API response.

## Registering a secret

Add `secretFields` to the owner's existing config type mapping:

```typescript
this.configMapper.registerMapping<HomeyConfigModel, UpdateHomeyConfigDto>({
  type: DEVICES_HOMEY_PLUGIN_NAME,
  class: HomeyConfigModel,
  configDto: UpdateHomeyConfigDto,
  secretFields: [
    {
      path: "api_key",
      configuredPath: "api_key_configured",
    },
  ],
});
```

Paths use the serialized names produced by `class-transformer`, including dot notation for nested values such as
`mqtt.password`. Add `inputPaths` only when internal callers may submit aliases that differ from the persisted serialized
path, for example `inputPaths: ['apiKey']` alongside `path: 'api_key'`.

The concrete config response model should declare and expose the non-secret configured indicator so OpenAPI clients
can use it. The secret remains optional and write-only in the update DTO; it must not be declared as a readable API
property or included in examples.

## Update semantics

Secret updates have three states:

- Omitted field: preserve the stored secret.
- Empty or whitespace-only replacement field: preserve the stored secret.
- Non-null field: replace the stored secret.
- Explicit `null`: clear the stored secret.

Admin forms therefore start replacement inputs as `undefined`, not `null`. They send `null` only from an explicit
clear action. The configured indicator is read-only and must never be copied into an update request.

The config controller passes the original request object to the merge layer. This is intentional: DTO default values
cannot reliably distinguish an omitted field from an explicit clear.

## Runtime and storage boundary

Backend owners continue to use `ConfigService.getPluginConfig()` and `getModuleConfig()`; these internal getters return
resolved secrets so managed services and config-change listeners can reconfigure safely. Config controllers use the
corresponding `getPublic*` methods, which return only the configured indicator.

Secrets are redacted from config validation logs and validation results. Do not log raw config DTOs or add credentials
to config-change event payloads.

Write-only API behavior is not encryption at rest. The current config file stores resolved values in `config.yaml`
with restrictive file permissions, and backups include that file. Do not describe this mechanism as encrypted
credential storage.
