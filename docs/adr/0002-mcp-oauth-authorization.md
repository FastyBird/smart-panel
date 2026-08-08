# ADR 0002: Embedded OAuth Authorization for Remote MCP

**Status:** Proposed

**Date:** 2026-08-08

**Scope:** Remote authorization for the Smart Panel MCP module

## Context

The first MCP release deliberately uses installation-local static bearer credentials for trusted LAN or VPN access.
Remote MCP hosts need a browser-mediated authorization flow so an owner does not have to copy a bearer secret into
every host.

Smart Panel is normally a self-contained appliance. It already owns local users, owner/admin authentication, account
recovery, the MCP capability ceiling, MCP client policy, targeted subscription closure, and the administrative UI. A
generic external identity provider can authenticate a person, but it cannot by itself apply Smart Panel's live
`read`/`write`/`trigger` ceiling, show device-impact consent, or immediately close installation-local subscriptions.
Requiring an external provider would also make a standalone installation dependent on another service for login and
recovery.

The standards and client findings used here are recorded in
[the compatibility spike](../mcp-oauth-compatibility-spike.md).

## Decision

### 1. Authorization-server placement

Smart Panel will host an embedded, MCP-specific OAuth authorization server. It will delegate user authentication and
account recovery to the existing Smart Panel auth/users modules, but it will own OAuth clients, grants, codes, access
tokens, refresh tokens, consent, and revocation.

This is not a general Smart Panel identity provider:

- it issues tokens only for the curated MCP resource;
- only existing owners and administrators may approve grants;
- OAuth tokens are rejected by REST, WebSocket, display, user-session, personal-token, and static MCP-token paths; and
- password, implicit, client-credentials, device-code, and resource-owner-password grants are not enabled.

An established authorization-server component must implement the protocol state machine. Smart Panel will provide its
persistence adapter, interaction UI, policy hooks, audit hooks, and resource-server verifier. The executable dependency
spike must pass before a dependency is pinned or endpoints are added. Failure returns this ADR to review; it does not
authorize a handwritten OAuth server.

An external authorization server remains a future deployment option, not a transparent runtime switch. Supporting one
would require another ADR that defines issuer trust, user-to-installation mapping, grant administration, revocation,
and recovery behavior.

### 2. Standards profile

The implementation targets MCP authorization revision `2026-07-28` and `draft-ietf-oauth-v2-1-13`, supplemented by
RFC 9700. It implements RFC 6750, RFC 7009, RFC 7636, RFC 8252, RFC 8414, RFC 8707, RFC 9207, and RFC 9728 where
applicable.

The only initial interactive flow is authorization code with PKCE `S256`. Codes are single-use and expire after at
most 60 seconds. Redirect URIs use exact string matching except for the runtime port of native loopback IP literals, as
required by RFC 8252. Authorization responses include `iss`, including error responses, and metadata advertises
`authorization_response_iss_parameter_supported: true`.

Metadata advertises only features that are actually enabled. It explicitly advertises `none` as the sole initial
token-endpoint authentication method and lists `offline_access` in `scopes_supported` because the refresh policy below
implements its explicit-consent semantics. No OIDC identity scopes (`openid`, `profile`, `email`, or similar), ID
tokens, user-info endpoint, introspection endpoint, JWKS URI, signing algorithm, confidential-client authentication
method, or registration endpoint is advertised merely because the selected dependency can implement it.

### 3. Canonical URLs and resource binding

OAuth can be enabled only after an owner configures an exact public base URL over HTTPS. A reverse-proxy path prefix is
allowed. Smart Panel derives all public OAuth URLs from that stored value, never from Host, Origin, `Forwarded`, or
`X-Forwarded-*` request headers.

For a base such as `https://panel.example.com`, identifiers are:

- resource: `https://panel.example.com/api/v1/modules/mcp`;
- protected-resource metadata:
  `https://panel.example.com/.well-known/oauth-protected-resource/api/v1/modules/mcp`;
- issuer: `https://panel.example.com/api/v1/modules/mcp/oauth`; and
- authorization-server metadata:
  `https://panel.example.com/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth`.

The RFC 8707 `resource` value is required and must match exactly at authorization and token exchange. OAuth access
tokens are accepted only when their stored issuer, resource/audience, client, installation UUID, expiry, grant state,
and scopes all match the current request.

The existing static MCP credential audience
`urn:fastybird:smart-panel:<installation-uuid>:mcp` remains unchanged. Static and OAuth credentials have separate token
types and validation paths. Changing the public base URL immediately invalidates outstanding OAuth tokens because their
resource and issuer no longer match; it does not change the installation UUID or static credential audience.

### 4. Client registration

The first release uses owner/admin pre-registration. A public client receives a generated client ID, no client secret,
and a redirect URI allowlist. HTTPS redirects and `localhost` hostname redirects match exactly. Native `http` redirects
using the loopback IP literals `127.0.0.1` or `[::1]` match scheme, literal address, path, query, and trailing slash
exactly but accept any runtime port, as required by RFC 8252 section 7.3. Codex and Claude Code both document the
predefined-client configuration path.

CIMD is the preferred direction in MCP `2026-07-28`, but is deferred until its draft revision and outbound metadata
fetch controls are proven compatible. DCR is deprecated by the current MCP revision and is not required by the two
initial hosts, so no dynamic registration endpoint is implemented or advertised.

If live compatibility testing proves DCR necessary, it requires a separate security decision covering registration
rate limits, redirect policy, client quotas, lifetime, cleanup, and administrative approval. It must not be silently
enabled as a dependency feature.

### 5. Tokens, grants, and scope policy

OAuth artifacts use independent entities and token-type discriminators. They do not reuse `AuthService` access tokens,
personal tokens, display tokens, or static MCP tokens.

The initial token policy is:

- opaque, high-entropy access tokens stored only as hashes, with a maximum lifetime of 10 minutes;
- opaque refresh tokens stored only as hashes, issued only when `offline_access` is explicitly requested and consented;
- refresh rotation on every use with reuse detection that revokes the entire token family;
- a maximum refresh-family lifetime of 30 days;
- a maximum grant lifetime of 90 days, with no “never expires” option; and
- immediate database-backed revocation checks for every MCP request.

Opaque access tokens are intentional: they make immediate per-token and per-grant revocation authoritative without a
signing-key distribution problem. Issuer, resource/audience, client, installation, scopes, expiry, and token-family
bindings are stored server-side. Authorization-server metadata therefore advertises no signing algorithms unless a
later accepted change actually introduces a signed artifact.

OAuth scopes are `mcp:read`, `mcp:write`, `mcp:trigger`, and `offline_access`. `offline_access` is advertised and
consented only to control refresh eligibility; it is not an OIDC login request or an MCP capability. Omitting it means
the token endpoint returns no refresh token. Effective authorization remains:

```text
module capability ceiling
  ∩ registered client maximum
  ∩ approved grant scopes
  ∩ access-token scopes
```

The intersection is recomputed for every request and immediately before tool execution. Scope reduction never waits
for access-token expiry.

### 6. Login, consent, and recovery

The authorization endpoint creates a short-lived interaction and sends the browser to the Admin application. The
Admin application uses the existing Smart Panel login flow. Only an authenticated owner or administrator can continue.
The OAuth component never receives or validates the user's password.

Consent must show:

- installation name and stable installation ID;
- requesting client name and client ID;
- exact redirect destination;
- each requested capability in plain language;
- an explicit physical-device warning for write or trigger access;
- access and refresh/grant expiry; and
- approve and deny actions without a preselected escalation.

Authentication is not consent. Reauthorization can reuse an active Smart Panel login, but a new client, new redirect,
broader scope set, or expired/revoked grant requires a fresh consent decision.

Account recovery remains the existing owner recovery procedure, including `auth:reset`. Resetting a password or user
session does not silently revoke OAuth grants. The recovery UI and runbook must offer an explicit “revoke all MCP OAuth
grants” action for suspected compromise. Deleting an approving user or changing that user to any role other than owner
or administrator revokes every grant they approved and its matching subscriptions. Disabling MCP or rotating the OAuth
server secret applies the corresponding global revocation policy.

### 7. Revocation and administrative control

Owners and administrators can list clients, grants, active access tokens, and refresh-token families without seeing raw
secrets. They can disable a client, revoke a grant, revoke a token family, or revoke one access token. Every OAuth
subscription is bound to its client, grant, access-token ID, refresh-family ID when present, and access-token expiry.
Revoking any of those artifacts aborts exactly the matching active subscriptions before the administrative mutation
reports success. The subscription registry also schedules an abort at access-token expiry, because a long-lived stream
does not re-run per-request authentication while it is open. Disabling the MCP module closes all MCP subscriptions and
denies both authorization and resource requests.

An MCP OAuth lifecycle listener handles `UsersModule.User.Updated` and `UsersModule.User.Deleted`. When the emitted user
no longer exists or no longer has the owner/admin role required to approve MCP grants, the listener revokes all grants
approved by that user and their access and refresh artifacts, then closes their matching subscriptions before the
listener reports completion. A profile-only update by an owner/admin does not revoke grants.

Client and grant mutations are audited. Logs may contain IDs, scope names, denial codes, and timestamps, but never raw
codes, access tokens, refresh tokens, PKCE verifiers, cookies, passwords, or token hashes.

### 8. Deployment and upgrades

OAuth remains disabled by default. Public deployment requires HTTPS, an explicit public base URL, trusted reverse-proxy
configuration, endpoint and login rate limits, current backups, and an incident-response procedure. Forwarded headers
remain ignored until a separately configured trusted-proxy mechanism validates the immediate proxy.

Database migrations are incremental. Authorization state uses persistent TypeORM storage; in-memory dependency adapters
are test-only. Backups contain client/grant/token metadata and therefore remain sensitive even though raw bearer values
are hashed. Restoring a cloned database requires an explicit “new installation” operation that rotates OAuth server
secrets and revokes OAuth/static MCP credentials.

The authorization dependency is pinned exactly. Minor or major upgrades require metadata snapshots, negative OAuth
tests, both target-host smoke tests, and review of newly enabled defaults. Dependency features never become public only
because an upgrade enables them internally. Rollback may disable OAuth and preserve static LAN/VPN clients; it must not
reissue or downgrade an OAuth token into a static credential.

## Threat model

| Threat | Required control |
| --- | --- |
| Authorization-code interception or replay | PKCE `S256`, 60-second single-use codes, and exact client/resource/redirect binding except the RFC 8252 loopback-IP port |
| Redirect exfiltration | Owner-created allowlist; HTTPS except native loopback redirects; only loopback IP literals may vary the port; no wildcards, fragments, or general prefix matching |
| CSRF and login/consent confusion | OAuth `state` handled by clients, same-site interaction cookies, authenticated interaction binding, explicit approve/deny |
| Authorization-server mix-up | RFC 9207 `iss` in success and error responses; exact issuer in discovery and stored artifacts |
| Token replay at another service or installation | Exact RFC 8707 resource/audience plus issuer, installation, client, and token-type validation |
| Stolen access token | Ten-minute maximum lifetime, hashed persistence, TLS, log redaction, immediate revocation check |
| Stolen/replayed refresh token | Rotation, family reuse detection, 30-day absolute lifetime, hashed persistence |
| Scope escalation or stale permission | Four-way live intersection and recheck immediately before tool execution |
| Malicious dynamic/CIMD registration | No DCR/CIMD in the initial profile; later enablement requires SSRF, quota, and redirect-policy review |
| Proxy/header spoofing and DNS rebinding | Explicit public URL, trusted Host/Origin policy, ignore forwarded headers unless proxy trust is configured |
| Client, grant, token, or refresh-family revocation with an open stream | Bind subscriptions to every authorization artifact and abort targeted streams before the mutation reports success |
| Access token expires while a stream is open | Register the token expiry with the subscription and abort the stream at that deadline |
| A grant approver is demoted or deleted | Listen for user update/delete events and revoke every grant, token artifact, and subscription approved by a user who is no longer owner/admin |
| Brute force and artifact enumeration | Separate limits for login, authorize, token, and revocation endpoints; uniform OAuth errors where required |
| Backup cloning | Preserve installation UUID for identity but rotate/revoke OAuth and static credentials for a new physical installation |
| Compromised owner/admin account | Existing login hardening, complete OAuth audit, revoke-all control, documented recovery workflow |

Out of scope are compromise of the Smart Panel host/root account, compromise of the owner's browser or MCP host, and a
malicious administrator. The operational response for those cases is credential revocation, key/secret rotation, and
restore from a trusted backup.

## Alternatives considered

### Delegate entirely to an external identity provider

Rejected for the first release. It reduces protocol implementation burden, but makes standalone deployments depend on
external availability and recovery. A generic provider also cannot own Smart Panel's device-impact consent, live
capability intersection, installation-local grant administration, or targeted subscription shutdown without a custom
broker. Such a broker would again be an authorization server and would add two authorities instead of one.

### Implement OAuth directly in NestJS services

Rejected. The code footprint may appear smaller, but protocol parsing, interaction state, replay protection, metadata,
error behavior, refresh rotation, and upgrade tracking are security-sensitive and easy to get subtly wrong.

### Reuse static MCP or user JWTs as OAuth access tokens

Rejected. It breaks credential isolation, audience semantics, revocation behavior, and the existing REST/MCP boundary.

## Consequences

- Smart Panel remains usable as a standalone installation and owns the complete consent/revocation experience.
- The backend gains persistent OAuth state and a carefully bounded authorization-server dependency.
- Owners must pre-register the first Codex/Claude clients and configure callback URIs; native loopback IP callbacks may
  select an ephemeral runtime port under RFC 8252.
- DCR's attack surface is avoided, but one-click setup for clients that cannot accept a predefined client ID is
  deferred.
- Public URL changes intentionally force OAuth reauthorization while static LAN/VPN credentials remain stable.
- OAuth can be rolled back or disabled without removing the initial static bearer profile.
- Supporting an external identity provider later is a separate architecture and migration project.

## References

- [MCP authorization, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP 2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [OAuth 2.0 Security Best Current Practice, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700)
- [OAuth 2.0 Protected Resource Metadata, RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)
- [Resource Indicators for OAuth 2.0, RFC 8707](https://www.rfc-editor.org/rfc/rfc8707)
- [OAuth 2.0 Authorization Server Issuer Identification, RFC 9207](https://www.rfc-editor.org/rfc/rfc9207)
- [ADR 0001: MCP Protocol and Security Foundation](0001-mcp-protocol-and-security-foundation.md)
