# ADR 0001: MCP Protocol and Security Foundation

**Status:** Accepted

**Date:** 2026-08-06

**Scope:** Phase 0 of the Smart Panel MCP module

## Context

The original MCP implementation plan was written around the 2025 Streamable HTTP lifecycle: `initialize`, an
`Mcp-Session-Id`, GET/SSE notification streams, and DELETE-based session teardown. MCP revision 2026-07-28 replaces
that lifecycle with per-request protocol metadata, `server/discover`, and `subscriptions/listen`. The official
TypeScript SDK v2 supports both the modern protocol and legacy 2025 clients.

Smart Panel also needs security decisions that remain stable when an installation changes hostname, IP address, or
reverse-proxy path. Those decisions must be settled before token, client, and transport schemas are implemented.

## Decisions

### 1. Protocol posture

- The primary protocol is MCP revision `2026-07-28` or a later revision explicitly supported by the pinned SDK.
- The first release uses the official SDK's per-request HTTP handler and modern `subscriptions/listen` event bus.
- Legacy 2025 traffic is served by the SDK's stateless compatibility path initially.
- A stateful legacy transport, including session IDs, GET/SSE, and DELETE teardown, is not part of the initial
  implementation. It will be added only if one of the two release-target MCP hosts fails the stateless compatibility
  test and cannot use the modern protocol.
- If legacy stateful support becomes necessary, it will be routed separately with the SDK's `isLegacyRequest`
  classifier. Modern requests will remain sessionless.
- Stdio and legacy HTTP+SSE are out of scope.

This replaces the original assumption that stateful sessions are required for change notifications. Modern clients
receive tool and resource list changes through `subscriptions/listen`.

### 2. SDK packages and HTTP integration

- Pin `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, and the test-only
  `@modelcontextprotocol/client` to `2.0.0`.
- Pin Zod to `4.4.3` for input and output schemas.
- Mount `createMcpHandler` through `toNodeHandler` on the existing NestJS/Fastify server.
- Do not install `@modelcontextprotocol/fastify`: it is an application factory, not an adapter for a route hosted by
  the existing NestJS Fastify application.
- Use Smart Panel's existing `RawRoute` metadata and exclude the protocol endpoint from OpenAPI. The controller must
  hijack the Fastify reply before the Node adapter writes JSON or SSE to the raw response.
- Authentication, authorization, body limits, throttling, and Origin/Host validation execute before SDK dispatch.
  The validated principal is passed to the SDK as `AuthInfo`; the SDK does not authenticate bearer tokens itself.

### 3. Installation identity and token audience

- Every installation receives an immutable UUID generated once and persisted in database-backed storage.
- Hostname, mDNS name, IP address, and public URL are display/routing metadata and are not installation identity.
- MCP token audience is the stable URI `urn:fastybird:smart-panel:<installation-uuid>:mcp`.
- The MCP authentication guard validates that exact audience and accepts the token only at
  `/api/v1/modules/mcp`.
- MCP results expose the installation UUID, display name, backend version, and current endpoint URL when it can be
  determined safely.

This permits DHCP, reverse-proxy, and ingress URL changes without invalidating every MCP token. Token rotation remains
required if an installation is cloned with its database; operational backup/restore documentation must call this out.

### 4. Origin, Host, and proxy policy

- `allowed_origins` contains normalized absolute HTTP(S) origins only: scheme, hostname, and effective port. Paths,
  query strings, fragments, credentials, wildcard hosts, and non-HTTP schemes are rejected.
- A missing `Origin` is accepted for non-browser MCP clients after bearer authentication.
- A present same-origin request is accepted. A different browser origin must match `allowed_origins` exactly.
- Host validation is independent of Origin validation. Accepted hosts are derived from loopback defaults, the host in
  `FB_APP_HOST`, and hosts explicitly present in `allowed_origins`.
- Forwarded headers are not trusted for MCP security decisions until Smart Panel has an explicit trusted-proxy
  configuration. Administrators behind a reverse proxy must configure `FB_APP_HOST` to the external origin.
- Host and Origin failures return HTTP 403 before JSON-RPC parsing.

### 5. Configuration authorization

Saving module configuration is an administrative operation. The generic `PATCH config/module/:module` endpoint will
be restricted to owners and administrators for every module, rather than adding a hidden MCP-only exception to a
shared controller. Phase 2 must include regression coverage for every credential type and confirm that existing Admin
configuration flows use owner/admin credentials.

### 6. Lifecycle and policy invalidation

- Authorization is recalculated for every MCP request and immediately before each tool execution.
- Modern subscription streams are bounded globally and per client at the application policy layer.
- Module disable, client disable/revocation, token rotation, and capability reduction invalidate current policy
  immediately. The event bus sends best-effort list-change notifications; missed notifications never grant access.
- Targeted revocation aborts subscription streams owned by the affected MCP client. These are application connection
  records, not MCP protocol sessions.
- Nest shutdown hooks will be enabled before the production MCP endpoint is registered so handlers and streams close
  cleanly.

### 7. Tool execution and intent traceability

- The internal tool registry uses provider-neutral `read`, `write`, and `trigger` access kinds and requires every tool
  to opt into its allowed audiences explicitly.
- Existing callers that omit execution context retain Buddy-compatible defaults.
- Domain intents retain the provider-neutral `api` origin. The exact caller source (`buddy`, `mcp`, or a future
  adapter), audience, and authenticated actor are recorded in intent context metadata.
- Provider-triggered device writes use the same property constraint validation, intent lifecycle, and platform batch
  processing path as the REST property-command API.
- Internal exception details remain in server logs; agent-facing failures contain stable error codes and sanitized
  messages only.

## Compatibility gate

Before the MCP catalog is considered release-ready, test two intended agent hosts with static bearer-header
configuration. Each host must complete:

1. Protocol discovery or legacy initialization.
2. Tool listing.
3. One structured tool call.
4. Tool-list change observation when supported by its negotiated protocol.
5. Immediate denial after token revocation or capability reduction.

If a target host requires legacy stateful Streamable HTTP, record the host/version and add a bounded legacy transport
registry as a separate compatibility change. Do not add stateful behavior to modern requests.

## Consequences

- Modern MCP behavior follows the current protocol without carrying session identifiers.
- Basic legacy clients remain usable, but legacy live notifications are not promised unless the compatibility gate
  demonstrates a need for stateful support.
- Installation URL changes do not invalidate token audiences.
- MCP access through a reverse proxy requires an explicit canonical host configuration.
- Restricting the shared configuration write endpoint is a deliberate cross-module authorization hardening and needs
  broader regression testing.
- Tool executions remain attributable to their adapter without expanding the public intent-origin enum for every new
  agent protocol.

## References

- [MCP 2026-07-28 protocol revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [TypeScript SDK v2 protocol version support](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)
- [`createMcpHandler` API](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/server/createMcpHandler.html)
