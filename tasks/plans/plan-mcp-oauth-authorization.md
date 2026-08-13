# Smart Panel MCP OAuth Authorization — Implementation Plan

**Status:** Phase 6 in progress — security-profile E2E, external-host, and wire-level gates remain

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

- [x] Pin a candidate authorization-server dependency only after checking its current security support and license.
- [x] Mount it in a test-only NestJS/Fastify application without a second listener and without a catch-all route.
- [x] Resolve the backend CommonJS versus dependency ESM boundary in production build and Jest.
- [x] Provide a minimal TypeORM-backed adapter; reject in-memory persistence outside tests.
- [x] Prove authorization code plus PKCE `S256`, RFC 8252 redirect matching, `resource`, response `iss`, opaque tokens,
      atomic refresh rotation under concurrent reuse, family revocation, and token revocation.
- [x] Snapshot metadata, explicitly advertise only public-client authentication method `none`, and verify disabled
      dependency features are not advertised.
- [x] Prove Smart Panel can own the authenticated login/consent interaction without exposing passwords to the OAuth
      component.
- [x] Add focused tests for code replay, PKCE downgrade, issuer/resource mismatch, exact non-loopback redirects,
      accepted ephemeral ports on loopback IP literals, and rejected address/path changes on loopback redirects.

**Gate:** If any required behavior needs handwritten protocol replacement or unsupported dependency internals, stop and
amend ADR 0002.

## Phase 2 — Persistent domain foundation and public URL policy

**Goal:** Add inactive OAuth data/configuration foundations without publishing incomplete discovery.

- [x] Add an incremental migration for OAuth clients, grants, authorization interactions/codes, access tokens, refresh
      token families, and server-secret/key version metadata.
- [x] Add MCP-owned entities and services with raw artifacts hashed at creation.
- [x] Add an explicit HTTPS public base URL configuration, but no user-settable OAuth enable switch yet.
- [x] Derive resource, issuer, well-known, authorization, token, and revocation URLs only from trusted configuration.
- [x] Reject forwarded headers unless a separately explicit trusted-proxy policy validates the immediate proxy.
- [x] Add a distinct OAuth MCP principal/token type and prove rejection by REST, WebSocket, display, user, personal, and
      static-MCP validation paths.
- [x] Implement refresh rotation as a TypeORM compare-and-consume transaction with a conditional consumed-state update
      and unique predecessor/successor constraint: at most one concurrent request creates a successor, and every loser
      revokes the whole family including that successor.
- [x] Add unit tests for access-token expiry capped at grant expiry, sequential and barrier-synchronized concurrent
      family rotation/reuse, installation binding, public URL changes, and log redaction.

## Phase 3 — Authorization, consent, and token endpoints

**Goal:** Complete the browser flow behind an internal test-only gate; production routes remain unmounted.

- [x] Add owner/admin client pre-registration APIs with exact redirect validation except the RFC 8252 runtime-port rule
      for native loopback IP literals, and no public client secret.
- [x] Implement authorization code plus mandatory PKCE `S256`, required `resource`, response `iss`, single-use codes,
      and protocol-correct OAuth errors through the selected component.
- [x] Implement token exchange and optional `offline_access` refresh with rotation/reuse detection; advertise
      `offline_access` in `scopes_supported` without enabling OIDC identity scopes or ID tokens.
- [x] Implement RFC 7009 revocation for supported token types.
- [x] Add Admin login/consent UI showing installation, client, redirect, requested scopes, expiry, and physical-device
      warnings.
- [x] Require fresh consent for new client/redirect, expanded scopes, expired grants, and revoked grants.
- [x] Add CSRF/interaction binding, throttling, cache-control, and redaction tests.

## Phase 4 — Gated discovery, challenges, and MCP resource validation

**Goal:** Complete and test the standards surface without making it reachable in production.

- [x] Publish path-aware RFC 9728 protected-resource metadata for the canonical MCP resource.
- [x] Publish path-aware RFC 8414 authorization-server metadata containing only implemented capabilities.
- [x] Add RFC 6750 `WWW-Authenticate` challenges with `resource_metadata` and minimum scopes.
- [x] Require exact issuer/resource/audience/client/installation/expiry/grant/token validation for OAuth bearer tokens,
      including the grant approver's current owner/admin role.
- [x] Keep static URN-audience validation working through its existing isolated path.
- [x] Map `mcp:read`, `mcp:write`, and `mcp:trigger` to the four-way live capability intersection.
- [x] Return protocol-correct 401 versus 403 scope challenges and recheck scopes before every tool execution.
- [x] Add discovery/challenge snapshots and wrong-token-type, issuer, resource, audience, cross-client, and scope
      negative tests.
- [x] Keep OAuth well-known, authorization, token, revocation, and OAuth-bearing MCP paths absent from production until
      Phase 5 adds the complete bootstrap-time gated route set; do not attempt runtime route mounting, and leave the
      existing static bearer behavior unchanged with no user-settable OAuth enable switch.

## Phase 5 — Administration and immediate invalidation

**Goal:** Complete every invalidation/admin control, then expose the full OAuth surface atomically.

### Phase 5a — Administrative artifact identity foundation

- [x] Add stable, non-secret management IDs for provider artifacts without exposing raw tokens or token hashes.
- [x] Add stable refresh-family IDs shared by rotated refresh tokens and their associated access tokens.
- [x] Backfill deployed provider artifacts through an incremental migration and preserve the original schema on rollback.
- [x] Prove management IDs survive provider upserts, family IDs survive refresh rotation, and raw artifacts remain absent
      from persistence and management identifiers.

### Phase 5b — Targeted subscription invalidation foundation

- [x] Carry the non-secret refresh-family management ID into the validated OAuth principal.
- [x] Bind internal OAuth subscription records to client, grant, access-token, optional refresh-family, and
      authorization-deadline identities while preserving the static subscription path.
- [x] Add targeted client/grant/access-token/refresh-family and OAuth-only closure primitives.
- [x] Automatically abort OAuth streams at their authorization deadline and audit expiry versus revocation distinctly.

### Phase 5c — Validated OAuth subscription binding

- [x] Carry the stable access-token management ID, exact authorization deadline, effective OAuth scopes, and current
      module/client/grant authorization generations through the validated OAuth principal.
- [x] Fail closed when the persistent module-policy generation state is unavailable.
- [x] Register OAuth listen streams under the validated internal client and artifact identities while preserving the
      existing static subscription registration path.
- [x] Record effective scopes and module/client/grant generations on the internal OAuth subscription binding for the
      authoritative registration/invalidation gate.

### Phase 5d — Authoritative subscription gate foundation

- [x] Serialize OAuth subscription revalidation/registration and generation-advancing invalidation through one
      exclusive registry boundary while leaving static registration independent.
- [x] Revalidate the raw OAuth access token inside that boundary immediately before registration and pass the refreshed
      scopes, generations, and authorization deadline into MCP server creation.
- [x] Require targeted and OAuth-global invalidation callers to finish their generation advance before matching
      subscriptions are enumerated and closed; propagate advance failures without partially closing streams.
- [x] Prove both race orderings with barriers: a registration that wins is subsequently closed, while a registration
      queued behind invalidation revalidates only after the generation advances.

### Phase 5e — Administrative artifact controls

- [x] Add list/inspect/disable/revoke APIs for OAuth clients, grants, access tokens, and refresh families.
- [x] Add Admin client/grant/token management views and revoke confirmations.
- [x] Close only the matching subscriptions before client, grant, access-token, or refresh-family revocation reports
      success, and automatically close each stream at its authorization deadline.
- [x] Regenerate OpenAPI/admin types through the normal generators.

### Phase 5f — Awaited module capability-ceiling invalidation

- [x] Add a generic awaited module-configuration mutation registry so module-owned security barriers can wrap the
      existing validated configuration commit without coupling the Config module to MCP.
- [x] Route MCP capability changes through the authoritative OAuth subscription gate, advance the persistent
      module-policy generation before commit, and propagate generation failures without changing configuration or
      closing streams.
- [x] Close only OAuth streams whose recorded effective scope set exceeds the new module ceiling while preserving
      unaffected OAuth streams and every static MCP stream; if configuration persistence fails after the generation
      advances, close the contracted streams before propagating the error so the failure remains fail-closed.
- [x] Prove a racing OAuth registration queued behind the mutation revalidates only after the new configuration is
      committed, and prove unchanged capability updates bypass the generation barrier.

### Phase 5g — Awaited approved-grant scope invalidation

- [x] Add an owner/admin reduction-only grant-scope API and Admin editor that cannot add scopes without a new consent;
      preserve `offline_access` because removing refresh authority requires grant revocation and artifact invalidation.
- [x] Advance the grant generation with a conditional update inside the authoritative OAuth subscription gate and
      propagate conflicts without closing streams.
- [x] Close only subscriptions bound to the updated grant whose recorded effective scopes exceed the new approval,
      preserving unaffected OAuth and static streams.
- [x] Prove a racing registration queued behind grant reduction observes the updated scopes and generation, while a
      registration that wins the gate is closed when its effective scope contracts.

### Phase 5h — Awaited approver lifecycle invalidation

- [x] Add durable per-approver authority generations, backfill existing grant generations, and require live access-token
      validation to match the grant's captured approver generation.
- [x] Add a generic awaited user-lifecycle mutation registry; wrap owner/admin demotion or deletion and OAuth
      invalidation in one transaction while preserving authorized profile updates.
- [x] Serialize consent grant commit and approver invalidation through the authoritative OAuth gate so consent either
      commits first and is revoked or observes the new role/generation and fails.
- [x] Atomically advance approver authority, revoke every matching grant and provider artifact, then close only OAuth
      subscriptions approved by that user; preserve unrelated OAuth and static streams even when failures propagate.
- [x] Keep the OAuth gate held through the user-row commit so failed demotions roll back with invalidation and consent
      queued behind deletion observes the removed user before it can create a grant.

### Phase 5i — Authoritative artifact request gate foundation

- [x] Serialize bounded provider authorization, token, refresh, and revocation request processing through the same
      authoritative OAuth mutation gate used by artifact and policy invalidation.
- [x] Keep provider-grant persistence, the matching Smart Panel grant, and authorization-code completion inside the
      approver-authority gate so demotion cannot interleave between consent and code issuance.
- [x] Prove both gate orderings deterministically: provider work that commits first is visible to the following
      invalidation, while provider work queued behind invalidation observes the advanced authorization state and fails.

### Phase 5j — Durable authorization-generation snapshot foundation

- [x] Persist the OAuth-enabled, server-secret, public-identity, client, and module-policy generations captured by each
      approved grant, with an incremental migration that safely backfills existing grants.
- [x] Persist the complete applicable grant and authorization-input generation snapshot on authorization-code,
      access-token, and refresh-token provider artifacts without storing raw bearer values.
- [x] Fail provider artifact lookup/issuance and resource-server access-token validation when any captured generation is
      unavailable or differs from live state, so advancing a generation permanently prevents stale artifact reuse.
- [x] Backfill existing linked bearer artifacts and prove all seven generation dimensions fail closed after advancement.

### Phase 5k — Complete subscription authorization binding

- [x] Carry the validated OAuth-enabled, server-secret, and public-identity generations from the access-token snapshot
      into the internal OAuth principal and stored subscription binding.
- [x] Require every global and targeted authorization generation in the internal OAuth subscription identity, failing
      closed before registration when any generation is missing or malformed.
- [x] Reverify the bearer artifact, live scopes, authorization deadline, and complete generation snapshot inside the
      same authoritative gate used by artifact and policy invalidation before registering the stream.
- [x] Prove a racing registration either opens before invalidation and is closed or runs after generation advancement
      and fails revalidation, while static MCP subscriptions remain outside the OAuth gate.

### Phase 5l — Awaited public-identity invalidation

- [x] Add one reusable global OAuth invalidation transaction that advances selected persistent generations, revokes all
      active grants, tombstones their provider identities, and deletes every provider and legacy OAuth artifact.
- [x] Route changes to the canonical OAuth public base URL through that transaction before the configuration mutation
      reports success, advancing module-policy generation in the same transaction when both inputs change.
- [x] Close every OAuth subscription after revocation while preserving static MCP subscriptions; if configuration
      persistence fails, reload configuration but keep the advanced generation, revoked artifacts, and closed streams.
- [x] Prove queued provider work cannot enter the authoritative gate until identity advancement and revocation finish,
      and prove missing persistent generation state prevents commit, revocation, and stream closure.

### Phase 5m — Revoke-all recovery control

- [x] Add an explicit owner/admin revoke-all action that advances the authorization-server security epoch before
      revoking every OAuth grant and artifact and closing every OAuth subscription.
- [x] Preserve registered OAuth clients plus every static MCP credential and stream so recovery invalidates only the
      browser-mediated OAuth authorization profile.
- [x] Add the Admin recovery confirmation and explain that resetting a Smart Panel password does not revoke existing
      OAuth access.
- [x] Audit successful global recovery without recording bearer, provider, cookie, or signing-key material, and
      propagate invalidation failures without reporting or auditing success.

### Phase 5n — Awaited MCP module disable invalidation

- [x] Route MCP module disable through the authoritative global OAuth invalidation transaction, advancing the
      OAuth-enabled generation before revoking every OAuth grant and artifact.
- [x] Hold one close-all gate across invalidation and configuration persistence, reject new static and OAuth stream
      registrations after disable begins, and close both profiles before reporting success.
- [x] Combine simultaneous public-identity and module-policy changes into the same invalidation transaction, and keep
      the advanced generations, revoked artifacts, and closed streams when configuration persistence fails.
- [x] Reconcile installations disabled before the awaited mutation existed by invalidating legacy OAuth state before
      re-enable, preventing old bearer artifacts from becoming usable when the module becomes active again.
- [x] Preserve OAuth-only stream closure for public identity changes while proving only MCP module disable closes
      static MCP streams.

### Phase 5o — Complete browser artifact issuance gate

- [x] Serialize login completion and denial with every OAuth invalidation through the same authoritative gate used by
      provider token/code issuance and subscription registration.
- [x] Move consent context resolution, replay claiming, grant persistence, and provider continuation inside the
      awaited approver-authority gate so no browser artifact can commit from pre-invalidation state.
- [x] Recheck the live MCP enabled state, registered-client maximum, and module capability ceiling inside that gate;
      a queued approval must fail after disable or scope contraction without consuming consent or creating a grant.
- [x] Prove browser issuance that wins the gate finishes before invalidation enumeration, while work queued behind an
      invalidation observes current authorization inputs before any artifact commit.

### Phase 5p — Automatic invalidation audit coverage

- [x] Define one structured, secret-free audit event for automatic OAuth authorization invalidation with allowlisted
      reasons, affected authorization profile, outcome, and an optional internal target identifier.
- [x] Audit module disable, legacy re-enable reconciliation, public-identity change, module-policy change, and
      approver-authority invalidation only after their awaited security mutation completes.
- [x] Record configuration-persistence failure as a partial outcome when generation advancement, artifact revocation,
      and stream closure still completed; do not report an event when invalidation itself failed.
- [x] Add unit coverage for successful, partial, and failed automatic invalidation audit behavior; retain end-to-end
      audit verification for the Phase 6 security-profile suite.

### Phase 5q — Fail-closed readiness and shared route gate foundation

- [x] Define one immutable readiness inventory for authorization-deadline and targeted subscription aborts, live-scope
      contraction, awaited approver lifecycle invalidation, subscription and artifact issuance gates, global rotation,
      switch-off, administrative revocation, audit, endpoint throttling, and the complete bootstrap route set.
- [x] Register only controls backed by completed services during module initialization, then seal the inventory at
      application bootstrap so late or partial registration cannot make OAuth reachable.
- [x] Add one shared runtime route gate that cannot open before successful complete readiness verification and make the
      embedded provider inaccessible while that gate is closed.
- [x] Prove incomplete readiness stays closed and explicitly reports the remaining switch-off, endpoint-rate-limit,
      and complete-route-set controls without exposing any production OAuth route.

### Phase 5r — Embedded OAuth endpoint rate limits

- [x] Add separate authorize, token, and revocation budgets at the raw embedded-provider boundary, before request-body
      parsing and the serialized artifact mutation gate.
- [x] Key raw provider budgets only from the immediate socket peer and ignore forwarded headers until explicit trusted
      proxy handling exists; use one conservative shared bucket when the immediate address is unavailable.
- [x] Return a bounded `429` OAuth error with `Retry-After`, `no-store`, and `no-cache`, without entering provider
      processing or recording artifact state.
- [x] Register endpoint throttling in the sealed readiness inventory while keeping OAuth closed because switch-off
      invalidation and the complete bootstrap route set are still absent.

### Phase 5s — OAuth switch-off invalidation foundation

- [x] Add one internal switch-off coordinator that synchronously closes the shared route gate and deactivates the
      embedded provider before starting persistent invalidation; never reopen the gate automatically after failure.
- [x] Block new provider activation after deactivation and cancel in-flight activation by generation so no provider
      created during or after switch-off can be reused until an explicit internal re-enable step allows activation.
- [x] Advance the persistent OAuth-enabled generation through the authoritative global invalidation boundary, revoke
      all OAuth artifacts, and close only OAuth subscriptions while preserving static MCP streams.
- [x] Audit completed and configuration-persistence-partial switch-off outcomes without reporting success when
      invalidation itself fails, and register the coordinator in the sealed readiness inventory. The complete route
      set remains the only missing readiness control, so the user-facing switch stays absent.

### Phase 5t — Complete bootstrap OAuth route-set foundation

- [x] Install one finite OAuth router before Fastify begins listening, register readiness only after the complete hook
      is installed, and reject duplicate registration so enable/disable never mounts or unmounts routes.
- [x] Register only the path-aware protected-resource and bounded authorization-server metadata projections plus the
      explicit authorization/resume, token, and revocation provider routes; keep dependency discovery, registration,
      and every unrelated provider route unreachable.
- [x] Preserve the existing static MCP request path while selecting isolated OAuth bearer verification only when the
      shared gate is open; apply the same proxy and Host/Origin policy, authenticated request budget, minimum read
      scope, and RFC 6750 challenge boundary.
- [x] Prove every registered OAuth route returns one uniform fail-closed response while the gate is closed, public path
      prefixes are remapped only from trusted runtime URLs, static dispatch remains unchanged, and the provider's full
      PKCE/refresh/revocation security spike still passes. Keep the user-facing switch absent until activation and
      switch-off are wired through configuration.

### Phase 5u — Persistent OAuth provider material foundation

- [x] Generate the provider's private cookie and RSA signing material once inside the owner-only `FB_CONFIG_PATH`,
      which is already covered by the system backup boundary; publish the completed file atomically without
      overwriting material created by a concurrent process.
- [x] Validate the complete versioned material shape on every cold load, tighten existing file permissions to `0600`,
      reject symlinks and malformed or incomplete files, and fail closed without replacing unreadable material.
- [x] Wire non-test provider activation to defensive copies of the persistent material while preserving explicitly
      isolated ephemeral test setup. Keep the user-facing switch absent until configuration lifecycle activation and
      invalidation are wired through the shared readiness and route gates.

### Phase 5v — Readiness-gated OAuth configuration lifecycle

- [x] Add the opt-in `oauth_enabled` configuration field and Admin control with an explicit canonical HTTPS public
      identity prerequisite and deployment warning; keep the static MCP profile independently configurable.
- [x] At startup, activate the persistent provider and open the complete pre-registered OAuth route set only after the
      sealed readiness inventory passes twice; log activation failure and keep OAuth closed without aborting the rest
      of the application. A global configuration reset also closes the gate and deactivates the provider immediately.
- [x] Serialize authoritative MCP configuration mutations. On enable, advance the persistent OAuth generation and
      revoke legacy artifacts before activating and opening; on switch-off or module disable, close/deactivate first,
      advance every changed generation, persist, revoke, and close the correct OAuth-only or all-profile streams.
- [x] Close/deactivate around a live public-identity change and reopen only after invalidation, persistence, readiness,
      and provider reactivation succeed. Any failed mutation or activation remains fail-closed and never restores old
      artifacts on a later retry.

### Remaining Phase 5 controls

- [x] Bind OAuth subscriptions to client, grant, access-token, optional refresh-family IDs, and an authorization
      deadline equal to the earlier of access-token or grant expiry; also record their effective scopes and the
      generations of the module/client/grant authorization inputs that produced them.
- [x] Serialize subscription registration and invalidation through one authoritative generation gate: atomically
      recheck the OAuth-enabled and artifact/authorization-input generations plus live scopes while registering, and
      increment or close the applicable gate before an invalidating mutation enumerates streams. A racing open must
      either register first and be closed or observe the new generation and fail/revalidate.
- [x] Serialize every grant, authorization-code, access-token, and refresh-token creation/rotation with every
      invalidating mutation. Conditionally commit against the captured OAuth-enabled, server-secret, public-identity,
      client, grant, module-policy, and approver-authority generations and current states. Each invalidation must advance
      its generation before enumeration, so a racing handler either commits first and is revoked or its stale commit
      fails; validation must recheck all generations so later restoration cannot revive an escaped artifact.
- [x] Route module-ceiling, registered-client-maximum, and approved-grant scope reductions through awaited
      authoritative mutation paths that close every OAuth subscription whose effective scope set contracts before
      reporting success, including removal of `mcp:write` or `mcp:trigger` while `mcp:read` remains.
- [x] Replace fire-and-forget approver invalidation with an awaited lifecycle path for `UsersModule.User.Updated` and
      `UsersModule.User.Deleted`: when a grant approver is deleted or no longer has owner/admin role, atomically advance
      their authority generation before revoking every grant and token artifact they approved and closing matching
      subscriptions. A paused consent using the old generation must fail, role restoration must not revive old grants,
      invalidation failures propagate, and profile-only updates by an authorized approver preserve the generation.
- [x] Close all MCP subscriptions only when the MCP module is disabled. On public OAuth identity or server-secret
      rotation, advance the applicable artifact generation before revoke-all, revoke every OAuth artifact, and close
      every OAuth subscription while preserving static MCP credentials and streams.
- [x] Add revoke-all recovery action and document password-reset versus OAuth-revocation semantics.
- [x] Add audit events and unit/e2e coverage for targeted and global invalidation, including structured provider-backed
      E2E assertions that raw authorization codes, access tokens, and refresh tokens are never recorded.
- [x] Prove user update/delete promises remain pending until approver invalidation and stream closure finish, propagate
      invalidation failure, and never leave a demoted/deleted approver's grant usable.
- [x] Add the user-facing OAuth enable switch only after startup verifies authorization-deadline timers, targeted
      artifact and live-scope-reduction subscription aborts, awaited approver lifecycle invalidation,
      serialized subscription-open/invalidation and all-generation artifact-issuance gates,
      public-identity/server-secret rotation, OAuth switch-off invalidation, revoke controls, audit hooks, and rate
      limits are registered; fail closed and keep the shared OAuth route gate closed if any readiness check fails.
- [x] Register the complete protected-resource metadata, authorization-server metadata,
      authorization/token/revocation, challenge, and OAuth MCP route set once during NestJS/Fastify bootstrap. Every
      route must check the same fail-closed gate before its handler; never mount or unmount routes after startup.
- [x] On enable, rerun readiness and open the shared gate for the complete pre-registered OAuth surface atomically;
      never expose a partial subset.
- [x] On switch-off, atomically close and increment the persistent OAuth generation before handlers can commit more
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
- [x] Provider-backed E2E: deny consent through the production interaction service, return an issuer-bound
      `access_denied` callback with the original state, consume the interaction against replay, and persist no grant,
      authorization code, access token, or refresh token.
- [x] TypeScript client wire E2E: reject access when the persisted grant has the wrong issuer or resource, or the
      provider access token has the wrong audience or cross-client binding, without recording the raw bearer.
- [x] TypeScript wire E2E: return bounded RFC 6750 discovery challenges for missing or malformed authorization and a
      valid token without effective read scope, using 401/403 correctly and never reflecting or logging credentials.
- [x] TypeScript client wire E2E: reject provider access tokens with the wrong grant, account, installation, unknown
      scope, or stored artifact model, preserve later valid authorization, and never log the raw bearer.
- [x] Provider-backed wire E2E: independently contract a client's ceiling to remove effective write or trigger scope
      while retaining read, then remove read; close each active subscription before success, reject bearer reuse,
      preserve each reduced grant, and redact every token.
- [x] Provider-backed wire E2E: independently contract active grants to remove effective write or trigger scope while
      retaining read; close each subscription before success, reject bearer reuse, preserve each reduced grant, and
      redact both tokens.
- [x] Provider-backed wire E2E: independently contract the module ceiling to remove effective write or trigger scope
      while retaining read; close each subscription before success, reject bearer reuse, and redact both tokens.
- [x] E2E: pause a listen request after authentication, complete a matching artifact revocation or scope reduction,
      then resume registration and prove the stale request cannot open after invalidation success.
- [x] Provider-backed wire E2E: close an active OAuth subscription at the access-token authorization deadline and
      record `authorization_expired` rather than treating expiry as administrative revocation.
- [x] Provider-backed wire E2E: close an active OAuth subscription at the grant authorization deadline and record
      `authorization_expired` rather than treating expiry as administrative revocation.
- [x] Provider-backed wire E2E: revoke an active access token through the management service, close its live
      subscription as `authorization_revoked`, delete only that token artifact, reject subsequent bearer reuse, and
      preserve a sibling token's live stream and the grant.
- [x] Provider-backed wire E2E: revoke an active grant through the management service, close its live subscription as
      `authorization_revoked`, delete its provider artifacts, and reject subsequent bearer reuse.
- [x] Provider-backed wire E2E: revoke an active refresh family through the management service, close its live
      subscription as `authorization_revoked`, delete every family artifact, reject subsequent bearer reuse, and
      preserve the grant.
- [x] Provider-backed wire E2E: disable an active client, close only its live subscription, revoke its grants and
      provider artifacts, reject subsequent bearer reuse, and preserve an unrelated client's stream and artifacts.
- [x] E2E: submit the same refresh token concurrently behind a synchronization barrier; prove at most one successor is
      stored, the reuse loser revokes the entire family including that successor, and no fork remains usable.
- [x] E2E: switch OAuth off with active OAuth and static subscriptions; prove new OAuth traffic is rejected and OAuth
      streams and artifacts are invalidated before success while static streams remain open, then prove re-enable
      reruns readiness and old OAuth artifacts remain unusable.
- [x] Provider integration E2E: pause authorization, code-exchange, and refresh handlers immediately before artifact
      commit, initiate switch-off, then prove the public route gate closes immediately while switch-off waits for the
      serialized handler; after resume, prove revoke-all removes every returned artifact before reporting success and
      none becomes usable after re-enable. Complement this commit-first branch with adapter-level stale-generation
      rejection coverage so both allowed serialization outcomes are exercised.
- [x] E2E: repeat the barrier-synchronized artifact-commit race for server-secret rotation, public-identity rotation,
      client disable/re-enable, grant revocation, module/client/grant scope contraction/expansion, and approver
      demotion/restoration; prove stale commits fail and later state restoration never revives an artifact.
  - [x] Provider integration: cover server-secret and public-identity rotation against paused token handlers; prove each
        rotation waits for the serialized commit, revokes its returned artifacts before success, and restoring the old
        public identity never revives them.
  - [x] Provider integration: disable a client against a paused token handler, then re-enable it; prove disable waits,
        revokes the returned artifacts before success, restoration never revives them, and a fresh authorization flow
        succeeds with the advanced client generation.
  - [x] Provider integration: revoke a grant against a paused refresh handler; prove revocation waits, removes the
        returned successor artifacts before success, and a replacement grant works without reviving the revoked one.
  - [x] Provider integration: contract the module ceiling against a paused write-scoped refresh, then expand it; prove
        contraction waits, the committed successor is permanently invalid, and fresh write authorization works after
        expansion with the advanced policy generation.
  - [x] Provider integration: contract a client's scope ceiling against a paused write-scoped refresh, then expand it;
        prove contraction waits, the committed successor is permanently invalid, and fresh write authorization works
        with the advanced client generation.
  - [x] Provider integration: contract a grant against a paused write-scoped refresh; prove contraction waits, the
        committed successor is permanently invalid, in-place scope expansion is rejected, and fresh write consent
        creates a replacement grant without reviving the contracted artifacts.
  - [x] Provider integration: demote an approver against a paused refresh, then restore the role; prove demotion waits,
        advances authority and revokes the grant and committed successor, restoration never revives stale artifacts,
        and fresh authorization binds a usable grant to the advanced authority generation.
- [x] Provider integration E2E: rotate the public OAuth identity and server secret with simultaneous OAuth and static
      subscriptions; prove only OAuth artifacts/streams are invalidated and static streams remain open. Separately
      prove MCP-module disable closes both kinds.
- [x] E2E: start disabled, enable without restarting, disable without restarting, and re-enable; prove the
      bootstrap-registered route set is uniformly unreachable/reachable behind one gate, never partially exposed, and
      replaces the deactivated provider runtime before reopening.
- [x] E2E: prove readiness-gated re-enable never makes OAuth artifacts issued before switch-off usable again.
- [x] Reverse-proxy E2E: explicit external prefix, hostile forwarded headers, untrusted proxy, trusted proxy, public URL
      change, and rollback.
- [ ] Codex smoke: discovery, authorization, list/call, refresh, scope failure, and revocation; record exact version and
      callback profile.
- [ ] Claude Code smoke: the same sequence; record exact version and callback profile.
- [x] Repeat static bearer compatibility tests to prove coexistence. The static endpoint list/call suite and the
      simultaneous static-plus-OAuth lifecycle E2E exercise the production authentication and policy guards, including
      OAuth switch-off/re-enable while the static stream remains usable.
- [x] Use the pinned official TypeScript client `2.0.0` for wire-level negative cases that user hosts do not expose:
      token-binding and stored-claim rejection, expiry and revocation stream closure, scope contraction, listen/
      invalidation races, OAuth switch-off/re-enable, and static-profile isolation. Use direct HTTP and service-level
      verification where the client hides OAuth callbacks, challenge headers, or persisted bearer state, and record the
      scenario-to-test matrix in the compatibility evidence.

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
