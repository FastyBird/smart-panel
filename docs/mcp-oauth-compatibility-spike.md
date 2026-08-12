# MCP OAuth Compatibility Spike

**Status:** Architecture and authorization-component spikes complete; live interoperability remains a release gate

**Date:** 2026-08-08

**Related task:** `TECH-MCP-OAUTH-AUTHORIZATION`

## Purpose

This spike establishes the standards baseline, registration strategy, target hosts, and authorization-server
integration risks before Smart Panel adds OAuth endpoints. It is evidence for
[ADR 0002](adr/0002-mcp-oauth-authorization.md), not an interoperability result: there is no Smart Panel OAuth server to
exercise yet.

## Standards baseline

Implementation must target the exact revisions below. OAuth 2.1 is still an IETF draft, so documentation and metadata
must not describe it as a published RFC.

| Concern | Revision used by this task |
| --- | --- |
| MCP authorization | MCP `2026-07-28` |
| OAuth security profile | `draft-ietf-oauth-v2-1-13` plus OAuth 2.0 Security BCP, RFC 9700 |
| Bearer challenges | RFC 6750 |
| PKCE | RFC 7636, `S256` only |
| Authorization-server metadata | RFC 8414 |
| Resource indicators | RFC 8707 |
| Authorization-response issuer | RFC 9207 |
| Protected-resource metadata | RFC 9728 |
| Token revocation | RFC 7009 |
| Native loopback redirects | RFC 8252 |
| Client registration | Pre-registration initially; CIMD draft support tracked separately |

MCP `2026-07-28` requires protected-resource metadata and the `resource` parameter in authorization and token
requests. It prefers Client ID Metadata Documents (CIMD), permits pre-registration, and deprecates Dynamic Client
Registration (DCR). DCR remains a compatibility mechanism but is expected to be removed from a future MCP revision.

## Resource identity finding

The existing static MCP credential audience is the stable installation URI
`urn:fastybird:smart-panel:<installation-uuid>:mcp`. That remains correct for the installation-local static-token
profile, but it is not the OAuth resource identifier required by MCP.

OAuth will use the exact, explicitly configured public HTTPS MCP URL, for example
`https://panel.example.com/api/v1/modules/mcp`, as both the RFC 8707 `resource` and access-token audience. Smart Panel
will continue to keep the installation UUID as stable internal identity. Changing the public URL therefore revokes or
invalidates OAuth tokens without changing installation identity. Request Host or forwarded headers must never select
the resource identifier.

## Host capability matrix

The matrix records documented capabilities as of the spike date. “Target” means it will receive a real smoke test once
the endpoints exist.

| Host | Documented registration paths | Relevant behavior | Release use |
| --- | --- | --- | --- |
| Codex CLI/app | Predefined client ID; OAuth discovery used by `codex mcp login`; ChatGPT connectors additionally support CIMD and DCR | Streamable HTTP OAuth, scopes, RFC 8707 resource override, fixed or ephemeral loopback callback, PKCE | Target 1 |
| Claude Code | CIMD, DCR, or predefined public/confidential client | RFC 9728 discovery, HTTP OAuth, fixed loopback callback, automatic refresh, scope pinning | Target 2 |
| MCP TypeScript client / Inspector | Programmatic provider or interactive inspector | Fine-grained discovery, PKCE, token and negative-path tests | Automated harness, not one of the two user hosts |
| ChatGPT connector | CIMD preferred, DCR fallback, or predefined client | Cloud callback, authorization code plus PKCE, resource binding | Follow-up compatibility target |

Both initial target hosts can use an owner-created public client ID and a registered loopback redirect. That means DCR
is not required for the first supported profile. The live smoke test must record exact host versions, callback URIs,
requested metadata, requested scopes, refresh behavior, and revocation behavior.

## Registration decision from the spike

The first release supports owner/admin pre-registration of public clients with:

- a generated, non-secret client ID;
- one or more registered redirect URIs;
- `authorization_code` and optional `refresh_token` grants only;
- `none` token-endpoint authentication only;
- an approved maximum capability set; and
- an enabled/revoked state.

Loopback HTTP redirect URIs are permitted only for native clients. For the loopback IP literals `127.0.0.1` and `[::1]`,
RFC 8252 requires the authorization server to accept any runtime port while matching the scheme, literal address, path,
query, and trailing slash exactly. A registered `localhost` hostname redirect must keep an exact port because the RFC
8252 variable-port exception applies only to loopback IP literals. Other redirect URIs require HTTPS and exact string
matching. Wildcards, fragments, credentials, and general redirect URI prefix matching are forbidden.

CIMD is deferred until the chosen authorization component supports the same draft revision as the current MCP
specification and Smart Panel has a reviewed SSRF-safe metadata fetch policy. DCR is not implemented unless a supported
host fails the pre-registration gate and the failure cannot be fixed with its documented client-ID/callback settings.

## Authorization component survey

Smart Panel must not implement OAuth protocol machinery ad hoc. The leading embedded candidate is `oidc-provider`
because it implements authorization code, PKCE, RFC 8414, RFC 7009, RFC 8707, RFC 9207, opaque tokens, interactions,
and pluggable persistence. It is not added in this phase because two integration risks require an executable spike:

1. Current releases are ESM-only while the NestJS backend compiles to CommonJS.
2. Its CIMD support is experimental and currently tracks a newer draft than the MCP `2026-07-28` text.

Phase 1 completed that executable gate with exactly pinned `oidc-provider` `9.11.2` and type definitions `9.11.1`:

- the package is MIT licensed, ESM-only, and introduced no advisory beyond the repository's existing audit baseline;
- a small native-import bridge loads it from the CommonJS backend build; the dedicated `test:oauth-spike` Jest command
  enables Node VM modules only for this spike so the existing CommonJS unit and E2E runners remain unchanged;
- a test-only NestJS/Fastify application mounts a finite authorization, token, revocation, interaction, and metadata
  surface on the existing listener, with unrelated paths continuing through Nest;
- a minimal TypeORM adapter persists artifacts across datasource restarts and refuses SQLite memory storage unless both
  the test environment and an explicit opt-in are present;
- conditional consume plus a persisted revoked-grant tombstone prevents concurrent refresh reuse from creating a
  usable fork and removes late successors and the rest of the token family;
- login and consent are completed through interaction callbacks using an already authenticated Smart Panel account;
  the provider never receives a password; and
- fifteen focused E2E scenarios cover metadata, authenticated interaction delegation, code plus PKCE `S256`, downgrade
  and verifier failures, replay,
  issuer-bearing success and error responses, resource mismatch, opaque access and refresh tokens, explicit offline
  consent, RFC 8252 redirects, rotation, concurrent reuse, revocation, persistence, and finite route mounting.

Two integration findings become explicit Phase 3 rules:

1. The dependency's own discovery document is deliberately OIDC-shaped and includes fields outside this MCP-only
   profile. Smart Panel must continue publishing a bounded RFC 8414 projection and must not mount the dependency's raw
   discovery route.
2. When a code has exactly one authorized resource, the dependency follows RFC 8707 by resolving that resource if the
   token request omits `resource`. MCP places a stricter requirement on clients to send it in both requests. Smart Panel
   must enforce token-request presence at the finite token-route boundary before provider dispatch, while the provider
   policy hook continues to reject unknown or mismatched resources.

These are supported integration boundaries, not replacements for the provider's protocol state machine. ADR 0002 is
therefore accepted and implementation may proceed to the persistent domain foundation.

The official MCP TypeScript SDK v2 already provides resource-server building blocks for bearer verification,
standards-shaped challenges, protected-resource metadata, and `AuthInfo`. Those helpers do not implement an
authorization server and therefore do not remove the need for the component spike.

## Risks to prove with live tests

- Callback URI formats for current Codex and Claude Code releases, including an ephemeral loopback IP port.
- RFC 8414 discovery for an issuer containing a path component.
- `resource` propagation at authorization, code exchange, and refresh.
- `iss` presence in both successful and error authorization responses.
- Transactional refresh-token compare-and-consume under concurrent replay, with at most one successor and whole-family
  revocation after a losing reuse attempt.
- Immediate denial and subscription closure after client, grant, access-token, or refresh-family revocation and at
  the earlier of access-token or grant expiry.
- Awaited OAuth stream closure on every effective-scope contraction from the module ceiling, registered-client maximum,
  or approved grant, including write/trigger removal while read remains.
- Atomic subscription registration versus revocation/scope reduction, so a stale in-flight listen request cannot open
  after invalidation succeeds.
- Awaited grant, token, and subscription invalidation when the approving owner/admin is demoted or deleted.
- Global artifact revocation and stream closure on OAuth server-secret rotation.
- Fail-closed OAuth switch-off that rejects new OAuth traffic, revokes OAuth artifacts, and closes OAuth streams while
  preserving static MCP streams; readiness-gated re-enable must not reactivate old artifacts.
- Artifact issuance/rotation serialized against all persistent OAuth-enabled, server-secret, public-identity,
  client/grant/policy, and approver-authority generations, so an in-flight handler cannot escape invalidation or become
  valid after the state is restored.
- Public-identity and server-secret rotation must revoke OAuth artifacts and close OAuth streams without interrupting
  the separately authorized static MCP streams.
- Complete bootstrap-time NestJS/Fastify route registration behind one runtime gate; enable/disable must not depend on
  unsupported post-listen route mounting or unmounting.
- Atomic production activation only after expiry, revocation, approver-lifecycle, public-identity/server-secret
  rotation, live-scope-reduction, switch-off, admin, audit, and rate-limit controls pass the readiness gate.
- Reverse-proxy path prefixes without trusting forwarded headers.
- Coexistence of static URN-audience credentials and OAuth HTTPS-resource credentials.

## Live Codex evidence

The Phase 6 smoke against Codex CLI `0.136.0` established the following current host profile:

- pre-registration works with `codex mcp add --url <resource> --oauth-client-id <client-id>` followed by
  `codex mcp login <name>`; the persisted client ID is stored under the server's nested `oauth.client_id` setting;
- with `mcp_oauth_callback_port = 41456`, Codex uses a stable per-server callback path such as
  `http://127.0.0.1:41456/callback/YCvSk6oijOs3`, so that exact path must be pre-registered while the loopback port may
  vary under the RFC 8252 rule;
- Codex discovers the resource and sends the RFC 8707 `resource` automatically. Configuring `--oauth-resource` to the
  same URI duplicates the authorization parameter in `0.136.0`, so the explicit override must be omitted for this
  server profile;
- Codex omits `scope` from its authorization request. Smart Panel therefore defaults an omitted scope to the capability
  scopes in the pre-registered client ceiling and still requires explicit owner/admin consent. It does not default
  `offline_access`, because renewable access must be explicitly requested; and
- Codex CLI `0.136.0` exposes client-ID and resource overrides, while neither its help nor the current official MCP
  configuration reference exposes an explicit OAuth scope setting. This host version therefore cannot request
  `offline_access`, and Smart Panel must not silently broaden the omitted request merely to manufacture a refresh
  token; and
- behind TLS termination, the proxy must be listed in `FB_MCP_OAUTH_TRUSTED_PROXIES` and must send
  `X-Forwarded-Proto: https`. The finite bootstrap gate validates the immediate peer before the provider honors that
  protocol for secure interaction cookies.

Discovery, authorization, token exchange, tool listing, and a read-only `get_home_context` call succeeded with a client
ceiling of `mcp:read offline_access`. Codex exposed only read tools under that ceiling and received no refresh token
because its request omitted `offline_access`. Administrative revocation remains to be exercised with this host. The
Codex refresh subcase remains open until a supported Codex release can explicitly request `offline_access`; refresh
rotation continues to be exercised through the protocol client and the Claude Code target instead of weakening the
server's scope policy.

## Primary references

- [MCP authorization, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP 2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Claude Code MCP OAuth configuration](https://code.claude.com/docs/en/mcp)
- [OpenAI MCP authentication guidance](https://developers.openai.com/plugins/build/auth)
- [`oidc-provider` implemented specifications](https://github.com/panva/node-oidc-provider)
