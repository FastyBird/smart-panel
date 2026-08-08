# Task: Add standards-compliant OAuth authorization for remote MCP

ID: TECH-MCP-OAUTH-AUTHORIZATION
Type: technical
Scope: backend, admin
Size: large
Parent: Smart Panel MCP Module
Status: planned

## 1. Business goal

In order to connect standards-compliant remote MCP hosts without distributing static installation credentials,
as a Smart Panel owner,
I want MCP protected-resource discovery and an OAuth 2.1 authorization flow suitable for explicitly secured remote
access.

## 2. Context

- The initial MCP release supports Streamable HTTP with a preconfigured static bearer token for trusted LAN or VPN
  deployments.
- The MCP resource is installation-local at `/api/v1/modules/mcp` and uses the stable audience
  `urn:fastybird:smart-panel:<installation-uuid>:mcp`.
- `docs/adr/0001-mcp-protocol-and-security-foundation.md` deliberately defers public-internet authorization.
- `apps/backend/src/modules/mcp/` owns MCP policy, endpoint authentication, clients, subscriptions, and auditing.
- Existing user, personal-access-token, display-token, and MCP static-token flows must remain isolated.

Before implementation, add an ADR that chooses whether Smart Panel acts as the authorization server or delegates to a
supported external identity provider. The choice must include deployment, account-recovery, consent, revocation, and
upgrade consequences.

## 3. Scope

**In scope**

- MCP protected-resource metadata and authorization-server discovery.
- OAuth 2.1 authorization-code flow with PKCE (`S256`) for supported remote MCP clients.
- Resource/audience binding, finite access tokens, refresh-token policy, revocation, and scope-to-capability mapping.
- Consent UI and owner/admin controls needed to approve, inspect, and revoke OAuth clients or grants.
- Protocol-correct `401` challenges that identify the protected-resource metadata.
- Compatibility tests against supported OAuth-capable MCP hosts and reverse-proxy deployments.
- Migration and coexistence guidance for the initial installation-local static bearer clients.

**Out of scope**

- Making the full REST/OpenAPI surface available through OAuth or MCP.
- Password, implicit, or resource-owner-password credential grants.
- Reusing user, display, personal-access, or static MCP tokens as OAuth access tokens.
- Treating OAuth as a substitute for HTTPS, trusted-proxy configuration, rate limiting, or tool-level authorization.
- Enabling direct public exposure by default.

## 4. Acceptance criteria

- [ ] An ADR documents the authorization-server architecture and a threat model for internet-reachable MCP.
- [ ] The MCP endpoint publishes standards-compliant protected-resource metadata with its canonical resource identifier
      and authorization-server location.
- [ ] Unauthenticated MCP responses include a protocol-correct bearer challenge pointing clients to protected-resource
      metadata without leaking installation or credential secrets.
- [ ] Authorization-server metadata is standards compliant and advertises only implemented endpoints, response types,
      grant types, PKCE methods, scopes, and signing algorithms.
- [ ] Authorization uses the code flow with PKCE `S256`, exact redirect-URI matching, state validation, short-lived
      codes, and replay prevention.
- [ ] Access tokens are finite, issuer/resource/audience bound, revocable, and rejected by ordinary REST, WebSocket,
      display, and personal-access-token paths.
- [ ] OAuth scopes map to the curated `read`, `write`, and `trigger` capabilities and remain bounded by the live module
      ceiling and approved grant.
- [ ] Consent clearly names the installation, requesting client, redirect destination, expiry, and physical-device
      impact of write/trigger scopes.
- [ ] Owners/admins can list and revoke OAuth clients, grants, access tokens, and refresh tokens; revocation closes the
      affected MCP subscriptions immediately.
- [ ] Dynamic client registration is implemented only if required by supported target hosts and protected by an
      explicit registration policy; otherwise the supported registration path is documented.
- [ ] Trusted reverse-proxy behavior is explicit and tested; forwarded headers are ignored unless the proxy is
      configured as trusted.
- [ ] Static bearer clients continue to work for trusted LAN/VPN deployments until a separately documented removal or
      migration policy is approved.
- [ ] E2E tests cover discovery, consent, PKCE success/failure, redirect validation, scope reduction, expiry, refresh,
      revocation, wrong issuer/resource/audience, cross-client isolation, and log redaction.
- [ ] At least two supported OAuth-capable MCP hosts complete discovery, authorization, tool listing, tool execution,
      refresh, and revocation smoke tests.
- [ ] Public deployment documentation requires HTTPS and provides reverse-proxy, key rotation, backup, incident
      response, and rollback guidance.

## 5. Example scenarios

### Scenario: A remote host discovers and authorizes read-only access

Given MCP is enabled with `read`
and the host has no Smart Panel credential
when it connects to the MCP resource
then it discovers the protected-resource and authorization-server metadata
and the owner can approve a read-only grant using authorization code plus PKCE
and the resulting access token cannot call write or trigger tools.

### Scenario: A grant is revoked while subscribed

Given an OAuth client has an active MCP subscription
when an owner revokes its grant
then its access and refresh tokens stop working immediately
and only that client's active subscription streams are closed.

## 6. Technical constraints

- Follow the current MCP policy, client-isolation, audit, and subscription boundaries.
- Use current final OAuth/MCP standards and record exact revisions in the ADR before implementation.
- Keep signing keys and client secrets in the existing secure-storage conventions; never log or return them after their
  one-time delivery point.
- Use incremental migrations only; never edit `1000000000008-AddMcpClients.ts`.
- Do not introduce an authorization dependency until the ADR and compatibility spike justify it.
- Do not edit generated OpenAPI clients manually.

## 7. Implementation hints

- Keep resource-server validation independent from interactive consent and authorization-server concerns.
- Reuse the effective-capability intersection so an existing token cannot retain a scope removed from module config.
- Preserve the installation UUID as stable identity while deriving externally visible URLs only from explicit trusted
  configuration.
- Treat dynamic registration and refresh tokens as separate risk decisions, not automatic consequences of adding
  discovery metadata.

## 8. AI instructions

- Read this file and the MCP plan/ADR completely before making code changes.
- Start with the compatibility spike and ADR; do not implement endpoints before the architecture is approved.
- Keep security-sensitive changes split into reviewable phases with focused negative tests.
- For each acceptance criterion, implement it or explain why it remains deferred.
- Respect global rules from `AGENTS.md` and `/.ai-rules/GUIDELINES.md` when present.
