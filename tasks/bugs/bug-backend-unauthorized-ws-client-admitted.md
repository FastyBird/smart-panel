# Task: Stop admitting unauthorized websocket clients
ID: BUG-BACKEND-WS-UNAUTHORIZED-ADMITTED
Type: bug
Scope: backend
Size: tiny
Parent: (none)
Status: review

## 1. Business goal

In order to keep unauthenticated connections out of the broadcast rooms and out of the client
metrics
As an operator
I want the gateway to stop processing a connection as soon as it has refused it

## 2. Context

`WebsocketGateway.handleConnection` refused unauthorized clients with `client.disconnect()` but did
not return, so execution fell straight through into the admission path meant for accepted clients.

```ts
if (!isAllowed) {
    this.logger.warn(`Unauthorized client is trying to connect: ...`);

    client.disconnect();   // <- no return
}

this.logger.log(`Client connected: ${client.id}`);
await client.join(CLIENT_DEFAULT_ROOM);
...
this.eventEmitter.emit(WsEventType.CLIENT_CONNECTED, wsClientDto);
```

A refused client therefore:

- joined `CLIENT_DEFAULT_ROOM`, and `DISPLAY_INTERNAL_ROOM` plus its per-display room when the
  unvalidated `client.data.user` claimed `ownerType: DISPLAY`
- logged `Client connected: <id>` at info level, contradicting the warning logged a line earlier
- raised `WsEventType.CLIENT_CONNECTED` carrying that unvalidated user, which feeds the exchange
  bus and the client metrics

### When it triggered

`WsAuthService.validateClient` **throws** for a malformed or expired token, and that path was
already handled by the surrounding `catch`. It **returns false** when the handshake carries no
token at all — so the fall-through was reached by the plain unauthenticated connection, not by an
exotic edge case.

### How it survived

`websocket.gateway.spec.ts` mocked `WsAuthService.validateClient` as a bare `jest.fn()`, which
resolves `undefined`. Every existing `handleConnection` assertion therefore ran through the
refusal branch, and the test asserting that a client "connects and joins the default room" was
passing *because of* the bug rather than in spite of it.

Found while tracing BUG-ADMIN-SOCKET-WAKE-RECOVERY, which is what made the refusal path visible.

## 3. Scope

**In scope**

- Return immediately after refusing the client.
- Cover both the accepted and the refused path in the gateway spec, with `validateClient` mocked
  explicitly in each.

**Out of scope**

- Moving authentication into a Socket.IO middleware so refusal happens before the namespace
  CONNECT packet is sent. See "Follow-up" below.

## 4. Acceptance criteria

- [x] A refused client is disconnected and joins no room.
- [x] A refused client does not log `Client connected`.
- [x] A refused client does not raise `WsEventType.CLIENT_CONNECTED`.
- [x] An accepted client still joins `CLIENT_DEFAULT_ROOM` and raises `CLIENT_CONNECTED`.
- [x] The accepted-path test mocks `validateClient` explicitly instead of relying on the default
      `undefined`.
- [x] `pnpm --filter ./apps/backend run lint:js` and `test:unit` pass.

## 5. Example scenarios

### Scenario: Connection without a token

Given a client opens a socket with no token in the handshake
When the gateway validates it
Then the client is disconnected, joins no room, and no `CLIENT_CONNECTED` event is raised

### Scenario: Connection with a valid token

Given a client opens a socket with a valid token
When the gateway validates it
Then the client joins the default room and `CLIENT_CONNECTED` is raised

## 6. Technical constraints

- Keep the change inside `handleConnection`; the refusal semantics themselves are unchanged.
- Tests are expected for both paths.

## 7. Follow-up

`socket.io` sends the namespace CONNECT packet before Nest runs `handleConnection`, so refusing
there always reaches the client as `connect` followed by `disconnect` rather than as
`connect_error`. That ordering is why the admin has to hold its verdict for a grace window before
deciding a reconnect succeeded — see §7.2b of `bug-admin-socket-wake-recovery.md`.

Authenticating in a Socket.IO middleware (`server.use(...)` from `afterInit`) would refuse before
CONNECT, making the refusal deterministic and letting the admin drop that grace window entirely.
It changes the shape of the auth flow — `client.data.user` population, display and third-party
token handling — so it is deliberately not bundled with this one-line correctness fix.
