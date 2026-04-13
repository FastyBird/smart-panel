# Task: Personal Access Tokens for API access

ID: FEATURE-PERSONAL-ACCESS-TOKENS
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to integrate Smart Panel with external tools, scripts, and automations without sharing login credentials,
As an administrator,
I want to create long-lived personal access tokens (PATs) that grant API access, manage them from the admin UI, and revoke them when no longer needed.

## 2. Context

- The `LongLiveTokenEntity` already exists in the auth module with hash, owner, expiry, and revoke fields.
- The `TokensController` has full CRUD endpoints (`GET/POST/PATCH/DELETE /modules/auth/tokens`) but lacks authorization scoping — any authenticated user can see and manage all tokens.
- Display tokens use the same entity and are created as JWTs via `AuthService.generateToken()` with `ownerType: display`.
- The auth guard already validates long-lived tokens: `jwtService.verifyAsync()` → payload routing → `validateLongLiveToken()`.
- `CryptoService.generateSecureSecret()` exists for generating random values.
- The admin app has no token management UI — profile security view only shows password change.
- Reference patterns exist: display token management in admin (`view-display-tokens.vue`), display token creation in backend (`registration.service.ts`).

### Architecture decisions

- **Token format**: JWT (same as display tokens). The auth guard requires `jwtService.verifyAsync()` to pass before token-type routing. Opaque tokens would require guard changes — out of scope.
- **Token generation**: Backend generates the token (not caller-supplied). The `CreateLongLiveTokenDto` currently requires a `token` field — this needs to change for PATs.
- **Ownership model**: `LongLiveTokenEntity.tokenOwnerId` stores the user ID. No foreign key cascade exists — token cleanup on user deletion must be handled explicitly.
- **Token value exposure**: The plain token is returned exactly once in the creation response. After that, only the hash is stored.

## 3. Scope

**In scope**

### Backend

- Modify `TokensController` to scope token listing to the current user (OWNER/ADMIN can list all)
- Add a dedicated PAT creation endpoint that generates the token server-side
- Return the plain token value in the creation response (one-time only)
- Add ownership enforcement on update/delete (users can only manage their own tokens)
- Add `@Roles(UserRole.OWNER, UserRole.ADMIN)` to appropriate endpoints
- Optimize `validateLongLiveToken()` to use indexed `findOne({ where: { hashedToken } })` instead of loading all tokens
- Add `lastUsedAt` field to `LongLiveTokenEntity` and update it during validation

### Admin UI

- Add "Access Tokens" tab to the profile security view
- Token list showing: name, description, created date, last used, expiry status, revoke button
- Create token dialog: name (required), description (optional), expiry (optional: 30d, 90d, 1y, never)
- One-time token display after creation with copy-to-clipboard button and warning
- Revoke confirmation dialog
- Token management store/composable using typed OpenAPI client
- Add token operation types to `openapi.constants.ts`

**Out of scope**

- Opaque (non-JWT) token support (would require auth guard restructuring)
- Token scoping/permissions (all PATs inherit the user's role)
- Token usage analytics/audit log
- API key rotation (revoke old + create new in one operation)
- Multi-user token management UI (admin managing other users' tokens)
- Panel app changes

## 4. Acceptance criteria

### Backend

- [ ] `POST /modules/auth/tokens` generates a JWT token server-side with `ownerType: user` and returns the plain value once
- [ ] `GET /modules/auth/tokens` returns only the current user's tokens (OWNER/ADMIN can see all via query param)
- [ ] `PATCH /modules/auth/tokens/:id` allows revoking/updating only own tokens (OWNER/ADMIN can manage any)
- [ ] `DELETE /modules/auth/tokens/:id` enforces same ownership rules
- [ ] Token validation uses indexed `findOne({ where: { hashedToken } })` instead of full-table scan
- [ ] `lastUsedAt` field added to `LongLiveTokenEntity` and updated on each successful validation
- [ ] Personal access tokens authenticate API requests identically to login-based JWT tokens
- [ ] Revoking a token immediately prevents further API access
- [ ] Expired tokens are rejected by the auth guard
- [ ] Unit tests for token creation, validation, ownership enforcement, and expiry

### Admin UI

- [ ] Profile security view has an "Access Tokens" section/tab
- [ ] Token list displays name, creation date, last used date, expiry, and status
- [ ] "Create Token" button opens a dialog with name, description, and expiry fields
- [ ] After creation, the token value is displayed once with a copy button and a warning that it won't be shown again
- [ ] "Revoke" button on each token shows a confirmation dialog
- [ ] Revoked tokens disappear from the active list (or show as revoked)
- [ ] No regressions in existing auth flow (login, refresh, display tokens)

## 5. Example scenarios

### Scenario: Create a personal access token

Given the admin is on the profile security page
When they click "Create Token" and enter name "Home Assistant Integration"
And select expiry "1 year"
And click "Create"
Then a token like `eyJhbGciOiJIUzI1NiIs...` is displayed with a copy button
And a warning says "Copy this token now. You won't be able to see it again."
And the token appears in the list with name "Home Assistant Integration"

### Scenario: Use a PAT to access the API

Given a personal access token was created for user "admin"
When an external tool sends `GET /api/v1/modules/devices/devices` with header `Authorization: Bearer <token>`
Then the request is authenticated as the "admin" user
And the response contains the device list

### Scenario: Revoke a compromised token

Given the admin has a PAT named "Old Script"
When they click "Revoke" and confirm
Then the token is immediately invalidated
And any subsequent API call with that token returns 401 Unauthorized

### Scenario: Token expires

Given a PAT was created with 30-day expiry
When 31 days have passed
Then API calls with that token return 401 Unauthorized
And the token shows as "Expired" in the admin UI

## 6. Technical constraints

- Follow existing auth module patterns (`TokensController`, `TokensService`, `LongLiveTokenEntity`)
- Use JWT format for PATs (same as display tokens) — required by the auth guard
- Token generation: `authService.generateToken(user, user.role, { expiresIn })` with additional payload `{ ownerType: 'user', tokenType: 'long-live' }`
- Token hash: SHA-256 via existing `hashToken()` utility
- Pre-release migration policy: update the initial migration for `lastUsedAt` column
- Admin UI: use Element Plus components, follow existing profile view patterns
- OpenAPI: add Swagger decorators to any new/modified endpoints

## 7. Implementation hints

### Backend — PAT creation flow

```typescript
// In TokensController or a new PersonalTokensController:
async createPersonalToken(user, dto) {
    const expiresIn = dto.expiresIn || '365d';
    const rawToken = authService.generateToken(user, user.role, {
        expiresIn,
        // Additional claims to identify this as a long-lived token
    });

    const entity = new LongLiveTokenEntity();
    entity.token = rawToken;  // Will be hashed by @BeforeInsert
    entity.ownerType = TokenOwnerType.USER;
    entity.tokenOwnerId = user.id;
    entity.name = dto.name;
    entity.description = dto.description;
    entity.expiresAt = getExpiryDate(rawToken);

    await repository.save(entity);

    // Return entity WITH the plain token (one-time only)
    return { ...entity, token: rawToken };
}
```

### Backend — Optimized token lookup

```typescript
// In auth.guard.ts validateLongLiveToken():
const hashed = hashToken(token);
const tokenEntity = await tokenRepo.findOne({
    where: {
        hashedToken: hashed,
        type: TokenType.LONG_LIVE,
        revoked: false,
    },
});
// Single indexed query instead of loading all tokens
```

### Admin UI — Token list reference

Follow the pattern from `view-display-tokens.vue` for the token list. The create dialog should use `ElDialog` with a form inside, and the one-time token display should use a read-only input with a copy button.

### OpenAPI type exports

Add to `openapi.constants.ts`:
```typescript
export type AuthModuleGetTokensOperation = operations['get-auth-module-tokens'];
export type AuthModuleCreateTokenOperation = operations['create-auth-module-token'];
export type AuthModuleUpdateTokenOperation = operations['update-auth-module-token'];
export type AuthModuleDeleteTokenOperation = operations['delete-auth-module-token'];
export type AuthModuleLongLiveTokenSchema = components['schemas']['AuthModuleDataLongLiveToken'];
export type AuthModuleCreateTokenSchema = components['schemas']['AuthModuleCreateLongLiveToken'];
export type AuthModuleUpdateTokenSchema = components['schemas']['AuthModuleUpdateLongLiveToken'];
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Implement backend changes first, then admin UI.
- Use the display token management as a reference for both backend and admin patterns.
- Do NOT modify the auth guard's JWT verification flow — PATs must be JWTs.
- Update the initial migration for the `lastUsedAt` column (pre-release policy).
- Run tests after each major change.
- Respect global AI rules from GUIDELINES.md.
