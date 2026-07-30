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

**168 of 186 advisories cleared.** What remains, and why:

| package | alerts | why it is left |
| --- | --- | --- |
| `next` | 16 | website only, and the website's build breaks on the refreshed tree — see below |
| `file-type` | 2 | installed at 20.5.0; the only patch is 21.3.1, a major bump on a transitive |

`protobufjs@6.8.8` was also refused for the same cross-major reason, but is no longer reachable
after the 7.x override, so it raises no remaining alert.

### Verification

- website: `build` exit 0 — the thing the blanket refresh broke
- backend: `build` exit 0, `lint:js` 0 errors (2 pre-existing warnings), 220 suites / 2847 tests
- admin: `build` exit 0, `type-check` clean, `lint` exit 0, 223 files / 1408 tests

## 6. Follow-up

Two things are deliberately left:

1. **The website's `next` alerts.** Clearing them means moving the website's dependency tree, which
   currently breaks its static export. Isolating that needs a bisect of nextra's markdown pipeline
   (`shiki`, `rehype-*`, `remark-*`), all of which move together.
2. **`file-type`.** Whoever pulls 20.5.0 has to move to 21.x first.
