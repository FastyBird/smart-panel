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
pending slot. The client secret and tokens must never share a browser-facing DTO.

## Authorization boundary for Task 7.2

The implementation that follows this record must:

1. Allow only a signed-in Smart Panel owner or administrator to start authorization.
2. Generate a cryptographically random, single-use, short-lived `state` bound to the initiating Smart Panel user,
   installation, exact redirect URL, one authorization transaction, and the current active-grant/configuration
   generation.
3. Return an authorization URL; never proxy or collect the user's Homey credentials.
4. Keep the callback public at the HTTP-authentication layer because the browser reaches it after Homey authorization,
   then authorize it solely by consuming the exact one-time `state`. Reject missing, expired, replayed, or mismatched
   state before token exchange.
5. Redact the code, state, token response, client secret, raw account response, and raw Homey inventory from errors and
   logs.
6. Exchange the code immediately with a bounded timeout. Stage and persist candidate tokens in a transaction-scoped,
   initiating-user-bound pending record without activating them. Never address candidate credentials through a global
   pending slot. After any exchange, validation, or persistence failure, clear only that transaction and leave an
   existing active grant and connector untouched.
7. List sanitized Homey choices from that exact candidate transaction. Auto-select only when exactly one eligible Homey
   exists; otherwise require an explicit stable-ID selection bound to the same opaque transaction and initiating user,
   without exposing account details that the admin UI does not need.
8. Authenticate the selected Homey with the candidate grant, then atomically activate its access token, refresh token,
   selected Homey ID, and connector through a serialized compare-and-swap against the active-grant/configuration
   generation captured when that authorization started. Activation advances the generation. If another flow or
   configuration mutation won first, reject and clear the stale candidate instead of overwriting it. Until activation
   succeeds, retain the previous active grant, selected Homey, and connector; never apply a previous Homey ID or another
   transaction's selection to a candidate account.
9. Serialize refresh and token replacement, persist a rotated refresh token atomically, and move to reauthorization
   rather than retrying aggressively after revocation or permanent refresh failure. Reauthorization must not take the
   active connector offline unless the active grant independently becomes invalid or the candidate is activated.
10. Disconnect the Homey connector and clear tokens plus the selected Homey before reporting OAuth disconnect success.

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
