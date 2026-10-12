# Remote access final acceptance

Date: 2026-10-12. Result: **A1–A5 passed** for the agreed scope of epic
[#897](https://github.com/FastyBird/smart-panel/issues/897): the remote-access module,
Tailscale, Cloudflare Tunnel and the fixed privileged helper. WireGuard
[#913](https://github.com/FastyBird/smart-panel/issues/913) remains a separate deferred feature.

This closes the finite gate in the [completion plan](superpowers/plans/2026-10-03-remote-access-completion.md#scoped-remaining-acceptance-reconciled-2026-10-12).
Earlier acceptance keeps its original release and limitations; the full historical matrix was not
repeated on the final candidate. No additional application release is needed for this record.

## Candidate

- [Alpha.64](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.64),
  commit `8744ae49ff392a592950ce4faa8f1007768eadec`, the version-sync child of
  PR [#1400](https://github.com/FastyBird/smart-panel/pull/1400), merge
  `564e261248b6da78f0e5acb993f5f7b209f3f07a`.
- The fixed helper shipped in [#1399](https://github.com/FastyBird/smart-panel/pull/1399).
  #1400 aligns application-update deadlines with a bounded 30-minute operation budget
  and 30-second worker margin. Provider setup retains its ten-minute limit.
- All ten required release jobs passed in
  [release run 38247149857](https://github.com/FastyBird/smart-panel/actions/runs/38247149857).
  Server archive SHA-256: `7464770591b70e2814d828a75d09766963d0c88e5898550a9969ba4ea2a8cdc4`.
  Archive paths, source/runtime helper bytes and server/npm payload agreement were verified.
- Runtime checks covered every published wrapper file (42), backend file (5,212) and admin file (249)
  on both Pi 4 installations; the image installation on Pi 5 matched all backend/admin files.

## Final hardware results

| Gate | Environment and action | Observed result |
| --- | --- | --- |
| A1 | Pi 4, separate clean Raspberry Pi OS Bookworm arm64 card; `install-server.sh --version 1.1.0-alpha.64 --port 3000 --with-tailscale` | Exit 0, healthy alpha.64 and rendered first-run onboarding. Root-owned helper/workers matched the release; fixed sudo policy, capability probe from the backend mount namespace and refusal of an arbitrary command passed. Tailscale 1.104.1 installed from its signed vendor apt source, with the daemon disabled/inactive and no tailnet interface. No provider sign-in or public route was configured. |
| A2 | Existing Pi 4 npm host, trusted helper refresh followed by normal System alpha.63 → alpha.64 update; Pi 5 image host, normal System alpha.56 → alpha.64 update followed by trusted-root helper migration | Pi 4 helper job `373472f8-edf3-4f3c-b75d-fc508e67c32d` ran independently while the backend was stopped and completed. Worker limit was 30 min 30 sec. Status/attempt/lock cleanup and app/admin recovery passed. Pi 5 migration removed the wildcard sudo grant and restarted the backend successfully. Schema, 28 migrations, accounts, long-lived tokens, topology, configuration and Tailscale identity were preserved. |
| A3 | Tailscale and Cloudflare setup on Pi 4 through the fixed helper; enabled Cloudflare setup on Pi 5 | Root/API job identifiers matched, progress reached completion and workers became inactive. Tailscale job `1eb15b01-95c4-48b4-b06d-1880e608b14f`, Pi 4 Cloudflare job `2bbffe5b-5f13-46be-9ad0-2d8447cf2c9d`, Pi 5 Cloudflare job `34dbc1bd-d2d6-4116-ad9e-5e7d2c34f4e0`. Released cards settled to Connected on the configured providers; Pi 5 Cloudflare showed four ready connections. Pi 4 Cloudflare remained intentionally disabled without a token. |
| A4 | Pi 4 Tailscale reached from the real Pi 5 tailnet peer; Pi 5 Cloudflare reached through its public hostname after migration/setup | Natural DNS/default TLS, HTTPS admin, owner login and authenticated WebSocket passed; missing/invalid WebSocket credentials were rejected. Tailscale also acknowledged an authenticated subscription. CLI/API/card/URL/proxy observations agreed. Pi 5 browser login and Connected card passed; its two public-exposure advisories were expected for a public tunnel. Final data/configuration checks passed with no active privileged jobs or recovery holds. |
| A5 | Released alpha.63 admin, retained from the preceding acceptance session | A browser-memory HTTPS-disabled advisory fixture rendered the DNS-console anchor. An actual click opened Tailscale login with `/admin/dns` as the destination. Reload removed the fixture. This verifies the released link; previously recorded real HTTPS-disabled/restored tests remain the functional evidence. |

The failed alpha.63 reinstall is still a **failed attempt**, not relabelled as successful. Its 630-second
timeout happened during npm replacement before migrations. The original runtime and unchanged database
were verified and restored; the failed attempt was truthfully reconciled and archived before alpha.64
was submitted. The successful alpha.64 update took approximately four minutes, so it does **not** prove
execution beyond the former timeout. Deadline configuration and focused worker/observer tests establish
the new bound; the real run establishes successful independent update and recovery.

Two acceptance-harness assumptions were corrected without product changes: stopping the backend also
stops its managed Tailscale session, and a completed Cloudflare setup may briefly precede connector
reconnection. The scripts did not resubmit jobs; subsequent observations verified restored connections.
The fresh-install SSH launcher stopped waiting after 60 seconds while its systemd oneshot continued;
the same installation was observed to exit 0, without a second submission.

## Documentation and operator guidance

The reconciled website was deployed successfully by
[run 38223711276](https://github.com/FastyBird/smart-panel/actions/runs/38223711276) from the #1399 merge
`fc83b8fba8c95bfe25758ee3b5c2c5dc880f3728`. On 2026-10-12 at 14:02 UTC, live HTTP 200 and updated
content were checked for [Remote Access](https://smart-panel.fastybird.com/docs/admin-management/remote-access),
[network requirements](https://smart-panel.fastybird.com/docs/get-started/network-requirements),
[extensions](https://smart-panel.fastybird.com/docs/extensions/overview),
[Raspberry Pi images](https://smart-panel.fastybird.com/docs/get-started/installation/raspberry-pi-image)
and [MCP](https://smart-panel.fastybird.com/docs/admin-management/mcp).

Fresh host installations provision the helper automatically. Existing hosts use the explicit trusted-root
migration in the [architecture reference](remote-access-architecture.md); application-writable scripts
must not bootstrap their own root trust. Preserve an unresolved recovery hold and inspect its recorded
phase before recovery. Tailscale provides private tailnet access; Cloudflare publishes the configured
hostname, with Smart Panel authentication and optional Cloudflare Access. Package installation alone
does not authorize either provider.

## Evidence and limits

Sanitized assertions above are the reviewable result. Private receipts remain under the local
`remote-access-r6/` evidence root; credentials, tokens, node keys and raw private configuration are not
committed:

- `alpha64-artifacts/artifact-verification.json`: identified candidate and publication checks.
- `fresh-pi4-alpha64/acceptance.private.json`, `runtime-verification.private.json` and
  `browser-onboarding.private.json`: A1 and the clean installation.
- `pi4-helper-alpha64/system-alpha64-preservation.json`, `final-helper-audit.json`,
  `both-provider-helper-setup.json`, `post-setup-peer-auth.json` and `released-admin-recovery.json`:
  existing-host A2–A4.
- `pi5-helper-alpha64/helper-verification.private.json`, `cloudflare-job-complete.private.json`,
  `public-after.private.json`, `released-admin-recovery.private.json` and
  `final-preservation.private.json`: image migration, Cloudflare setup and restoration.
- `pi4-helper-alpha63/released-advisory-navigation.json`: A5.
- `helper-implementation/website-publication.json`: live documentation checks.

The [retained contract matrix](superpowers/plans/2026-10-03-remote-access-completion.md#scoped-remaining-acceptance-reconciled-2026-10-12)
still identifies older lifecycle, phone, token, network and failure evidence. Unperformed phone approval
variants, full minimum-version repetition and actual Home Assistant add-on/Supervisor packaging remain
unperformed; they were explicitly excluded from this completion gate. The original Pi 4 alpha.64 card
was preserved before the fresh-install card was inserted. The fresh host remains at onboarding with
Tailscale disabled; staging Pi 5 remains connected.

This record completes the agreed acceptance for #910, #1159 and #914 and the documentation/index/epic
close-out in #1354, #991 and #897. WireGuard #913 stays open.
