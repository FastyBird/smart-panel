# Task: Security hardening phase 2 — CORS, cookies, WebSocket auth, and infrastructure

ID: TECH-SECURITY-HARDENING-PHASE2
Type: technical
Scope: backend, admin
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to safely expose Smart Panel to the internet without risking unauthorized access or data leakage,
As a system administrator,
I want the remaining security audit findings addressed — CORS restrictions, secure cookie handling, WebSocket authorization, InfluxDB authentication, and token lookup performance.

## 2. Context

A security audit identified 27 findings. Phase 1 (PR #574) addressed 9 quick fixes (JWT secret, rate limiting, password complexity, Helmet, metrics auth, registration role, error leakage, bcrypt rounds, config permissions).

This task covers the remaining actionable findings that require more careful implementation and testing.

### What was already fixed in phase 1

- C1: Auto-generate JWT secret when not configured
- C2: Rate limiting on auth endpoints (5 req/min) and global (30 req/min)
- H1: Password minimum 8 characters
- H3: Helmet security headers
- H5: Prometheus metrics requires authentication
- M2: Role removed from registration DTO
- M4: CPU usage and exception details hidden in production
- L1: bcrypt salt rounds increased to 12
- L5: Config file permissions set to 0600

## 3. Scope

**In scope**

### H2. CORS — restrict allowed origins
- Add `FB_CORS_ORIGIN` environment variable
- Default to same-origin (reject cross-origin requests)
- When set, allow only the specified origin(s)
- Apply to both HTTP API and WebSocket gateway
- Document how to configure for reverse proxy setups

### H4. Secure cookie flags for JWT tokens
- Admin SPA stores JWT tokens in cookies without HttpOnly, Secure, or SameSite flags
- Add HttpOnly and SameSite=Lax flags at minimum
- Add Secure flag when HTTPS is detected
- Evaluate moving access token to memory-only with refresh token in HttpOnly cookie
- File: apps/admin/src/modules/auth/store/session.store.ts

### H6. WebSocket exchange room authorization
- Any authenticated user can join the EXCHANGE_ROOM which receives all system events
- Add role check before allowing room join — only OWNER and ADMIN roles
- USER-role clients and display tokens should receive only events relevant to them
- File: apps/backend/src/modules/websocket/gateway/websocket.gateway.ts

### M3. InfluxDB authentication
- Install scripts create InfluxDB database without authentication
- Enable InfluxDB auth in install scripts
- Generate dedicated credentials and configure the influx-v1 plugin to use them
- Store credentials in the environment file

### L3. Token lookup performance
- Token validation fetches all tokens and iterates, comparing hashes — O(n) per request
- Change to indexed database lookup instead of iterating all tokens
- File: apps/backend/src/modules/auth/guards/auth.guard.ts

### L4. Display registration localhost check
- Localhost bypass checks request headers which could be spoofed via reverse proxy
- Check actual socket address instead of relying on forwarded headers
- File: apps/backend/src/modules/displays/controllers/registration.controller.ts

**Out of scope**

- M5: curl-pipe-bash without checksums (industry standard, document only)
- M6: Formula evaluation in device mapping transformers (separate refactor, mapping files are developer-authored)
- M7: NoNewPrivileges in systemd (requires polkit helper architecture change)
- L2: Refresh token 30-day expiry (acceptable with token rotation already in place)

## 4. Acceptance criteria

- [ ] CORS rejects cross-origin requests by default; configurable via FB_CORS_ORIGIN
- [ ] WebSocket gateway also respects CORS configuration
- [ ] JWT cookies have HttpOnly, SameSite=Lax flags; Secure when HTTPS detected
- [ ] WebSocket exchange room requires OWNER or ADMIN role
- [ ] USER-role clients cannot join the exchange room
- [ ] InfluxDB authentication enabled in install-server.sh
- [ ] InfluxDB authentication enabled in Raspbian first-boot script
- [ ] InfluxDB credentials stored in environment file and used by influx-v1 plugin
- [ ] Token validation uses indexed database lookup instead of iterating all tokens
- [ ] Display registration checks socket address, not forwarded headers
- [ ] Existing tests pass
- [ ] No regressions in admin UI authentication flow
- [ ] No regressions in panel to backend communication

## 5. Example scenarios

### Scenario: CORS blocks malicious website

Given the Smart Panel is running at http://192.168.1.100:3000
And FB_CORS_ORIGIN is not set (default: same-origin)
When a malicious website at https://evil.com makes an API request
Then the browser blocks the request due to CORS policy

### Scenario: WebSocket exchange room restricted

Given a USER-role client connects via WebSocket
When the client sends subscribe-exchange
Then the server rejects the subscription with an authorization error
And the client does not receive system events

### Scenario: InfluxDB protected after install

Given the install script completes
When an unauthenticated client tries to query InfluxDB
Then InfluxDB returns an authentication error

## 6. Technical constraints

- CORS changes must be tested with the admin SPA, panel app, and any reverse proxy setups
- Cookie changes must work with the existing vue3-cookies library in the admin SPA
- WebSocket auth changes must not break display token connections
- InfluxDB auth changes must work with both fresh installs and upgrades
- Token lookup optimization must maintain timing-safe comparison semantics

## 7. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Test CORS changes carefully — incorrect configuration will break the admin UI.
- For cookie changes, verify the admin auth flow works end-to-end.
- For WebSocket auth, check what events display tokens need to receive.
- For InfluxDB auth, ensure both install paths (script and image) are updated.
- Respect global AI rules from GUIDELINES.md.
