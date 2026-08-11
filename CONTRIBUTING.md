# Contributing to FastyBird Smart Panel

Thanks for contributing. This document covers the conventions that are enforced automatically — commit messages, PR titles, and the PR flow.

For development setup, see [README.md](./README.md). For architecture, see [docs/](./docs/).

## Commit messages and PR titles

Conventional commits. One logical change per commit.

```
<type>(<scope>): <subject>
```

The scope is **required** on both local commit messages and PR titles. `commitlint` enforces this on every commit via the husky `commit-msg` hook, and [`lint-pr.yml`](./.github/workflows/lint-pr.yml) enforces it again on the PR title.

This matters more than usual here. The repository squash-merges with `squash_merge_commit_title: COMMIT_OR_PR_TITLE`, so **the PR title becomes the commit subject on `main`**, and [`release-drafter.yml`](./.github/release-drafter.yml) renders `$TITLE` verbatim into published release notes. Every title ships to users.

### Types

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no behaviour change |
| `refactor` | Restructuring that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Maintenance, tooling, dependency bumps |
| `perf` | A performance improvement |
| `ci` | CI configuration and workflows |
| `build` | Build system, packaging, toolchain |
| `revert` | Reverting a previous commit |

### Scopes

The scope is the **surface** you changed, not the feature domain. The domain belongs in the subject.

| Scope | Covers |
|---|---|
| `backend` | `apps/backend/**` |
| `admin` | `apps/admin/**` |
| `panel` | `apps/panel/**` |
| `website` | `apps/website/**` |
| `testing` | `apps/testing/**` — the testing app |
| `sdk` | `packages/**` — extension SDK and the example extension |
| `installer` | `build/**` (installer package, raspbian image, service scripts), `scripts/**` (`install-server.sh`, `install-display.sh`), `apps/get-script/**` (the site serving `get.smart-panel.fastybird.com`) |
| `spec` | `spec/**` — OpenAPI plus device, channel, display and weather specs |
| `infra` | `docker/**`, `docker-compose.yml`, `Makefile`, `bin/**`, and root workspace tooling (`package.json`, `pnpm-workspace.yaml`, `melos.yaml`, `tsconfig*`, linter and formatter config) |
| `ci` | `.github/**` |
| `deps` | Dependency bumps |
| `docs` | `docs/**` and root `*.md` |
| `tasks` | `tasks/**` |
| `cross` | Genuinely cross-cutting changes |

Use `cross` for changes that genuinely span several surfaces — never omit the scope instead.

The scope list is deliberately closed and derived from the directory layout, so it changes only when the monorepo gains a top-level surface, not when a module or plugin is added. Adding a scope means editing three files together: [`commitlint.config.js`](./commitlint.config.js), [`.github/workflows/lint-pr.yml`](./.github/workflows/lint-pr.yml), and this table.

### Subject

- Must **not start with an uppercase letter**, in any script — `Add …`, `Čeština …` and `Überarbeiten …` are all rejected. Acronyms later in the subject are fine: `add MCP OAuth artifact administration` is valid. Digits and punctuation are allowed as the first character.
- No trailing period.
- Imperative mood — "add", "fix", "drop", not "added" or "adds".
- Keep the whole header at 100 characters or fewer, including the `type(scope): ` prefix.

### Breaking changes

Mark them with `!` before the colon:

```
feat(backend)!: require authentication during the websocket handshake
```

The `!` alone does not file the change under **Breaking Changes** in the release notes — `release-drafter.yml` categorises by label, so add the `breaking change` label as well.

### Examples

```
feat(backend): add MCP OAuth artifact administration
fix(admin): recover the websocket after the machine wakes from sleep
build(panel): upgrade Flutter toolchain
refactor(admin): let stores declare their own refresh contract
docs(tasks): close the virtual devices epic
chore(deps): bump actions/checkout from 4 to 5
chore(cross): align PR workflow docs and automation
feat(backend)!: require authentication during the websocket handshake
```

Rejected, with the fix:

| Rejected | Why | Instead |
|---|---|---|
| `Add MCP OAuth bootstrap route set` | No type, no scope | `feat(backend): add MCP OAuth bootstrap route set` |
| `fix: ignore build metadata when comparing versions` | Missing scope | `fix(backend): ignore build metadata when comparing versions` |
| `feat(mcp): add OAuth resource validation` | `mcp` is not a scope — it is a domain | `feat(backend): add MCP OAuth resource validation` |
| `feat(panel): Add device hardware control service` | Subject starts uppercase | `feat(panel): add device hardware control service` |
| `security(backend): harden auth and headers` | `security` is not a type | `fix(backend): harden auth and headers` |
| `doc(zigbee): add task definition` | `doc` is not a type; `zigbee` is not a scope | `docs(tasks): add Zigbee integration task definition` |

## Before opening a PR

Run these locally and make sure they pass:

```bash
pnpm run lint:js                # Lint TypeScript
pnpm run pretty:check           # Formatting
pnpm run test:unit              # Backend unit tests
pnpm run test:e2e               # Backend E2E tests

pnpm --filter ./apps/admin run test:unit   # Admin unit tests

melos analyze                   # Dart / Flutter analysis
```

If you changed backend Swagger decorators or device/channel specs, regenerate rather than hand-editing:

```bash
pnpm run generate:openapi
pnpm run generate:spec
melos rebuild-all               # Flutter API client and specs
```

Never edit generated files directly — see the "Generated Code" section in [CLAUDE.md](./CLAUDE.md).

## Pull request flow

1. **Never push directly to `main`.** Branch first — `feature/…`, `fix/…` or `chore/…`, which is also what [`labeler.yml`](./.github/labeler.yml) uses to apply labels.
2. Push the branch and open a PR against `main`.
3. The PR title must follow the convention above — it becomes the squash commit message.
4. Link the GitHub issue the PR resolves.
5. Check the labels. `actions/labeler` applies branch- and path-based labels automatically; add anything missing, especially `breaking change`, which drives release-note categorisation.
6. Summarise the change, note the regression surface, and record how you verified it.
7. Add tests for new business logic. If you skipped tests, explain why in the PR description.
8. Merge with **Squash and merge**.

## Database changes

Always create an incremental migration file for a schema change, for example `1000000000002-AddTokenLastUsedAt.ts`. Never modify the initial migration — alpha releases are deployed and existing installations have already run it.

```bash
cd apps/backend
pnpm run typeorm:migration:run
```

## Getting help

Open an issue on the [issue tracker](https://github.com/FastyBird/smart-panel/issues).
