# MCP OAuth Compatibility Spike

**Status:** Complete for architecture selection; live interoperability remains a release gate

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

The next phase must prove that a pinned release mounts safely on the existing NestJS/Fastify server, uses the TypeORM
adapter rather than in-memory state, emits only the enabled OAuth features in metadata, and can delegate login/consent
to authenticated Smart Panel owner/admin UI. If it cannot, the phase stops for another architecture review; it must not
fall back to handwritten OAuth endpoints.

The official MCP TypeScript SDK v2 already provides resource-server building blocks for bearer verification,
standards-shaped challenges, protected-resource metadata, and `AuthInfo`. Those helpers do not implement an
authorization server and therefore do not remove the need for the component spike.

## Risks to prove with live tests

- Callback URI formats for current Codex and Claude Code releases, including an ephemeral loopback IP port.
- RFC 8414 discovery for an issuer containing a path component.
- `resource` propagation at authorization, code exchange, and refresh.
- `iss` presence in both successful and error authorization responses.
- Refresh-token rotation and reuse-family revocation.
- Immediate denial and subscription closure after client, grant, access-token, or refresh-family revocation and at
  access-token expiry.
- Reverse-proxy path prefixes without trusting forwarded headers.
- Coexistence of static URN-audience credentials and OAuth HTTPS-resource credentials.

## Primary references

- [MCP authorization, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP 2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Claude Code MCP OAuth configuration](https://code.claude.com/docs/en/mcp)
- [OpenAI MCP authentication guidance](https://developers.openai.com/plugins/build/auth)
- [`oidc-provider` implemented specifications](https://github.com/panva/node-oidc-provider)
