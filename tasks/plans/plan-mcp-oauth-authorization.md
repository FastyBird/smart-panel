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
      atomic refresh rotation under concurrent reuse, family revocation, and token revocation.
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
- [ ] Add an explicit HTTPS public base URL configuration, but no user-settable OAuth enable switch yet.
- [ ] Derive resource, issuer, well-known, authorization, token, and revocation URLs only from trusted configuration.
- [ ] Reject forwarded headers unless a separately explicit trusted-proxy policy validates the immediate proxy.
- [ ] Add a distinct OAuth MCP principal/token type and prove rejection by REST, WebSocket, display, user, personal, and
      static-MCP validation paths.
- [ ] Implement refresh rotation as a TypeORM compare-and-consume transaction with a conditional consumed-state update
      and unique predecessor/successor constraint: at most one concurrent request creates a successor, and every loser
      revokes the whole family including that successor.
- [ ] Add unit tests for access-token expiry capped at grant expiry, sequential and barrier-synchronized concurrent
      family rotation/reuse, installation binding, public URL changes, and log redaction.

## Phase 3 — Authorization, consent, and token endpoints

**Goal:** Complete the browser flow behind an internal test-only gate; production routes remain unmounted.

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

## Phase 4 — Gated discovery, challenges, and MCP resource validation

**Goal:** Complete and test the standards surface without making it reachable in production.

- [ ] Publish path-aware RFC 9728 protected-resource metadata for the canonical MCP resource.
- [ ] Publish path-aware RFC 8414 authorization-server metadata containing only implemented capabilities.
- [ ] Add RFC 6750 `WWW-Authenticate` challenges with `resource_metadata` and minimum scopes.
- [ ] Require exact issuer/resource/audience/client/installation/expiry/grant/token validation for OAuth bearer tokens,
      including the grant approver's current owner/admin role.
- [ ] Keep static URN-audience validation working through its existing isolated path.
- [ ] Map `mcp:read`, `mcp:write`, and `mcp:trigger` to the four-way live capability intersection.
- [ ] Return protocol-correct 401 versus 403 scope challenges and recheck scopes before every tool execution.
- [ ] Add discovery/challenge snapshots and wrong-token-type, issuer, resource, audience, cross-client, and scope
      negative tests.
- [ ] Keep OAuth well-known, authorization, token, revocation, and OAuth-bearing MCP paths absent from production until
      Phase 5 adds the complete bootstrap-time gated route set; do not attempt runtime route mounting, and leave the
      existing static bearer behavior unchanged with no user-settable OAuth enable switch.

## Phase 5 — Administration and immediate invalidation

**Goal:** Complete every invalidation/admin control, then expose the full OAuth surface atomically.

- [ ] Add list/inspect/disable/revoke APIs for OAuth clients, grants, access tokens, and refresh families.
- [ ] Add Admin client/grant/token management views and revoke confirmations.
- [ ] Bind OAuth subscriptions to client, grant, access-token, optional refresh-family IDs, and an authorization
      deadline equal to the earlier of access-token or grant expiry; also record their effective scopes and the
      generations of the module/client/grant authorization inputs that produced them.
- [ ] Serialize subscription registration and invalidation through one authoritative generation gate: atomically
      recheck the OAuth-enabled and artifact/authorization-input generations plus live scopes while registering, and
      increment or close the applicable gate before an invalidating mutation enumerates streams. A racing open must
      either register first and be closed or observe the new generation and fail/revalidate.
- [ ] Serialize every grant, authorization-code, access-token, and refresh-token creation/rotation with OAuth
      switch-off: conditionally commit the artifact and its captured enabled generation only while the persistent gate
      remains open at that generation. Switch-off must atomically close and increment the generation first, so a racing
      handler either commits before revoke-all or its stale commit fails.
- [ ] Close only the matching subscriptions before client, grant, access-token, or refresh-family revocation reports
      success, and automatically close each stream at its authorization deadline.
- [ ] Route module-ceiling, registered-client-maximum, and approved-grant scope reductions through an awaited
      authoritative mutation path that closes every OAuth subscription whose effective scope set contracts before
      reporting success, including removal of `mcp:write` or `mcp:trigger` while `mcp:read` remains; do not rely on the
      existing asynchronous MCP configuration notification listener.
- [ ] Replace fire-and-forget approver invalidation with an awaited lifecycle path for `UsersModule.User.Updated` and
      `UsersModule.User.Deleted`: when a grant approver is deleted or no longer has owner/admin role, revoke every grant
      and token artifact they approved and close matching subscriptions before the user mutation returns success;
      propagate invalidation failures and preserve grants for profile-only updates by an authorized approver.
- [ ] Close all MCP subscriptions when the module is disabled or its public OAuth identity rotates; on OAuth
      server-secret rotation, revoke every OAuth artifact and close every OAuth subscription.
- [ ] Add revoke-all recovery action and document password-reset versus OAuth-revocation semantics.
- [ ] Add audit events and unit/e2e coverage for targeted and global invalidation.
- [ ] Prove user update/delete promises remain pending until approver invalidation and stream closure finish, propagate
      invalidation failure, and never leave a demoted/deleted approver's grant usable.
- [ ] Regenerate OpenAPI/admin types through the normal generators.
- [ ] Add the user-facing OAuth enable switch only after startup verifies authorization-deadline timers, targeted
      artifact and live-scope-reduction subscription aborts, awaited approver lifecycle invalidation,
      serialized subscription-open/invalidation and artifact-issuance gates, public-identity/server-secret rotation,
      OAuth switch-off invalidation, revoke controls, audit hooks, and rate limits are registered; fail closed and keep
      the shared OAuth route gate closed if any readiness check fails.
- [ ] Register the complete protected-resource metadata, authorization-server metadata,
      authorization/token/revocation, challenge, and OAuth MCP route set once during NestJS/Fastify bootstrap. Every
      route must check the same fail-closed gate before its handler; never mount or unmount routes after startup.
- [ ] On enable, rerun readiness and open the shared gate for the complete pre-registered OAuth surface atomically;
      never expose a partial subset.
- [ ] On switch-off, atomically close and increment the persistent OAuth generation before handlers can commit more
      artifacts, revoke all OAuth artifacts, and abort all OAuth subscriptions before reporting success; preserve
      static MCP credentials and streams, remain fail-closed if invalidation fails, and require a new authorization
      flow after readiness-gated re-enable.

## Phase 6 — E2E, proxy, and compatibility gate

**Goal:** Prove the complete security profile before documenting it as supported.

- [ ] E2E: discovery, consent approval/denial, PKCE success/failure, RFC 8252 loopback port variation, strict redirect
      rejection otherwise, code replay, scope reduction, expiry, refresh rotation/reuse, revocation, wrong
      issuer/resource/audience, cross-client isolation, and redaction; cover open-stream abort on token expiry and
      grant expiry, client/grant/access-token/refresh-family revocation, awaited approver demotion/deletion
      invalidation, global server-secret rotation, and each module/client/grant scope reduction that removes a stream's
      effective read, write, or trigger scope.
- [ ] E2E: pause a listen request after authentication, complete a matching artifact revocation or scope reduction,
      then resume registration and prove the stale request cannot open after invalidation success.
- [ ] E2E: submit the same refresh token concurrently behind a synchronization barrier; prove at most one successor is
      stored, the reuse loser revokes the entire family including that successor, and no fork remains usable.
- [ ] E2E: switch OAuth off with active OAuth and static subscriptions; prove new OAuth traffic is rejected and OAuth
      streams and artifacts are invalidated before success while static streams remain open, then prove re-enable
      reruns readiness and old OAuth artifacts remain unusable.
- [ ] E2E: pause authorization, code-exchange, and refresh handlers immediately before artifact commit, switch OAuth
      off, then resume them; prove each stale-generation commit fails, no late artifact escapes revoke-all, and none
      becomes usable after re-enable.
- [ ] E2E: start disabled, enable without restarting, disable without restarting, and re-enable; prove the
      bootstrap-registered route set is uniformly unreachable/reachable behind one gate and never partially exposed.
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
