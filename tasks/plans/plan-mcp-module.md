# Smart Panel MCP Module — Implementation Plan

**Status:** Phase 5 complete — Phase 6 pending

**Architecture decision:** [ADR 0001: MCP Protocol and Security Foundation](../../docs/adr/0001-mcp-protocol-and-security-foundation.md)
supersedes the original stateful-session transport assumptions in this plan.

> **For agentic workers:** Read this plan completely before changing code. Implement tasks in order, keep the
> checkboxes current, and run the stated verification after every phase. Do not edit generated OpenAPI clients by
> hand.

**Goal:** Add a native Smart Panel MCP module that exposes a small, curated set of agent tools and resources from the
installation on which it runs. Owners and administrators control whether MCP is enabled and whether `read`, `write`,
`trigger`, or any combination of those capabilities is available.

**Architecture:** The backend hosts one authenticated Streamable HTTP MCP endpoint on its existing HTTP server. Modern
MCP requests are sessionless and use `subscriptions/listen` for change events; legacy 2025 requests use the SDK's
stateless compatibility path unless the release compatibility gate proves that a bounded stateful legacy adapter is
required. The MCP server calls domain services directly; it does not proxy arbitrary OpenAPI operations and has no
environment selector. An agent connects to the URL of a particular Smart Panel installation, so testing and production
remain separate by deployment rather than by MCP configuration.

**Initial endpoint:** `https://<installation>/api/v1/modules/mcp`

**Tech stack:** NestJS 11, Fastify 5, TypeScript, the official MCP TypeScript SDK, TypeORM/SQLite, Vue 3, Element Plus,
Zod, Vitest, Jest

---

## 1. Product and Security Decisions

### 1.1 Installation-local behavior

- MCP is a core backend/admin module and is present on every installation.
- There are no `development`, `staging`, or `production` MCP settings.
- The URL selected by the agent identifies the target installation.
- MCP responses and server metadata include the installation name/identifier and backend version so an agent can state
  which device it is controlling.
- The module is disabled by default.

### 1.2 Capability semantics

The capability names describe curated agent behavior, not generic HTTP methods:

| Capability | Meaning                                        | Initial operations                                               |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `read`     | Observe installation state without changing it | Home context, device state, history, energy, weather, security   |
| `write`    | Change a concrete device property              | Discover writable properties, set one property value             |
| `trigger`  | Launch a higher-level runtime action or intent | Discover trigger targets, run a scene, set a space lighting mode |

Administrative CRUD is not part of the initial MCP surface. Enabling `write` does not expose generic create, patch, or
delete operations for devices, spaces, users, configuration, extensions, or dashboards.

Each capability must work independently:

- `read` can expose full read tools and resources.
- `write` includes only the minimal metadata needed to identify writable properties; it does not expose general state
  browsing or history.
- `trigger` includes only the minimal metadata needed to identify scenes/spaces that can be triggered.
- An enabled server with an empty capability set is valid and advertises no tools or resources.

### 1.3 Effective authorization

Every tool listing and every tool execution computes permissions again:

```text
effective capabilities = module capabilities ∩ MCP client capabilities
```

The module configuration is the installation-wide ceiling. An MCP client token may be granted a subset but never a
superset. Existing owner/admin roles control who can configure the module and manage MCP clients; agent requests do not
inherit general REST access from the creating administrator.

### 1.4 Credential isolation

- Add an MCP-specific long-lived token owner type and an MCP client record.
- MCP tokens authenticate only the MCP transport endpoint.
- MCP tokens are rejected by all ordinary REST endpoints and by Socket.IO authentication.
- User access tokens, display tokens, and ordinary personal access tokens are rejected by the MCP transport endpoint.
- The raw MCP token is returned once at creation/rotation and is never stored in plaintext.
- Capability grants are stored server-side and loaded for every request so revocation and permission reduction take
  effect immediately.
- Tokens have a finite expiry; the admin UI must not offer a never-expiring MCP token.
- Use an audience claim tied to the canonical MCP endpoint and validate it on MCP requests.

### 1.5 Transport scope

- Implement the modern 2026-07-28 protocol with the official MCP TypeScript SDK v2 per-request HTTP handler.
- Publish configuration changes through `subscriptions/listen`; modern MCP has no protocol session ID.
- Serve legacy 2025 requests through the SDK's stateless compatibility path.
- Add a separately routed, bounded legacy stateful transport only if a supported target client proves it is required.
- Do not add legacy HTTP+SSE.
- Do not add stdio in this task; agents connect to the installed application over HTTP.
- Standards-compliant third-party OAuth discovery/authorization is a follow-up. The first release targets clients that
  support a preconfigured `Authorization: Bearer <MCP token>` header.
- Document that the first release is intended for trusted LAN/VPN use and is not a public internet authorization
  profile.

### 1.6 Default configuration

```yaml
type: mcp-module
enabled: false
capabilities:
  - read
allowed_origins: []
```

- An empty `allowed_origins` list permits requests without an `Origin` header and same-origin requests.
- Browser-originated requests from another origin require an explicit allowlist entry.
- Invalid origins return HTTP 403 before MCP message handling.

---

## 2. Initial Curated Catalog

### Read tools

| Tool                      | Purpose                                              | Main services                            |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `get_home_context`        | Compact installation or space-scoped overview        | Spaces, devices, scenes, weather, energy |
| `get_device_state`        | One device with channels and current property values | Devices                                  |
| `get_property_timeseries` | Bounded history for one property                     | Devices/stats                            |
| `get_energy_summary`      | Current home or space energy summary                 | Energy                                   |
| `get_weather`             | Current weather and short forecast                   | Weather                                  |
| `get_security_status`     | Current security state and active alerts             | Security                                 |

### Write tools

| Tool                       | Purpose                                                             | Notes                                                                                 |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `list_writable_properties` | Return IDs, data types, ranges/enums, and labels needed for a write | Classified as `write`, even though discovery itself is read-only                      |
| `set_device_property`      | Set one writable property                                           | Reuse/refactor `DeviceControlToolService`; validate permissions and value constraints |

### Trigger tools

| Tool                   | Purpose                                                       | Notes                                                         |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `list_trigger_targets` | Return enabled scenes and spaces with supported trigger modes | Classified as `trigger`                                       |
| `run_scene`            | Trigger one enabled scene                                     | Reuse `SceneToolService`                                      |
| `set_space_lighting`   | Execute a supported space lighting intent                     | Reuse `SpaceLightingToolService` when the plugin is installed |

### Resources

Resources are exposed only when `read` is effective:

- `smart-panel://installation` — installation identity, version, timezone, and MCP capability summary
- `smart-panel://home/context` — compact current home context
- `smart-panel://spaces/{spaceId}/snapshot` — parameterized space snapshot

Resource subscriptions and event-driven updates are out of scope for the first release. Tools always return fresh data
subject only to existing domain-service caches.

### Result rules

- Return MCP structured content with an output schema for every tool.
- Also include a concise text result for clients that do not consume structured content.
- Include `installation`, `tool`, `request_id`, and `observed_at` in structured results.
- Never include authentication headers, token hashes, secure-storage values, plugin credentials, or unredacted internal
  errors.
- A write/trigger result reports completion honestly. A queued or fire-and-forget backend operation must not be
  represented as completed.

---

## 3. Proposed File Map

```text
apps/backend/src/modules/mcp/
├── controllers/
│   ├── mcp.controller.ts                  # Raw Streamable HTTP endpoint
│   └── mcp-clients.controller.ts          # Owner/admin client management REST API
├── decorators/
│   └── mcp-endpoint.decorator.ts          # Auth isolation metadata
├── dto/
│   ├── create-mcp-client.dto.ts
│   ├── rotate-mcp-client-token.dto.ts
│   └── update-config.dto.ts
├── entities/
│   └── mcp-client.entity.ts
├── guards/
│   └── mcp-client.guard.ts                # Endpoint audience/client validation
├── listeners/
│   └── mcp-config.listener.ts             # Live policy/session updates
├── models/
│   ├── config.model.ts
│   ├── mcp-client.model.ts
│   └── mcp-response.model.ts
├── services/
│   ├── mcp-audit.service.ts
│   ├── mcp-client.service.ts
│   ├── mcp-context.service.ts
│   ├── mcp-policy.service.ts
│   ├── mcp-server.service.ts
│   └── mcp-subscription-registry.service.ts
├── tools/
│   ├── mcp-read-tool.service.ts
│   └── mcp-target-discovery-tool.service.ts
├── mcp.constants.ts
├── mcp.module.ts
└── mcp.openapi.ts

apps/admin/src/modules/mcp/
├── components/
│   ├── mcp-config-form.vue
│   ├── mcp-client-dialog.vue
│   ├── mcp-clients-list.vue
│   └── mcp-token-created-dialog.vue
├── locales/
├── schemas/
│   ├── config.schemas.ts
│   └── clients.schemas.ts
├── store/
│   └── mcp-clients.store.ts
├── mcp.constants.ts
├── mcp.module.ts
└── index.ts

apps/backend/src/migrations/
└── <next-timestamp>-AddMcpClients.ts
```

Existing files expected to change include:

- `apps/backend/package.json`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/modules/auth/auth.constants.ts`
- `apps/backend/src/modules/auth/guards/auth.guard.ts`
- `apps/backend/src/modules/auth/services/tokens.service.ts`
- `apps/backend/src/modules/websocket/services/ws-auth.service.ts`
- `apps/backend/src/modules/tools/platforms/tool-provider.platform.ts`
- `apps/backend/src/modules/tools/services/tool-provider-registry.service.ts`
- Existing device/scene/space tool providers
- `apps/admin/src/app.main.ts`
- `apps/admin/src/openapi.constants.ts`
- Generated OpenAPI artifacts through the normal generation commands

---

## 4. Implementation Tasks

### Task 1: MCP SDK compatibility spike

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `docs/adr/0001-mcp-protocol-and-security-foundation.md`
- Create: `apps/backend/test/mcp-sdk-compatibility.e2e-spec.ts`

- [x] Verify the current stable official MCP server and Node adapter packages against Node 24, TypeScript 5.9,
      Fastify 5, NestJS 11, and the repository's ESM/CommonJS build configuration.
- [x] Use `@modelcontextprotocol/server` and `@modelcontextprotocol/node`; the Fastify package creates a separate app
      and is not the route adapter needed by NestJS.
- [x] Pin exact compatible SDK and Zod versions; do not use `latest` ranges.
- [x] Confirm modern auto-negotiation and legacy stateless requests work without starting a second application server.
- [x] Confirm the Node adapter receives externally validated `AuthInfo` and passes it to the per-request server factory.
- [x] Confirm MCP responses bypass Smart Panel's response-envelope and class-transformer interceptors through
      `RawRoute` and Fastify reply hijacking.
- [x] Add an in-process test covering tool listing and structured tool calls for modern and legacy clients.

**Outcome:** SDK v2 is compatible. The focused E2E test passes. The two-host release compatibility gate remains in
Task 14 because it requires external target clients.

### Task 2: Add the backend MCP module and configuration mapping

**Files:**

- Create: `apps/backend/src/modules/mcp/mcp.constants.ts`
- Create: `apps/backend/src/modules/mcp/models/config.model.ts`
- Create: `apps/backend/src/modules/mcp/dto/update-config.dto.ts`
- Create: `apps/backend/src/modules/mcp/mcp.openapi.ts`
- Create: `apps/backend/src/modules/mcp/mcp.module.ts`
- Create: `apps/backend/test/config-authorization.e2e-spec.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/modules/config/controllers/config.controller.ts`
- Modify: `apps/backend/src/modules/config/controllers/config.controller.spec.ts`

- [x] Define `MCP_MODULE_NAME`, `MCP_MODULE_PREFIX`, API tag metadata, capability values, defaults, subscription limits, and
      timeout constants.
- [x] Add `McpConfigModel extends ModuleConfigModel` with `enabled`, `capabilities`, and `allowedOrigins`.
- [x] Add DTO validation that accepts any unique combination of `read`, `write`, and `trigger`; reject unknown and
      duplicate values.
- [x] Validate `allowed_origins` as unique, normalized absolute HTTP(S) origins without paths, queries, fragments,
      credentials, wildcards, or non-HTTP schemes.
- [x] Register the config model through `ModulesTypeMapperService`.
- [x] Register module metadata through `ExtensionsService`.
- [x] Mount the module under `modules/mcp` and import it as a core module.
- [x] Enforce `@Roles(UserRole.OWNER, UserRole.ADMIN)` on the backend `PATCH config/module/:module` route used to save
      MCP settings. Do not rely on Admin UI visibility for authorization.
- [x] Verify the role guard runs before module mapping or persistence: ordinary users, display tokens, and personal
      access tokens whose owning user lacks the owner/admin role must receive HTTP 403 and leave configuration
      unchanged. Owner/admin user credentials and owner/admin-owned PATs retain the repository's existing role
      semantics.
- [x] Add Swagger models only for the management/config REST APIs, not for the MCP JSON-RPC endpoint.
- [x] Keep the module disabled by default with `read` preselected as the safe enablement default.

**Tests:** config defaults, all eight capability combinations, invalid values, config serialization, module metadata,
controller role metadata, and HTTP authorization coverage for owner, admin, user, user-owned PAT, and display-token
requests.

**Outcome:** The MCP core module is registered under `modules/mcp`, appears in extension/config discovery, and defaults
to disabled with `read` selected. Its DTO accepts all eight capability combinations and strict normalized origins. The
shared module-configuration write route now enforces owner/admin authorization before validation or persistence, with
HTTP regression coverage for user credentials, user-owned PATs, and display tokens.

### Task 3: Extend the internal tool contract with access metadata and execution context

**Files:**

- Modify: `apps/backend/src/modules/tools/platforms/tool-provider.platform.ts`
- Modify: `apps/backend/src/modules/tools/services/base-tool-provider.service.ts`
- Modify: `apps/backend/src/modules/tools/services/tool-provider-registry.service.ts`
- Modify existing tool-provider tests

- [x] Add a provider-neutral access-kind enum: `read`, `write`, `trigger`.
- [x] Add tool audiences so a definition explicitly opts into Buddy, MCP, or both.
- [x] Add optional execution context carrying audience, source, authenticated actor/client ID, and request ID.
- [x] Define provider-neutral Zod input/output schemas and derive the legacy JSON Schema representation from them.
- [x] Return explicit completed, partial, failed, timed-out, or denied execution outcomes.
- [x] Make registry listing filter by audience and access kinds.
- [x] Make registry execution resolve the registered definition first and reject audience mismatches.
- [x] Preserve Buddy behavior and signatures through default execution context values where necessary.
- [x] Reject duplicate tool names across providers at registration; logging and silently keeping one provider is not
      safe for an externally exposed protocol.
- [x] Keep timeout handling in `BaseToolProviderService` and return a structured failure without leaking stack traces.

**Tests:** audience filtering, capability filtering, duplicate names, unknown tools, execution context propagation,
timeouts, and Buddy regression tests.

**Outcome:** The registry now indexes unique tool names, applies definition-level audience/access policy before provider
execution, and defaults existing callers to the Buddy context. Tool definitions use Zod as their schema source and all
execution paths return structured, sanitized outcomes.

### Task 4: Classify and refactor the existing operational tools

**Files:**

- Modify: `apps/backend/src/modules/devices/services/device-control-tool.service.ts`
- Modify: `apps/backend/src/modules/scenes/services/scene-tool.service.ts`
- Modify: `apps/backend/src/plugins/spaces-home-control/services/space-lighting-tool.service.ts`
- Modify corresponding unit tests

- [x] Classify device property control as `write` and expose it to Buddy and MCP.
- [x] Classify scene execution and space lighting intents as `trigger` and expose them to Buddy and MCP.
- [x] Rename only at the MCP adapter boundary if public MCP names need clearer naming; do not break existing Buddy tool
      names unnecessarily.
- [x] Keep the domain intent origin provider-neutral and record the exact Buddy/MCP source, audience, and actor from the
      execution context.
- [x] Route provider-triggered writes through the shared property validation, intent, and platform processing paths.
- [x] Ensure scene and lighting calls return completed, partial, failed, or timed-out states accurately.
- [x] Do not expose a plugin-contributed tool to MCP unless its definition explicitly lists the MCP audience.

**Tests:** Buddy origin remains unchanged, MCP source is recorded in intent context, capability classification, partial
failures, disabled scenes, invalid properties, and unavailable optional plugin services.

**Outcome:** Device writes now share one constraint-aware property command path for REST and agent tools. Device,
scene, and optional space-lighting providers explicitly opt into MCP, propagate execution context to intents, and
report partial or failed operations honestly without exposing internal exceptions.

### Task 5: Add MCP client records, token issuance, and endpoint isolation

**Files:**

- Create: `apps/backend/src/modules/mcp/entities/mcp-client.entity.ts`
- Create: `apps/backend/src/modules/mcp/services/mcp-client.service.ts`
- Create: MCP client DTOs/models/controller
- Create: incremental migration `apps/backend/src/migrations/<next>-AddMcpClients.ts`
- Modify auth constants, token service, HTTP auth guard, and WebSocket auth service

- [x] Add `TokenOwnerType.MCP`.
- [x] Store MCP client name, description, enabled state, capability subset, creator user ID, timestamps, and associated
      long-lived token ID/owner relationship.
- [x] Generate an MCP JWT with `type: mcp`, MCP client ID as subject/owner, finite expiry, and canonical endpoint
      audience.
- [x] Store only the normal token hash; return the raw token exactly once.
- [x] Add owner/admin-only list, create, update, rotate, revoke/delete management endpoints.
- [x] Validate requested client capabilities against the module's configured ceiling at creation/update time.
- [x] Also intersect capabilities at request time so later module reductions apply immediately.
- [x] Extend `AuthGuard` with explicit MCP-endpoint metadata: MCP tokens are accepted only on that endpoint and all
      other token types are rejected there.
- [x] Reject MCP tokens in `WsAuthService` before they reach the generic long-lived-token branch.
- [x] Ensure profile PAT lists and display-token flows do not accidentally include or manage MCP credentials.
- [x] Use an incremental migration; never edit an existing migration.

**Tests:** one-time secret, hash storage, expiry, audience, revocation, rotation, capability subset validation, MCP token
rejected on REST, PAT rejected on MCP, MCP token rejected on WebSocket, and existing display/PAT auth regressions.

**Outcome:** MCP clients now have installation-local records, finite audience-bound credentials, one-time secret
delivery, capability ceilings with request-time intersection, and owner/admin lifecycle APIs. HTTP, WebSocket,
personal-access-token, and display authentication paths explicitly isolate MCP credentials, backed by an incremental
SQLite migration and focused regression coverage.

### Task 6: Implement policy and subscription services

**Files:**

- Create: `apps/backend/src/modules/mcp/services/mcp-policy.service.ts`
- Create: `apps/backend/src/modules/mcp/services/mcp-subscription-registry.service.ts`
- Create corresponding specs

- [x] Resolve installation config and authenticated MCP client for every listing/read/call operation.
- [x] Compute effective capabilities using the intersection rule.
- [x] Recheck module enabled state, client enabled/revoked state, token expiry, and tool capability immediately before
      execution.
- [x] Use the SDK event bus for modern `subscriptions/listen` change events.
- [x] Track subscription streams by authenticated MCP client so targeted policy changes can abort affected streams.
- [x] Add idle expiration and cleanup on disconnect/module shutdown.
- [x] Cap concurrent global and per-client subscription streams to prevent unbounded memory growth.
- [x] Provide methods to notify subscribers of tool/resource-list changes and close streams for a revoked client or
      disabled module.
- [x] If legacy stateful support is later approved, keep its session registry separate and bind every session to the
      authenticated token/client.

**Tests:** intersection matrix, cross-client stream isolation, revocation during a subscription, module disable, stream
caps, and cleanup.

**Outcome:** Every MCP request now resolves a fresh installation/client policy context, intersects current grants, and
can re-authorize individual capabilities immediately before execution. Modern subscriptions use isolated per-client
SDK event buses plus a bounded registry with targeted aborts, idle expiry, disconnect cleanup, and shutdown cleanup;
the legacy path remains deliberately stateless and has no session registry.

### Task 7: Implement the raw Streamable HTTP endpoint

**Files:**

- Create: `apps/backend/src/modules/mcp/controllers/mcp.controller.ts`
- Create: `apps/backend/src/modules/mcp/decorators/mcp-endpoint.decorator.ts`
- Create: `apps/backend/src/modules/mcp/guards/mcp-client.guard.ts`
- Create: `apps/backend/src/modules/mcp/services/mcp-server.service.ts`
- Create endpoint/integration specs

- [x] Expose the module root to the SDK adapter. Modern traffic uses POST and streaming POST responses; legacy
      stateless GET/DELETE requests receive the SDK-defined 405 response.
- [x] Mark the handler as a raw route so Smart Panel response interceptors do not wrap JSON-RPC or SSE responses.
- [x] Exclude the protocol endpoint from OpenAPI while keeping client-management endpoints documented.
- [x] Return 404 while the MCP module is disabled.
- [x] Authenticate before SDK dispatch or subscription registration.
- [x] Validate `Origin` using same-origin plus configured allowlist rules; return 403 for invalid origins.
- [x] Validate content type, accepted response types, protocol version, method/name headers, and bounded request body.
- [x] Attach installation identity and effective capability information to MCP server instructions/metadata.
- [x] Add a dedicated throttle keyed by MCP client, with a stricter unauthenticated/IP limit.
- [x] Ensure JSON-RPC errors and HTTP auth/transport errors retain protocol-correct shapes and status codes.
- [x] Close SDK handlers and active subscription streams during Nest application shutdown.

**Tests:** modern discovery, legacy initialization, tools/list, tools/call, `subscriptions/listen`, legacy GET/DELETE
behavior, malformed JSON-RPC, unsupported protocol version, missing/invalid token, invalid origin/host, disabled module,
throttling, and graceful shutdown.

**Outcome:** The module root is now a raw, OpenAPI-excluded MCP transport backed by the official SDK's modern handler
and stateless legacy fallback. DB-backed MCP authentication and fresh policy checks run before dispatch, transport
origin/host validation and explicit body limits protect the boundary, dedicated throttling separates authenticated
client and unauthenticated IP budgets, and the application closes all handlers and streams on shutdown.

### Task 8: Implement curated read tools and resources

**Files:**

- Create: `apps/backend/src/modules/mcp/services/mcp-context.service.ts`
- Create: `apps/backend/src/modules/mcp/tools/mcp-read-tool.service.ts`
- Add tests and Swagger-independent result schemas

- [x] Build MCP context from public domain services, not repositories and not calls back into the installation's REST
      API.
- [x] Keep MCP independent of Buddy configuration. Reuse small provider-neutral mapping helpers where practical, but do
      not make MCP availability depend on an LLM provider.
- [x] Implement the read catalog defined above with bounded results.
- [x] Limit timeseries ranges and point counts; reject unbounded history queries.
- [x] Avoid N+1 device/property loading and cap context size for large installations.
- [x] Implement the three initial resources and resource templates.
- [x] Expose no read tools or resources when `read` is absent from effective capabilities.
- [x] Normalize optional/missing weather, energy, security, plugin, or device data instead of failing the whole context.
- [x] Return installation identity with every result.

**Outcome:** The authenticated MCP server now exposes six bounded read tools, installation/home resources, and a
parameterized space snapshot template only when `read` is effective. Tool execution reauthorizes the live client and
module policy, returns structured installation metadata, caps context/history/forecast/alert sizes, and isolates
optional weather, energy, and security failures from the broader home context.

**Tests:** global and space context, large-installation bounds, missing optional modules/data, invalid IDs, timeseries
limits, output schema validation, and read-disabled behavior.

### Task 9: Implement standalone discovery for write and trigger modes

**Files:**

- Create: `apps/backend/src/modules/mcp/tools/mcp-target-discovery-tool.service.ts`
- Add specs

- [ ] Implement `list_writable_properties` and classify it as `write`.
- [ ] Return only writable properties with the identifiers and validation metadata needed by
      `set_device_property`.
- [ ] Implement `list_trigger_targets` and classify it as `trigger`.
- [ ] Return only enabled/supported scenes, spaces, and modes needed by the initial trigger tools.
- [ ] Make both discovery tools usable when `read` is disabled.
- [ ] Do not include unrelated state, history, credentials, configuration, or hidden/disabled targets.

**Tests:** write-only, trigger-only, disconnected devices, read-only properties, disabled scenes, spaces without lighting,
and optional home-control plugin absence.

### Task 10: Apply live configuration and client changes

**Files:**

- Create: `apps/backend/src/modules/mcp/listeners/mcp-config.listener.ts`
- Modify MCP client service/subscription registry
- Add specs

- [ ] Subscribe to the existing configuration-updated event for `mcp-module`.
- [ ] On capability changes, publish tool-list changes to active modern subscriptions and the negotiated legacy
      notification equivalent when a legacy stateful adapter exists.
- [ ] On removal of `read`, also notify resource-list changes where supported.
- [ ] On module disable, close all active subscription streams after a best-effort notification.
- [ ] On client capability reduction, notify only that client's streams.
- [ ] On client disable/revocation/deletion/rotation, close that client's existing streams.
- [ ] Execution policy remains authoritative even if a client misses a notification.

**Tests:** every live transition, including a tool call racing with a permission reduction.

### Task 11: Add security-safe auditing and observability

**Files:**

- Create: `apps/backend/src/modules/mcp/services/mcp-audit.service.ts`
- Modify MCP server/policy/client services
- Add stats provider only if it follows existing metrics patterns cleanly

- [ ] Log discovery/legacy initialization, authentication failure, subscription open/close, tool execution, policy
      denial, timeout, and result.
- [ ] Include request ID, MCP client ID, tool, capability, duration, and outcome.
- [ ] Do not log bearer tokens, token hashes, authorization headers, secure values, or unrestricted raw arguments.
- [ ] Redact or summarize values for device writes while retaining target IDs for investigation.
- [ ] Add counters for active subscriptions, calls by capability/tool, failures, denials, and timeouts.
- [ ] Make logs identify the source as `mcp-module` and preserve existing system logger conventions.

**Tests:** redaction, success/failure records, metrics increments, and no token material in captured logs.

### Task 12: Build the admin MCP module

**Files:**

- Create files under `apps/admin/src/modules/mcp/`
- Modify: `apps/admin/src/app.main.ts`
- Modify manually maintained OpenAPI exports only after regeneration

- [ ] Register MCP as a core admin module with a module configuration form.
- [ ] Add enable/disable control and an Element Plus checkbox group for read/write/trigger.
- [ ] Explain each capability with concrete examples and state clearly that write/trigger can affect physical devices.
- [ ] Allow any capability combination, including none.
- [ ] Add `allowed_origins` editing with URL validation.
- [ ] Show the installation-specific MCP endpoint URL and a copy button.
- [ ] Add MCP client list, create, edit capability subset, rotate, and revoke/delete flows.
- [ ] Require a finite expiry during client creation.
- [ ] Display the raw token exactly once with a copy warning.
- [ ] Prevent selecting a client capability that is outside the current module ceiling.
- [ ] Show enabled/revoked/expired status and last-used timestamp.
- [ ] Restrict configuration and client management UI to owner/admin users.
- [ ] Add all currently supported locale files, following other core modules.

**Tests:** form schemas, all capability combinations, subset validation, token one-time dialog, failed API requests,
revocation confirmation, role restrictions, and responsive layout.

### Task 13: OpenAPI regeneration and generated clients

- [ ] Add Swagger decorators and response models for MCP client-management endpoints.
- [ ] Register all MCP management models in `mcp.openapi.ts`.
- [ ] Run `pnpm run generate:openapi`.
- [ ] Update only manually maintained exports in `apps/admin/src/openapi.constants.ts`.
- [ ] Run the API convention and OpenAPI linters.
- [ ] Confirm the raw MCP endpoint is not incorrectly represented as a normal JSON REST operation.
- [ ] Run `melos rebuild-all` only if generated panel API changes are intentionally part of the repository's normal
      OpenAPI regeneration workflow; do not manually edit generated Dart files.

### Task 14: End-to-end and compatibility verification

- [ ] Add backend E2E coverage using an in-process MCP client or the SDK's supported test transport.
- [ ] Test all eight module capability combinations.
- [ ] Test module/client capability intersections.
- [ ] Test two simultaneous clients with different permissions and ensure authenticated contexts and subscriptions
      cannot cross.
- [ ] Test a permission change and token revocation while clients remain connected.
- [ ] Test against a simulator installation so writes/triggers cannot affect real hardware.
- [ ] Verify `set_device_property`, `run_scene`, and `set_space_lighting` produce the expected intent/event traces.
- [ ] Run targeted backend unit tests, backend E2E tests, admin unit tests, type checks, and JS lint.
- [ ] Smoke-test at least two supported agent hosts/clients using a static bearer-header configuration.
- [ ] Record unsupported clients and whether they require the follow-up OAuth flow.
- [ ] Confirm MCP remains unreachable when disabled after a restart.

### Task 15: Documentation and rollout

**Files:**

- Create/update website documentation under `apps/website/app/docs/`
- Update module metadata README
- Update this plan's completed checkboxes and task status when implementation ships

- [ ] Document enabling MCP, choosing capabilities, creating a client, copying the one-time token, connecting an agent,
      rotating/revoking credentials, and troubleshooting.
- [ ] Provide distinct examples for read-only, write-only, trigger-only, and read+write+trigger clients.
- [ ] Warn users to verify the installation hostname/name before approving write or trigger operations.
- [ ] Recommend LAN/VPN access and HTTPS through a reverse proxy; do not recommend direct public exposure for the
      static-token release.
- [ ] Document the exact curated catalog and state explicitly that OpenAPI endpoints are not automatically exposed.
- [ ] Add upgrade notes for configuration defaults and the new incremental migration.
- [ ] Create a follow-up task for standards-compliant MCP OAuth/protected-resource discovery before public internet use.

---

## 5. Acceptance Criteria

### Configuration and administration

- [ ] MCP is a core module visible in Admin and disabled by default.
- [ ] An owner/admin can enable any combination of read, write, and trigger.
- [ ] Backend authorization rejects module-configuration changes from ordinary users, user-owned PATs, and display
      tokens; denied requests do not mutate persisted or in-memory MCP configuration.
- [ ] Configuration persists across restart and applies without requiring a restart.
- [ ] An owner/admin can create, restrict, rotate, and revoke MCP client credentials.
- [ ] Raw client tokens are displayed only once and always have a finite expiry.

### Protocol and catalog

- [ ] A modern MCP client can discover `/api/v1/modules/mcp`, and a compatible legacy client can initialize through the
      stateless fallback.
- [ ] `tools/list`, `resources/list`, `tools/call`, resource reads, subscriptions, and shutdown behave according to the
      negotiated protocol version.
- [ ] Only explicitly registered tools appear; no generic OpenAPI proxy exists.
- [ ] Tool/resource discovery matches the effective capability intersection.
- [ ] Disabled capabilities are enforced again at execution time.
- [ ] Configuration changes notify active clients and immediately prevent stale calls.

### Security

- [ ] MCP tokens work only on the MCP endpoint.
- [ ] Ordinary access/PAT/display tokens do not work on the MCP endpoint.
- [ ] Revoked, expired, disabled-client, wrong-audience, and invalid-origin requests are rejected.
- [ ] Subscription streams and any approved legacy sessions remain bound to the correct bearer token and MCP client.
- [ ] Logs and results contain no credential material.
- [ ] The MCP endpoint is rate-limited and bounded by subscription, body-size, context-size, and history limits.

### Operations

- [ ] Read-only clients cannot write or trigger.
- [ ] Write-only clients can discover writable properties and set them but cannot access general reads or triggers.
- [ ] Trigger-only clients can discover trigger targets and invoke them but cannot access general reads or direct
      property writes.
- [ ] Existing Buddy tool execution continues to work unchanged from the user's perspective.
- [ ] Existing REST, PAT, display-token, WebSocket, and admin flows have no regressions.

---

## 6. Explicitly Out of Scope

- Automatic conversion of OpenAPI operations into MCP tools
- Arbitrary REST requests, SQL access, filesystem access, shell execution, or secure-storage access
- User, display, plugin, dashboard, extension, or module-configuration CRUD through MCP
- Factory reset, backup restore, application update, service restart, reboot, or power-off tools
- MCP prompts, sampling, elicitation, and experimental MCP tasks
- Resource subscriptions and Socket.IO-to-MCP event forwarding
- Cross-installation routing or environment selection inside one MCP server
- Public-internet OAuth 2.1 authorization and dynamic client registration in the first release
- Panel application changes beyond generated API artifacts, if regeneration produces them

---

## 7. Rollout Gates

1. **Foundation gate:** SDK compatibility, disabled module, authentication isolation, and zero-tool protocol discovery.
2. **Read gate:** Read-only operation passes E2E tests on a simulator and a testing installation.
3. **Write gate:** Direct property writes pass value validation, audit, timeout, and permission-revocation tests.
4. **Trigger gate:** Scene and space intent execution pass partial-failure and repeat-invocation tests.
5. **Admin gate:** Capability and client management work across all combinations and roles.
6. **Release gate:** Full regression suite, two-client compatibility smoke test, security review, and documentation.

Do not enable write or trigger by default at any gate.
