# Task: Authenticate websocket clients during the handshake
ID: TECH-BACKEND-WS-HANDSHAKE-AUTH
Type: technical
Scope: backend
Size: small
Parent: BUG-BACKEND-WS-UNAUTHORIZED-ADMITTED
Status: review

## 1. Business goal

In order for a client to be able to tell "you are not allowed in" from "the link dropped"
As a connecting client
I want to be refused before I am admitted, not admitted and then kicked

## 2. Context

Authentication ran in `WebsocketGateway.handleConnection`, which socket.io invokes from its
`connection` event. `_doConnect` in `socket.io/dist/namespace.js` sends the namespace CONNECT
packet *before* emitting that event, and its own comment insists on the order:

```js
socket._onconnect();                      // CONNECT packet goes out here
if (fn) fn(socket);
this.emitReserved("connect", socket);
this.emitReserved("connection", socket);  // Nest's handleConnection hangs off this
```

Refusing there therefore reached the client as `connect` followed by `disconnect`, never as
`connect_error`. Three consequences:

1. A client could not distinguish a refusal from a dropped link without waiting to see whether a
   disconnect followed. The admin has to hold its verdict for a grace window purely because of
   this — see §7.2b of `bug-admin-socket-wake-recovery.md`.
2. The window between CONNECT and the refusal is real. `WsAuthService.validateUserAccessToken`
   does two database round trips, and message handlers are dispatched independently of the
   in-flight `handleConnection`, so an unauthenticated client's messages could be processed
   before the refusal landed.
3. `handleConnection` mixed authenticating with admitting, which is how
   BUG-BACKEND-WS-UNAUTHORIZED-ADMITTED went unnoticed — a missing `return` let a refused client
   fall through into the admission path.

## 3. Scope

**In scope**

- Register a Socket.IO handshake middleware from `afterInit` that runs `validateClient` and
  refuses with an error, so refusal happens before CONNECT.
- Reduce `handleConnection` to admission only.
- Cover both the accepted and refused handshake paths in the gateway spec.

**Out of scope**

- Removing the admin's auth grace window. It is now belt-and-braces rather than load-bearing, and
  removing it is an admin change that belongs with the admin app.
- Any change to what `validateClient` considers valid. Only *where* it runs changes.

## 4. Acceptance criteria

- [x] A client with no credentials is refused during the handshake and never admitted — it joins
      no room and raises no `CLIENT_CONNECTED`.
- [x] A client whose token validation throws is refused the same way.
- [x] A client with valid credentials is admitted unchanged, joining `CLIENT_DEFAULT_ROOM` and
      raising `CLIENT_CONNECTED`.
- [x] `handleConnection` no longer calls `validateClient`.
- [x] The refusal message contains `unauthorized`, which the panel matches on to classify an auth
      failure (`_classifyConnectionError` in `apps/panel/lib/core/services/socket.dart`).
- [x] The refusal reason is logged but not forwarded to the client.
- [x] `pnpm --filter ./apps/backend run lint:js` and `test:unit` pass.

## 5. Example scenarios

### Scenario: Connection without a token

Given a client opens a socket with no token in the handshake
When the middleware validates it
Then the client receives `connect_error` and is never admitted to the namespace

### Scenario: Connection with a valid token

Given a client opens a socket with a valid token
When the middleware validates it
Then the handshake completes and the client joins the default room

## 6. Client impact

Refusal now arrives as `connect_error` instead of `connect` + `disconnect`. Reconnect semantics
are unchanged: the client's `CONNECT_ERROR` branch calls `destroy()` before emitting, which
unsubscribes the manager exactly as the `io server disconnect` path did, so `socket.active`
becomes `false` either way and a refused client still needs a deliberate reconnect.

- **Admin** — `ensureSocketConnection` already treats `connect_error` as a failed attempt, so the
  failure toast now fires immediately instead of waiting out the grace window.
- **Panel** — `socket.dart` already registers `onConnectError` with the comment "authentication
  failures, etc." and classifies auth errors by message. That path was previously unreachable for
  auth refusals; it now works as written.

## 7. Technical constraints

- Do not change `WsAuthService`; only where it is invoked from.
- Tests are expected for both handshake outcomes.
