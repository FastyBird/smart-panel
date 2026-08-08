# Smart Panel MCP OAuth Authorization — Implementation Plan

**Status:** Phase 0 complete — architecture proposed for review

**Task:** [TECH-MCP-OAUTH-AUTHORIZATION](../technical/TECH-MCP-OAUTH-AUTHORIZATION.md)

**Architecture:** [ADR 0002: Embedded OAuth Authorization for Remote MCP](../../docs/adr/0002-mcp-oauth-authorization.md)

**Compatibility evidence:** [MCP OAuth Compatibility Spike](../../docs/mcp-oauth-compatibility-spike.md)

> Read this plan, the task, ADR 0001, ADR 0002, and the compatibility spike before changing code. Keep phases in order
> and checkboxes current. Do not add authorization endpoints until ADR 0002 is accepted. Never edit generated OpenAPI
> clients by hand.

## Goal and boundaries

Add standards-compliant, browser-mediated OAuth access to the existing curated MCP resource while preserving static
bearer access for trusted LAN/VPN clients. OAuth remains MCP-only, disabled by default, and bounded by the current live
module/client/tool policy.

This plan does not expose REST APIs through OAuth, add external identity providers, enable DCR, or remove static MCP
credentials.

## Phase 0 — Compatibility spike and architecture

**Deliverables:** documentation only; no dependency or runtime behavior change.

- [x] Record exact current MCP/OAuth revisions and distinguish the OAuth 2.1 draft from final RFCs.
- [x] Reconcile the static installation URN audience with MCP's canonical HTTPS OAuth resource identifier.
- [x] Verify documented OAuth configuration paths for Codex and Claude Code.
- [x] Decide initial client registration policy: owner/admin pre-registration; defer CIMD and DCR.
- [x] Survey the official MCP SDK resource-server helpers and an established authorization-server candidate.
- [x] Document embedded versus external authorization-server consequences, including deployment, recovery, consent,
      revocation, upgrades, rollback, and threat model.
- [x] Split implementation into reviewable security phases.

**Gate:** ADR 0002 must be accepted before Phase 1. Review disagreement or a failed dependency spike returns to this
phase; it does not authorize an improvised OAuth implementation.

## Phase 1 — Authorization-component executable spike

**Goal:** Prove the selected established component can be safely embedded before schema or endpoint work expands.

- [ ] Pin a candidate authorization-server dependency only after checking its current security support and license.
- [ ] Mount it in a test-only NestJS/Fastify application without a second listener and without a catch-all route.
- [ ] Resolve the backend CommonJS versus dependency ESM boundary in production build and Jest.
- [ ] Provide a minimal TypeORM-backed adapter; reject in-memory persistence outside tests.
- [ ] Prove authorization code plus PKCE `S256`, RFC 8252 redirect matching, `resource`, response `iss`, opaque tokens,
      rotation, reuse detection, and revocation.
- [ ] Snapshot metadata, explicitly advertise only public-client authentication method `none`, and verify disabled
      dependency features are not advertised.
- [ ] Prove Smart Panel can own the authenticated login/consent interaction without exposing passwords to the OAuth
      component.
- [ ] Add focused tests for code replay, PKCE downgrade, issuer/resource mismatch, exact non-loopback redirects,
      accepted ephemeral ports on loopback IP literals, and rejected address/path changes on loopback redirects.

**Gate:** If any required behavior needs handwritten protocol replacement or unsupported dependency internals, stop and
amend ADR 0002.

## Phase 2 — Persistent domain foundation and public URL policy

**Goal:** Add inactive OAuth data/configuration foundations without publishing incomplete discovery.

- [ ] Add an incremental migration for OAuth clients, grants, authorization interactions/codes, access tokens, refresh
      token families, and server-secret/key version metadata.
- [ ] Add MCP-owned entities and services with raw artifacts hashed at creation.
- [ ] Add an explicit HTTPS public base URL and OAuth-enabled configuration, both disabled by default.
- [ ] Derive resource, issuer, well-known, authorization, token, and revocation URLs only from trusted configuration.
- [ ] Reject forwarded headers unless a separately explicit trusted-proxy policy validates the immediate proxy.
- [ ] Add a distinct OAuth MCP principal/token type and prove rejection by REST, WebSocket, display, user, personal, and
      static-MCP validation paths.
- [ ] Add unit tests for expiry, family rotation/reuse, installation binding, public URL changes, and log redaction.

## Phase 3 — Authorization, consent, and token endpoints

**Goal:** Complete the browser flow behind the disabled OAuth configuration flag.

- [ ] Add owner/admin client pre-registration APIs with exact redirect validation except the RFC 8252 runtime-port rule
      for native loopback IP literals, and no public client secret.
- [ ] Implement authorization code plus mandatory PKCE `S256`, required `resource`, response `iss`, single-use codes,
      and protocol-correct OAuth errors through the selected component.
- [ ] Implement token exchange and optional `offline_access` refresh with rotation/reuse detection; advertise
      `offline_access` in `scopes_supported` without enabling OIDC identity scopes or ID tokens.
- [ ] Implement RFC 7009 revocation for supported token types.
- [ ] Add Admin login/consent UI showing installation, client, redirect, requested scopes, expiry, and physical-device
      warnings.
- [ ] Require fresh consent for new client/redirect, expanded scopes, expired grants, and revoked grants.
- [ ] Add CSRF/interaction binding, throttling, cache-control, and redaction tests.

## Phase 4 — Discovery, challenges, and MCP resource validation

**Goal:** Enable a complete standards surface atomically; never advertise half-built endpoints.

- [ ] Publish path-aware RFC 9728 protected-resource metadata for the canonical MCP resource.
- [ ] Publish path-aware RFC 8414 authorization-server metadata containing only implemented capabilities.
- [ ] Add RFC 6750 `WWW-Authenticate` challenges with `resource_metadata` and minimum scopes.
- [ ] Require exact issuer/resource/audience/client/installation/expiry/grant/token validation for OAuth bearer tokens.
- [ ] Keep static URN-audience validation working through its existing isolated path.
- [ ] Map `mcp:read`, `mcp:write`, and `mcp:trigger` to the four-way live capability intersection.
- [ ] Return protocol-correct 401 versus 403 scope challenges and recheck scopes before every tool execution.
- [ ] Add discovery/challenge snapshots and wrong-token-type, issuer, resource, audience, cross-client, and scope
      negative tests.

## Phase 5 — Administration and immediate invalidation

**Goal:** Give owners/admins complete lifecycle control without secret exposure.

- [ ] Add list/inspect/disable/revoke APIs for OAuth clients, grants, access tokens, and refresh families.
- [ ] Add Admin client/grant/token management views and revoke confirmations.
- [ ] Bind OAuth subscriptions to client, grant, access-token, optional refresh-family IDs, and access-token expiry.
- [ ] Close only the matching subscriptions before client, grant, access-token, or refresh-family revocation reports
      success, and automatically close each stream when its access token expires.
- [ ] Handle `UsersModule.User.Updated` and `UsersModule.User.Deleted`: when a grant approver is deleted or no longer
      has owner/admin role, revoke every grant and token artifact they approved and close matching subscriptions;
      preserve grants for profile-only updates by an authorized approver.
- [ ] Close all MCP subscriptions when the module is disabled or its public OAuth identity rotates.
- [ ] Add revoke-all recovery action and document password-reset versus OAuth-revocation semantics.
- [ ] Add audit events and unit/e2e coverage for targeted and global invalidation.
- [ ] Regenerate OpenAPI/admin types through the normal generators.

## Phase 6 — E2E, proxy, and compatibility gate

**Goal:** Prove the complete security profile before documenting it as supported.

- [ ] E2E: discovery, consent approval/denial, PKCE success/failure, RFC 8252 loopback port variation, strict redirect
      rejection otherwise, code replay, scope reduction, expiry, refresh rotation/reuse, revocation, wrong
      issuer/resource/audience, cross-client isolation, and redaction; cover open-stream abort on token expiry and
      client/grant/access-token/refresh-family revocation, plus approver demotion/deletion invalidation.
- [ ] Reverse-proxy E2E: explicit external prefix, hostile forwarded headers, untrusted proxy, trusted proxy, public URL
      change, and rollback.
- [ ] Codex smoke: discovery, authorization, list/call, refresh, scope failure, and revocation; record exact version and
      callback profile.
- [ ] Claude Code smoke: the same sequence; record exact version and callback profile.
- [ ] Repeat static bearer compatibility tests to prove coexistence.
- [ ] Use MCP Inspector/TypeScript client for wire-level negative cases that user hosts do not expose.

## Phase 7 — Deployment, incident response, and rollout

**Goal:** Ship OAuth as an opt-in remote-access profile with a reversible operational path.

- [ ] Document HTTPS and explicit public URL requirements, supported proxy layouts, client pre-registration, Codex and
      Claude setup, consent, and migration from static credentials.
- [ ] Document backup sensitivity, clone handling, server-secret rotation, revoke-all, compromise response, and account
      recovery.
- [ ] Document dependency upgrades, metadata diffs, smoke-test requirements, rollback, and static-profile retention.
- [ ] Confirm no DCR/CIMD endpoints are advertised and create explicit follow-up tasks if the release gate justifies
      either feature.
- [ ] Update task acceptance criteria and mark completion only after every deferred item has a named follow-up.

## Required verification cadence

Every implementation phase runs the focused backend/Admin tests it changes plus:

```bash
pnpm --filter ./apps/backend run type-check
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend run test:unit
pnpm --filter ./apps/backend run test:e2e
pnpm --filter ./apps/admin run type-check
pnpm --filter ./apps/admin run lint:js
pnpm --filter ./apps/admin run test:unit
```

Run OpenAPI generation and API lint in phases that change administrative API schemas. Phase 6 additionally runs the
two recorded external-host smoke profiles.
