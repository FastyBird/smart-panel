# Task: Clear the open Dependabot alerts
ID: CHORE-DEPENDABOT-SECURITY-UPDATES
Type: chore
Scope: backend, admin, website
Size: medium
Parent: (none)
Status: review

## 1. Business goal

In order to stop shipping known-vulnerable dependencies
As a maintainer
I want the open Dependabot alerts cleared, without dragging unrelated upgrades along with them

## 2. Triage

186 open alerts, which is far less work than it looks:

| where | count |
| --- | --- |
| `pnpm-lock.yaml` (transitive) | 183 |
| `apps/backend/package.json` (direct) | 3 |

They collapse to **54 distinct packages**, and every one has a published patch. The counts are
inflated because one package appears once per advisory and once per manifest — `axios` alone
accounts for 28.

Most of the direct dependencies already declare ranges that *permit* the patched version
(`ws: ^8.19.0` → 8.21.0, `typeorm: ^0.3.28` → 0.3.31, `next: ^15.5.14` → 15.5.21). Nothing needed
a manifest change for those; the lockfile was simply stale.

### Only four packages genuinely needed intervention

| package | why | fix |
| --- | --- | --- |
| `@whiskeysockets/baileys` | pinned exactly at `7.0.0-rc.9` | bump to `7.0.0-rc12` |
| `@fastify/static` | `^9.x`, and **the 9 line has no patched release** — it ends at 9.3.0 | bump to `^10.1.2` |
| `find-my-way` | parent pins an unpatched range | override `^9.7.0` |
| `sharp` | parent pins an unpatched range | override `^0.35.0` |

`@fastify/static@10` sits outside the peer ranges of `@nestjs/platform-fastify` and
`@nestjs/serve-static`, which both cap it at `^9`. That is safe here: `ServeStaticModule` is never
imported — `main.ts` registers `@fastify/static` directly and the codebase documents why
(`app.module.ts:467`). Neither peer path is taken.

## 3. Collateral found while verifying

A lockfile refresh clears all 186, but it does not come for free. Three things broke, each
diagnosed rather than worked around:

1. **Duplicate fastify.** The backend pinned `~5.8.5` while `@nestjs/platform-fastify` resolved
   5.10.0, so `@fastify/helmet` was typed against a different `FastifyInstance` than the app used.
   Fixed by widening the backend to `^5.10.0`, which dedupes to one copy.
2. **Dead mDNS error handlers.** `bonjour-service` 1.4 made its events typed, turning
   `browser.on('error', …)` into a compile error in two plugins. Checking the source shows
   `Browser` only ever emits `up`/`down`/`txt-update`/`srv-update` — **in 1.3 as well**. Those
   handlers never ran; the new types surfaced dead code rather than breaking working code. If mDNS
   error handling is actually wanted it has to hook the underlying mdns instance instead.
3. **`socket.end()` became async** in baileys rc12, leaving a floating promise in
   `whatsapp-bot.provider.ts`. Shutdown stays synchronous, so the close is explicitly not awaited.

## 4. Approach: overrides only

An earlier attempt used `pnpm update -r`. It cleared every alert, but a blanket refresh moves
everything else within range too, and three of those had nothing to do with security:

- **`prettier` / `eslint` / `typescript-eslint`** reformatted the repo — 216 lint errors, 213 of
  them auto-fixable formatting.
- **`element-plus` 2.13.5 → 2.14.3** retyped the table components (`DefaultRow`,
  `TableColumnCtx`, `TableSortOrder`), producing ~20 type errors across admin tables.
- **the website's static export broke.** `next build` died during prerender with the message
  Next.js omits in production builds. Pinning `mermaid`, pinning `next`, restoring the website
  manifest, pinning the whole react/next stack and clearing `.next` all failed to fix it, and the
  failing page moved between runs.

So this uses `pnpm.overrides` exclusively, starting from the existing lockfile. Only packages with
an advisory move; everything else stays exactly where it was. That is also the mechanism this repo
already uses — there were 38 override entries before this change.

Overrides are scoped per major line where a package has several installed
(`"picomatch@2"`, `"picomatch@4"`, `"vite@6"`, `"vite@8"`, `"uuid@11"`, `"uuid@13"`,
`"brace-expansion@1|2|5"`, `"minimatch@3|9"`), so no consumer is dragged across a major.

`uri-js` was aliased to `npm:fast-uri@^3.0.6`, which held `fast-uri` below its patch no matter what
the direct override said. The alias had to be raised too.

`@nestjs/swagger` is pinned at 11.2.6. The `@nestjs/core` advisory pulls the whole Nest family
forward, which carried swagger to 11.4.6 — and 11.4 infers an untyped property as `object` rather
than `string`. That changed the generated spec (`type` became `"type": "object"` with a string
example, failing `oas3-valid-schema-example`) and the admin types built from it (`type` became
`Record<string, never>`, breaking `vue-tsc`). Swagger has no advisory, so it stays put.

This one only shows up if the spec is regenerated: CI runs `generate:spec && generate:openapi`
before linting, so verifying against an already-generated spec misses it entirely.

## 5. Result

All 186 original advisories are cleared, along with the follow-up round - with one
caveat on `brace-expansion` recorded in §6: the dependency is patched, but the alert stays open
until the advisory metadata catches up.

### The website was never blocked by `next`

The first attempt deferred `next` because the website's static export broke. That diagnosis was
wrong, and wrong for a methodological reason worth recording: the bisect ran on a tree where
`pnpm update -r` had already moved everything, so "pin `next` back and it still fails" only showed
that *something else* was also broken. Repeating the experiment from a working baseline — one
override, nothing else touched — the website builds cleanly on `next@15.5.22`.

The lesson is not about `next`. It is that a bisect is only meaningful when a single variable
moves; bisecting on top of a broken tree cannot identify anything.

### Second round

| package | how |
| --- | --- |
| `next` (22 alerts) | override `^15.5.21`; website static export verified green |
| `file-type` (2 alerts) | by **deleting** an override rather than adding one — see below |
| `brace-expansion` (1 alert) | per-line: 1.1.18, 2.1.4, 5.0.9 |

### `file-type` was held back by our own override

`file-type` 20.5.0 arrived through `@xhmikosr/decompress`, and the obvious reading was that
`decompress` needed forcing across a major to reach the plugin versions built for `file-type` 21.
That reading was wrong. `@xhmikosr/downloader@16.3.0` — already installed, unchanged — declares
`@xhmikosr/decompress: ^11.1.3`. What actually pinned it to the 10 line was an override this repo
added in the previous round, when a critical advisory required `>= 10.2.1`:

```json
"@xhmikosr/decompress": "^10.2.1"
```

That override outlived its purpose and became the thing holding a vulnerable `file-type`
underneath it. Deleting it lets `decompress` resolve to 11.1.3 naturally, which is what its parent
asked for all along, drags `file-type` to 21.x, and still satisfies the original `>= 10.2.1`
advisory. One fewer override, not one more.

Worth generalising: a version override is a claim about a moment. Left in place it keeps asserting
that claim long after the ecosystem has moved past it, and can hold a transitive dependency below
its own fix. These are worth re-reading whenever they block something, not just adding to.

### A note on the `brace-expansion` alert

GHSA-mh99-v99m-4gvg carries a single range, `<= 5.0.7`, patched in 5.0.8 — so GitHub may keep
flagging the 1.x and 2.x lines even though they are fixed. They are: 1.1.18, 2.1.4 and 5.0.9 were
published within seventeen minutes of each other on 2026-07-30, six days after the advisory, and
diffing 1.1.17 against 1.1.18 shows the backported guard:

```js
if (length + c.length > maxLength) break
```

That is the unbounded-expansion fix. If the alert stays open it is advisory metadata lagging the
backports, not an unpatched dependency — worth confirming before anyone "fixes" it by forcing
`brace-expansion` 5.x under consumers that ask for `^1`.

### Verification

- website: `build` exit 0
- backend: `build` exit 0, spectral clean on a regenerated spec, `lint:js` 0 errors, 220 suites / 2847 tests
- admin: `build` exit 0, `type-check` clean, 223 files / 1408 tests

## 6. Follow-up

**One alert stays open, and should.** While GHSA-mh99-v99m-4gvg keeps its single `<= 5.0.7`
affected range, Dependabot will go on classifying the installed 1.1.18 and 2.1.4 as vulnerable no
matter what those releases contain. So this task cannot both leave them installed and claim a clean
board — the dependency is patched, the alert is not closed, and those are different statements.

It closes one of two ways:

1. GitHub amends the advisory with per-line ranges (`1.x` → 1.1.18, `2.x` → 2.1.4), after which the
   alert clears on its own; or
2. someone dismisses it explicitly as `tolerable_risk`, citing the backport evidence in §5.

What must **not** happen is forcing `brace-expansion` 5.x under consumers that declare `^1` or
`^2`, purely to make the counter read zero. That trades a fixed dependency for a real
compatibility risk in order to satisfy a metadata lag.
