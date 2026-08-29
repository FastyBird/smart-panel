# Homey Cloud OAuth Compatibility Record

**Status:** Client registration and Homey Cloud access approval pending; deployment contract recorded

**Evidence date:** 2026-08-28

**Related task:** `FEATURE-PLUGIN-HOMEY`, Milestone 7

## Purpose

This record defines the external client-registration and deployment boundary for the Homey Cloud connector before its
authorization endpoints are implemented. It deliberately contains no client ID, client secret, authorization code,
token, account identifier, Homey identifier, callback state, or installation address.

The relevant official references are:

- [Homey Web API overview](https://api.developer.homey.app/)
- [Homey HTTP and Socket.IO specification](https://api.developer.homey.app/http-and-socket.io/http-specification)
- [`AthomCloudAPI` reference](https://athombv.github.io/node-homey-api/AthomCloudAPI.html)
- [Homey Developer Tools](https://tools.developer.homey.app/)

## Verified published contract

| Area                | Published behavior and implementation consequence                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client registration | A Homey Web API client supplies a client ID, client secret, registered redirect URI set, and scopes.                                                                                                                      |
| Authorization       | The user authorizes at `https://api.athom.com/oauth2/authorise`; Smart Panel must send an exact registered redirect URI and a one-time `state`.                                                                           |
| Code exchange       | The backend exchanges the short-lived authorization code at `https://api.athom.com/oauth2/token` using HTTP Basic authentication with the client ID and secret.                                                           |
| Token lifecycle     | The pinned `homey-api` `3.19.2` client models access and refresh tokens and serializes concurrent refresh. Smart Panel must persist every returned token field and safely handle responses that rotate the refresh token. |
| Account inventory   | The authenticated user response can contain multiple Homeys. Smart Panel must list them and require an explicit selection instead of silently choosing the first.                                                         |
| Homey session       | The selected Homey is authenticated through the SDK, which returns the platform/API-specific Homey client used by the cloud connector.                                                                                    |
| Default limit       | A new Web API client is limited to 100 Homey Pro users.                                                                                                                                                                   |
| Homey Cloud access  | Homey Cloud access is not automatic. The client owner must request a limit increase in Developer Tools and include the request to connect to Homey Cloud.                                                                 |
| PKCE                | Neither the current Homey HTTP guide nor the pinned SDK's authorization-code API documents PKCE parameters. Smart Panel must not invent them; it must use a confidential backend exchange plus strict `state` handling.   |

The public guide describes an authorization code as valid for 30 seconds. Callback processing must therefore be
bounded and exchange the code immediately. The guide also describes tokens as valid until revoked, while the pinned SDK
supports `expires_in`, refresh tokens, and automatic refresh. The implementation must accept both behaviors: use expiry
metadata when present, refresh before or after an authorization failure through one serialized owner, and require
reauthorization when refresh is rejected.

## Distribution decision

Smart Panel is self-hosted software with installation-specific origins. It must not embed one reusable FastyBird client
secret in source code, browser assets, the container image, an installer, or a default configuration. A shared secret in
a distributed artifact is not confidential, and one fixed callback cannot represent arbitrary private installation
origins.

The first cloud profile therefore uses a **deployment-owned confidential Web API client**:

1. The deployment owner registers a client in Homey Developer Tools.
2. The owner registers the exact callback URL for that Smart Panel installation.
3. The client ID, client secret, and callback URL are provisioned to the backend as deployment configuration.
4. Smart Panel users see only the normal Homey consent flow; they never enter Homey account credentials into Smart
   Panel.

A future FastyBird-hosted authorization broker could provide one centrally approved client for arbitrary installations,
but it would add a new hosted trust boundary, token relay, availability requirement, privacy policy, and incident
response surface. It is not implied by this milestone and must receive a separate design review before replacing the
deployment-owned client model.

## Client registration template

Register only exact callback URLs. Do not register wildcards, derive a callback from request `Host`/forwarded headers,
or accept a callback override from an authorization request.

| Field                | Required value                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Client name          | `FastyBird Smart Panel` plus a deployment qualifier when Developer Tools requires unique names                                          |
| Development callback | `http://localhost:3000/api/v1/plugins/devices-homey/oauth/callback` only for a backend and browser running on the same development host |
| Installed callback   | `https://<exact-smart-panel-origin>/api/v1/plugins/devices-homey/oauth/callback`                                                        |
| Client type          | Confidential backend client                                                                                                             |
| Intended scopes      | `homey.system.readonly`, `homey.zone.readonly`, `homey.device.readonly`, `homey.device.control`                                         |

The scope names above are the minimum manager scopes used by the existing connector contract. Their availability and
consent presentation must be confirmed in the current Developer Tools registration form before the live client item is
checked. Do not add flow, app, user-administration, pairing, driver, insight, or device-management scopes.

For an installation without an exact browser-reachable HTTPS origin, cloud mode remains unavailable. Loopback HTTP is
development-only and works only when the browser follows the callback to the same machine as the backend. A LAN address,
`.local` name, reverse-proxy hostname, or port is not interchangeable with a registered value.

## Deployment configuration contract

The backend implementation will read these deployment values; values shown here are names and placeholders only:

| Variable                       | Secret | Validation and exposure                                                                                                            |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `FB_HOMEY_CLOUD_CLIENT_ID`     | No     | Required for cloud mode; trimmed non-empty value; never returned unless a later UI has a concrete need for a configured indicator. |
| `FB_HOMEY_CLOUD_CLIENT_SECRET` | Yes    | Required for cloud mode; backend-only; never returned, logged, placed in OpenAPI examples, or sent to the admin/panel clients.     |
| `FB_HOMEY_CLOUD_REDIRECT_URL`  | No     | Exact absolute registered callback URL; HTTPS outside loopback development; no credentials, fragment, or unexpected query.         |

Access tokens and refresh tokens are per authorization, not deployment client configuration. They must use the generic
write-only secret boundary or an established encrypted credential store and remain backend-only. Disconnect clears the
active access token, refresh token, and selected Homey together. Reauthorization stages a separate candidate grant and
must preserve the active grant until the candidate token set is exchanged, its Homey is selected and authenticated,
and the tokens plus selected Homey are activated together successfully. A failed reauthorization clears only its
candidate state. Every candidate is isolated by authorization transaction and initiating user; there is no shared
pending slot. Pending candidates have a short, server-enforced expiry independent of the consumed OAuth `state`.
Expiration, an explicit cancel action, or abandoning the selection flow deletes the candidate tokens and transaction;
a periodic cleanup also removes expired records that receive no further request. The client secret and tokens must
never share a browser-facing DTO.

## Authorization boundary for Task 7.2

The implementation that follows this record must:

1. Allow only a signed-in Smart Panel owner or administrator to start authorization.
2. Generate a cryptographically random, single-use, short-lived `state` bound to the initiating Smart Panel user,
   installation, exact redirect URL, one authorization transaction, and the current active-grant/configuration
   generation. Capture the initiating user's current authority generation in the transaction as well; this binding
   identifies the initiator but does not replace a current authorization check.
3. Return an authorization URL; never proxy or collect the user's Homey credentials.
4. Keep the callback public at the HTTP-authentication layer because the browser reaches it after Homey authorization,
   then authorize it solely by consuming the exact one-time `state`. Reject missing, expired, replayed, or mismatched
   state before token exchange. Configure every HTTP server, reverse proxy, and observability layer in front of the
   callback to omit its query string from access logs or scrub `code`, `state`, and OAuth error parameters before any
   request-target recording. After consuming the callback, redirect the browser to a clean same-origin result URL with
   no OAuth query parameters, including on failure.
5. Redact the code, state, token response, client secret, raw account response, and raw Homey inventory from errors and
   logs.
6. Exchange the code immediately with a bounded timeout. Stage and persist candidate tokens in a transaction-scoped,
   initiating-user-bound pending record without activating them. Give the record a short absolute expiry that cannot
   be extended by reads or selection attempts. Never address candidate credentials through a global pending slot.
   Delete its tokens and transaction on expiry, explicit cancellation, terminal failure, or successful activation, and
   sweep expired abandoned records independently of user traffic. Cancellation and expiry cleanup must serialize with
   activation and change or delete the authoritative pending row, so credentials retained by an in-flight request
   cannot activate after cleanup wins. Leave an existing active grant and connector untouched when a candidate is
   cleared.
7. List sanitized Homey choices from that exact candidate transaction. Auto-select only when exactly one eligible Homey
   exists. When none exist, return a sanitized terminal failure and delete the candidate tokens and transaction. When
   multiple exist, require an explicit stable-ID selection bound to the same opaque transaction and initiating user,
   without exposing account details that the admin UI does not need. Reject selection for expired or cleared
   transactions.
8. Disable SDK automatic token refresh for pending candidate clients. If a candidate access token expires or receives
   `invalid_token` during inventory listing or selected-Homey authentication, treat it as a terminal failure, delete the
   exact pending transaction and its credentials through the candidate mutation boundary, and require a new
   authorization. After authenticating the selected Homey with a still-valid candidate grant, atomically activate its
   access token, refresh token, selected Homey ID, and connector through a serialized compare-and-swap against the
   active-grant/configuration generation captured when that authorization started. Use one database transaction and
   locking boundary shared by activation, candidate cancellation or expiry, and initiating-user demotion or deletion.
   In that transaction, conditionally consume an existing non-cancelled candidate whose absolute expiry is still in the
   future; re-read the initiating user and require that the user still exists, still has owner or administrator
   authority, and still
   matches the captured authority generation. Store the activating user and authority generation on the active grant.
   Authority mutations under the same boundary must invalidate and disconnect a grant activated by that authority if
   activation committed first; if the authority mutation, cancellation, expiry, or another configuration mutation won
   first, the activation's conditional commit must fail and clear any remaining candidate state. Activation advances
   the grant/configuration generation. Until activation succeeds, retain the previous active grant, selected Homey, and
   connector; never apply a previous Homey ID or another transaction's selection to a candidate account.
9. Before calling the refresh endpoint, capture the active grant/configuration generation. Persist a successful access
   and rotated refresh token atomically through the same serialized active-grant mutation boundary used by activation,
   disconnect, and authority invalidation, conditional on that generation and grant identity still being current.
   Discard and redact a late refresh response if any competing mutation won first; it must never overwrite a replacement
   grant or restore a disconnected grant. Move to reauthorization rather than retrying aggressively after revocation or
   permanent refresh failure. Reauthorization must not take the active connector offline unless the active grant
   independently becomes invalid or the candidate is activated.
10. Allow only a current Smart Panel owner or administrator to disconnect. Re-read and require that authority inside the
    same serialized mutation boundary, then invalidate and clear tokens plus the selected Homey and disconnect the
    Homey connector before reporting OAuth disconnect success.

### Grant persistence boundary

Task 7.2b adds provider-scoped pending-candidate, active-grant, user-authority, and generation-state tables through the
incremental `1000000000025-AddHomeyCloudGrants` migration. OAuth token fields are excluded from ordinary TypeORM reads;
only explicit backend credential-loading methods select them, and no controller or browser DTO exposes those methods.
The pending table is transaction- and initiating-user-scoped, has a server-capped absolute lifetime and capacity, and is
swept independently of requests.

The state table also stores a SHA-256 identity derived from the deployment client ID, client secret, exact redirect URL,
and requested scopes. Every authorization-context, credential-loading, activation, refresh and disconnect path compares
the current non-secret fingerprint with the persisted value. A change clears pending and active grants and advances both
generations before stale credentials can be used; the client secret itself is never persisted in the state table.

One serialized mutation service owns candidate staging, cancellation, expiry and activation plus active-grant refresh,
disconnect and configuration invalidation. Activation and refresh use generation and grant-identity compare-and-swap
checks so a late provider result cannot revive cleared credentials or overwrite a replacement. Administrator demotion
and removal participate in the same user database transaction through the additive user-lifecycle mutation boundary;
this advances the user's authority generation and clears credentials authorized by that user before the account change
commits. The provider factory-reset handler clears pending grants, active credentials and user-authority metadata before
the core device and user reset handlers run, while advancing both persisted generations.

Task 7.2c adds the provider boundary behind disabled cloud mode. It revalidates the initiating authority and deployment
generations before sending the authorization code. The factory rejects SDK API-base overrides unless they resolve to the
exact Athom API origin. Authorization-code exchange uses the pinned Athom token endpoint, while account requests validate
their final prepared origin before dispatch; all provider operations consume the authorization service's abort signal and
have a bounded deadline. The service validates and stages only the normalized token fields, then recreates an isolated
candidate client from the exact transaction for Homey listing and selection. Browser-facing choices contain only a
bounded stable ID and sanitized name. Unsupported or duplicate entries fail closed; one eligible Homey is auto-selected,
after a fresh singleton-inventory check, while multiple choices require an exact transaction-bound selection. The
selected Homey must authenticate over the cloud strategy before the existing mutation gate can atomically activate it.
Invalid-token, malformed-response,
empty-inventory and unsupported-inventory failures clear only that candidate; transient timeout, rate-limit, and
unavailable failures retain it until its original absolute expiry. HTTP routes and connector activation remain
intentionally absent until Tasks 7.2d and 7.3.

The current official client and HTTP references do not document a standards-style token-revocation endpoint. Task 7.2
must verify the current live/API behavior before claiming remote revocation. Until then, disconnect means local token
deletion and connector teardown, while the operator can revoke the grant from Homey account controls.

## External registration and approval checklist

- [ ] Create a dedicated development Web API client in Homey Developer Tools.
- [ ] Register the exact development callback and confirm whether loopback HTTP is accepted.
- [ ] Confirm that Developer Tools exposes the four intended minimum scopes with the expected consent text.
- [ ] Complete one authorization-code exchange without recording any returned identifier or secret in the repository.
- [ ] Verify multi-Homey listing shape with a sanitized synthetic contract or account that contains multiple eligible
      Homeys.
- [ ] Request the user-limit increase and explicit Homey Cloud access required for production use.
- [ ] Record Athom's approval outcome, effective limit, required branding/legal material, and any rate-limit conditions
      without including correspondence that contains private account data.
- [ ] Register the exact production callback only after the production public origin is final.

## Gate for implementation

Task 7.2 may build the authorization state machine and tests behind a disabled cloud mode using fakes. Live cloud mode
must remain unavailable until the dedicated client exists, the exact callback and scopes are verified, and Athom has
approved Homey Cloud access. No code may reuse a Homey CLI/mobile client identity or another product's client secret.
