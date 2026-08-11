# PR Title Convention — Design

**Status:** Approved
**Date:** 2026-08-11
**Author:** Adam Kadlec
**Related:** `.github/release-drafter.yml`, `.github/labeler.yml`, `.github/dependabot.yml`, `tasks/_template.md`

## Problem

PR titles in this repository have no stated convention. There is no `CONTRIBUTING.md`, no PR template, no commitlint, no husky, and neither `CLAUDE.md` nor `AGENTS.md` mentions title format. The result is measurable drift across 680 pull requests.

Conformance to `type(scope): subject`, by PR number window:

| Window | Matches the shape | Fully strict (scope present, lowercase subject) |
|---|---|---|
| #1–100 | 100% | 0% |
| #101–200 | 97% | 1% |
| #201–300 | 95% | 7% |
| #301–400 | 95% | 8% |
| #401–500 | 91% | 12% |
| #501–600 | 85% | 71% |
| #601–650 | 69% | 52% |
| #651–682 | 38% | 38% |

The most recent ~20 PRs (the MCP OAuth series) are uniformly imperative-sentence style — `Prove MCP OAuth switch-off stream isolation`, `Await MCP module disable invalidation`. Internally consistent, but a different convention.

Scope usage is the worse half of the problem. 90+ distinct scopes have been used, from an unbounded vocabulary:

- **Near-duplicates:** `security` / `security-module` / `security-domain`, `buddy` / `ai-buddy`, `media` / `media-domain`, `doc` / `docs` / `documentation`, `zigbee` / `zigbee2mqtt` / `z2m-plugin`, `simulator` / `devices-simulator` / `real-simulator`, `covers-domain` / `cover-domain`, `tests` / `testing`, `localization` / `localizations` / `translations`
- **Typos, shipped:** `ligting-domain`, `circular-dependnecny`
- **Two competing axes:** app (`panel` 42, `admin` 37, `backend` 14) against domain (`ai-buddy` 31, `energy` 17, `media-domain` 17, `mcp` 15). The same change could plausibly take either, so it took both.

### Why this costs more here than in a normal repo

Two pipelines consume PR titles verbatim:

1. **Squash merge.** The repository sets `squash_merge_commit_title: COMMIT_OR_PR_TITLE`, so the PR title becomes the commit subject on `main`. Confirmed in history: `ec483eb5f Prove MCP OAuth switch-off stream isolation (#682)`.
2. **Release notes.** `release-drafter.yml` sets `change-template: '- $TITLE @$AUTHOR [#$NUMBER]'`. Every title ships to users in the published release body.

`squash_merge_commit_message` is `COMMIT_MESSAGES`, so individual commit messages are concatenated into the squash body. Local commit hygiene therefore also reaches `main`.

## Goal

One enforced title format, drawn from the conventions already in use in the `nexcue` and `tarmoto` repositories, applied to both PR titles and local commit messages, and documented where humans *and* agents will read it.

## Non-Goals

- **Rewriting history.** 680 existing titles stay as they are. Rewriting them would rewrite `main`.
- **Domain-level scopes.** Considered and rejected — see [Scope axis](#scope-axis).
- **Enabling branch protection.** Recommended separately, out of scope here — see [Open follow-up](#open-follow-up).

## The rule

```
<type>(<scope>): <subject>
```

### Types

`feat` `fix` `docs` `style` `refactor` `test` `chore` `perf` `ci` `build` `revert`

The same 11 used by `nexcue` and `tarmoto`. Three historical forms become invalid and have direct replacements:

| Was | Becomes |
|---|---|
| `security(backend): …` | `fix(backend):` or `chore(backend):` |
| `doc(zigbee): …` | `docs(…):` |
| `feature(storage): …` | `feat(…):` |

### Scope — required

Required on every PR title and every local commit. `cross` is the escape hatch for genuinely cross-cutting changes; omitting the scope is never the answer.

| Scope | Covers |
|---|---|
| `backend` | `apps/backend/**` |
| `admin` | `apps/admin/**` |
| `panel` | `apps/panel/**` |
| `website` | `apps/website/**` |
| `sdk` | `packages/**` — `extension-sdk`, `example-extension` |
| `installer` | `build/**` — installer package, raspbian image, service scripts |
| `spec` | `spec/**` — OpenAPI plus device/channel/display/weather specs |
| `infra` | `docker/**`, `docker-compose.yml`, `Makefile`, `bin/**`, and root workspace tooling — `package.json`, `pnpm-workspace.yaml`, `melos.yaml`, `tsconfig*`, linter and formatter config |
| `ci` | `.github/**` |
| `deps` | Dependency bumps |
| `docs` | `docs/**`, root `*.md` |
| `tasks` | `tasks/**` |
| `cross` | Genuinely cross-cutting |

Thirteen entries, closed. The vocabulary is derived from directory layout, so it only changes when the monorepo gains a top-level surface — not when a module or plugin is added.

`installer` is deliberately not named `build`, because `build(build): …` reads badly when type and scope collide.

### Subject

- Must start with a **lowercase** character. Acronyms later in the subject are fine — `add MCP OAuth artifact administration` is valid.
- No trailing period.
- Imperative mood.
- Header ≤ 100 characters including the `type(scope): ` prefix (commitlint's `header-max-length` default).

### Breaking changes

`feat(backend)!: …`. The `!` marker alone does **not** file the change under "Breaking Changes" in the release notes — `release-drafter.yml` categorises by label, so the `breaking change` label is still required.

### Examples

```
feat(backend): add MCP OAuth artifact administration
fix(admin): recover the websocket after the machine wakes from sleep
build(panel): upgrade Flutter toolchain
docs(tasks): close the virtual devices epic
chore(deps): bump actions/checkout from 4 to 5
chore(cross): align PR workflow docs and automation
feat(backend)!: require authentication during the websocket handshake
```

## Design decisions

### Scope axis

Scope is the **surface** changed, not the feature domain. Three inputs converged on this:

1. Both reference repositories scope by surface and neither uses feature names. `nexcue`: `backend`, `mobile`, `marketing`, `openapi`, `infra`, `ci`, `deps`, `docs`. `tarmoto` adds `companion`, `admin`, `shared`, `cross`, `ingest`, `poc-sensor`.
2. This repository's own `tasks/_template.md` already declares `Scope: backend | admin | panel | backend, admin | …` — surface-scoped, predating this design.
3. A surface enum is closed and derivable from the directory tree. A domain enum needs an edit every time a module or plugin lands, and an unmaintained enum is what produced `ligting-domain`.

**Accepted tradeoff:** release-note lines lose the domain signal — `feat(backend): add MCP OAuth artifact administration` rather than `feat(mcp): …`. The subject carries it instead. This is a real loss in exchange for a vocabulary that cannot rot.

### Enforcement surface

Both the PR title and every local commit, matching `tarmoto` exactly. Title-only enforcement would cover everything users see, since the title is what becomes the `main` commit subject and the release-note line. Local enforcement is added on top because `squash_merge_commit_message: COMMIT_MESSAGES` puts every commit message into the squash body, so unconstrained local commits still reach `main`.

### `subject-case` and acronyms

commitlint's `subject-case: [2, "always", "lower-case"]` rejects any uppercase character anywhere in the subject, which would reject `add MCP OAuth …`. `tarmoto` solved this with a custom `subject-first-char-lowercase` plugin rule that mirrors the CI `subjectPattern: ^(?![A-Z]).+$` exactly. That config is adopted verbatim rather than re-derived.

## Changes

| File | Change |
|---|---|
| `.github/workflows/lint-pr.yml` | New. `amannn/action-semantic-pull-request` pinned to `48f256284bd46cdaab1048c3721360e808335d50` (v6.1.1), the same SHA the other repositories use. `requireScope: true`, `subjectPattern: ^(?![A-Z]).+$`, triggered on `pull_request_target` for `opened`/`reopened`/`edited`/`synchronize` with `pull-requests: read`. |
| `commitlint.config.js` | New. `tarmoto`'s config, with this repository's scope enum: `type-enum` (11 types), `scope-enum` (13 scopes), `scope-empty: [2, "never"]`, `subject-case: [0]` disabled in favour of the custom `subject-first-char-lowercase` rule, `subject-empty: [2, "never"]`, `subject-full-stop: [2, "never", "."]`. |
| `.husky/commit-msg` | New. Runs commitlint on the message file. |
| `package.json` | Add `prepare: husky`, and devDependencies `@commitlint/cli` + `@commitlint/config-conventional`. |
| `.github/dependabot.yml` | Add `commit-message: { prefix: "chore", include: "scope" }` so Dependabot emits `chore(deps): bump …`. Also remove `target-branch: dev` — see below. |
| `CONTRIBUTING.md` | New. Documents the convention, the type and scope tables, and the PR flow. |
| `CLAUDE.md`, `AGENTS.md` | Add a Key Rules entry stating the format and the scope enum. |

### Incidental fix: Dependabot targets a branch that does not exist

`.github/dependabot.yml` sets `target-branch: dev`. The remote has only `main`, `docs/followups-count` and one `claude/*` branch — there is no `dev`. Dependabot has therefore been opening nothing. Removing the line restores it to `main`.

This is unrelated to the title convention, but it lands in the same file for the `commit-message` prefix, and leaving a known-dead config in a file being edited would be worse than fixing it. Called out separately in the PR description.

### Why the agent-facing docs matter most

Most PRs in this repository are agent-authored. The convention has never been stated in `CLAUDE.md` or `AGENTS.md`, which is the direct cause of the recent drift to imperative-sentence titles — nothing told the agent otherwise. CI alone would turn that into a red check on every PR rather than a correct title on the first try. The docs change is the part that actually prevents the failure; CI is the backstop.

## Rollout

The check applies to new pull requests only. No existing title changes, no history rewrite.

`docs/followups-count` is the one open branch without a PR; it will need a conforming title when opened.

Local enforcement takes effect for a contributor after their next `pnpm install` runs the `prepare` script.

## Open follow-up

`main` has no branch protection (`GET /branches/main/protection` → 404). The `lint-pr` check will report status but cannot block a merge until it is added as a required status check. Enabling branch protection is recommended and would also give teeth to the existing "never push directly to main" rule, which is currently policy-only. Left out of this change because it is a repository-admin decision with consequences beyond PR titles.

## Verification

- `commitlint` accepts each example in this document and rejects: a missing scope, a scope outside the enum, an uppercase first subject character, a trailing period, and an invalid type.
- `lint-pr.yml` is valid workflow YAML and its scope list matches `commitlint.config.js` exactly.
- `pnpm install` installs the husky hook; a non-conforming `git commit` is rejected locally.
- This PR's own title conforms.
