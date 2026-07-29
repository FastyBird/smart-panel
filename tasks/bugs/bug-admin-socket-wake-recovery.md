# Task: Recover websocket connection and data freshness after computer sleep
ID: BUG-ADMIN-SOCKET-WAKE-RECOVERY
Type: bug
Scope: admin
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to trust what the admin panel shows me after my computer wakes from sleep
As an administrator
I want the websocket connection to recover on its own and the visible data to be refreshed, without me having to navigate to another route and back

## 2. Context

### Reported symptom

Open `/stats`, put the computer to sleep, wake it up. The connection indicator on the
Application overview card shows **disconnected** and stays that way. Navigating to any
other route and back shows **connected** again. Data rendered from websocket events is
also stale, because nothing processed the events that were emitted while the machine slept.

### Root cause

Two separate pieces of logic run **only** inside `router.beforeEach`:

1. Session/token refresh — `apps/admin/src/modules/auth/router/hooks/session.hook.ts:46-71`
2. Socket connect — `apps/admin/src/modules/auth/auth.module.ts:130-153`

The access token TTL is one hour (`DEFAULT_TOKEN_EXPIRATION` in `apps/backend/src/app.constants.ts:13`).

For a sleep longer than the token TTL the sequence is:

1. No navigation happens while asleep, so nothing refreshes the access token.
   `sockets.auth.token` still holds the token captured at the last navigation.
2. On wake, `socket.io-client` auto-reconnects using that now-expired token.
3. The backend rejects it — `WsAuthService.validateClient` fails and
   `WebsocketGateway.handleConnection` calls `client.disconnect()`
   (`apps/backend/src/modules/websocket/gateway/websocket.gateway.ts:91`).
4. The client receives `disconnect` with reason `io server disconnect`. In
   `socket.io-client` v4 that path runs `Socket.destroy()`, which unsubscribes the
   manager listeners specifically to *avoid* reconnections, leaving `socket.active === false`.
   **Auto-reconnect is permanently disabled for the rest of the page's life.**
5. The UI keeps showing disconnected. Any route change runs the guards again, which
   refresh the token and call `sockets.connect()` — which is why navigating "fixes" it.

A plain `window.focus` listener that only calls `sockets.connect()` would **not** fix this,
because it would reconnect with the same stale token and be rejected again. The session must
be refreshed first.

### Secondary problem

Even when the token is still valid and the reconnect succeeds, every event emitted during the
sleep window is lost. `socket.io` does not replay missed events, and the admin has no
refetch-on-reconnect anywhere. Stores therefore keep pre-sleep data until the user navigates.

### Relevant existing code

- `apps/admin/src/common/services/sockets.ts` — `SocketsPlugin`, creates the `io()` instance with `autoConnect: false`.
- `apps/admin/src/common/composables/useSockets.ts` — exposes the reactive `connected` / `active` refs.
- `apps/admin/src/modules/stats/components/application-overview.vue:79` — renders the indicator.
- 13 modules/plugins subscribe via `sockets.on('event', …)` in their `install()`.
- `apps/admin/src/common/composables/useFlashMessage.ts` — `ElNotification` wrapper, the project's toast convention.

## 3. Scope

**In scope**

- Recover the socket connection automatically when the tab becomes visible / regains focus / the browser reports back online.
- Refresh the session before reconnecting, so recovery works after the access token has expired.
- Re-fetch already-loaded store data after a *re*connect, so the user does not read stale values.
- Surface a toast when recovery fails.
- Unit tests for the new services/composables.

**Out of scope**

- `apps/backend/src/modules/websocket/gateway/websocket.gateway.ts:88-92` is missing a `return`
  after `client.disconnect()`, so a rejected client still joins rooms, logs "Client connected"
  and emits `CLIENT_CONNECTED`. Tracked separately, to be fixed in its own PR.
- Active liveness probing (ping/ack) to detect half-open connections that the browser still
  reports as connected. We trust `socket.connected`.
- Replaying missed events. We re-fetch instead.
- Refreshing parameterized/nested collections (channels-by-device, properties-by-channel).
  See "Known limitations".

## 4. Acceptance criteria

- [ ] With the tab left on `/stats`, a sleep longer than the access-token TTL followed by a wake restores the indicator to **connected** without navigating.
- [ ] Recovery refreshes the session first, so it succeeds even when the access token expired during sleep.
- [ ] Recovery triggers on `visibilitychange` (to visible), `window` `focus`, and `window` `online`, coalesced so one wake does not fire it repeatedly.
- [ ] Recovery is a no-op when the socket is already connected.
- [ ] After a *re*connect, every module re-fetches the data it had already loaded.
- [ ] The **first** connect after app start does not trigger a re-fetch (views already fetch on mount).
- [ ] A module whose refresh handler throws does not prevent the other modules from refreshing.
- [ ] Concurrent refresh runs are collapsed into one.
- [ ] When recovery fails (backend down, refresh token expired), an error toast is shown via `useFlashMessage` and the indicator stays disconnected.
- [ ] The connect-and-authenticate logic is defined once and shared by the router guard and the recovery path.
- [ ] Unit tests cover the registry, the recovery composable, and the reconnect-vs-first-connect distinction.
- [ ] `pnpm --filter ./apps/admin run lint:js`, `type-check` and `test:unit` all pass.

## 5. Example scenarios

### Scenario: Wake after a long sleep

Given the admin is open on `/stats` and the access token has expired during sleep
When the machine wakes and the tab becomes visible
Then the session is refreshed, the socket reconnects with the new token, the indicator shows connected, and every already-loaded store re-fetches its data

### Scenario: Wake after a short sleep

Given the admin is open on `/stats` and the access token is still valid
When the machine wakes and the tab becomes visible
Then the socket reconnects and already-loaded stores re-fetch, so events missed during the sleep are reconciled

### Scenario: Tab focused while already connected

Given the socket is connected
When the user switches back to the tab
Then nothing happens — no reconnect, no re-fetch, no requests

### Scenario: Recovery fails

Given the backend is unreachable
When the machine wakes and recovery is attempted
Then an error toast is shown, the indicator stays disconnected, and the next focus/visibility event retries

## 6. Technical constraints

- Follow the existing `common/services` + `common/composables` structure; export through the existing barrels.
- Do not introduce new dependencies.
- Do not modify generated code (`openapi.ts`).
- Reuse `useFlashMessage` for the toast; add the message to all six locale files.
- Tests are expected for all new logic (Vitest).

## 7. Implementation hints

### 7.1 Shared connect logic

Extract the body of the sockets router guard (`auth.module.ts:130-153`) into
`apps/admin/src/common/services/socket-connection.ts`:

```ts
ensureSocketConnection(sockets, sessionStore): Promise<boolean>
```

It refreshes the session when the access token is expired, sets `sockets.auth = { token }`
and calls `sockets.connect()`. The router guard then calls this same function, so the
auth handshake lives in exactly one place.

### 7.2 Refresh registry

New `apps/admin/src/common/services/data-refresh.ts`:

```ts
refreshRegistry.register(key, handler: () => Promise<void>): void
refreshRegistry.refreshAll(): Promise<void>   // errors isolated per handler, concurrent runs collapsed
```

Each module registers its handler in `install()`, next to its existing `sockets.on('event', …)`
subscription. Handlers guard on `firstLoadFinished()` so a wake never fetches data the user
never opened.

### 7.3 Recovery composable

New `apps/admin/src/common/composables/useConnectionRecovery.ts`, installed once at app root
(not per-view, so it works on whichever route the user parked on). It listens for
`visibilitychange` / `focus` / `online`, coalesces them, and on trigger:

- if `sockets.connected` → no-op
- else → `ensureSocketConnection()`; on failure show the error toast

Re-fetching hangs off the socket `connect` event rather than the recovery trigger, so it also
covers reconnects that socket.io recovers on its own. A flag distinguishes the first connect
from later ones.

## 8. Known limitations

Parameterized stores (channels for a device, properties for a channel) are not blanket-refreshed;
each module refreshes its top-level collections and nested collections stay view-driven.
Making those fully consistent needs per-module decisions and is deliberately left out of this task.

## 9. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to `apps/admin`.
- For each acceptance criterion, either implement it or explain why it is skipped.
