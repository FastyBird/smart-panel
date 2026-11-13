# Cameras — Plan 3b: go2rtc in server installations (UP-4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every supported server install target (Raspberry Pi image, `install-server.sh`, Docker image) and every
existing installation (through the system update worker) carries a pinned, checksum-verified go2rtc binary at the path
the cameras module uses by default, and a failure to fetch it never fails an installation or update.

**Architecture:** One POSIX `sh` installer, `build/go2rtc/install-go2rtc.sh`, reads a pin file
(`build/go2rtc/pin.env`: version plus SHA-256 per architecture), downloads one release asset, verifies it, smoke-runs
it, and replaces the installed binary atomically. The backend build copies installer and pin into `dist/go2rtc/`, the
only directory shared by the npm package, the image update tarball, the first-boot image files and the Docker backend.
Each call site runs that copy (Docker runs the repo copy in a build stage). Default mode never fails the caller;
`--strict` exists for image builds.

**Tech Stack:** POSIX sh, curl, node:test (`.mjs`) for shell tests, Jest (existing `update-worker.spec.ts`),
shellcheck, GitHub Actions, Docker multi-stage.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §6 (D5), §7.2, §17 (risk "go2rtc
binary distribution on all install targets"). Issue #1180, epic #1175. Roadmap:
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §1 A8, §5 Plan 3 UP-4. Sibling: UP-3 (#1179) defines the
binary path constant this plan installs to.

## Global Constraints

- Branch `feat/cameras-go2rtc-installer` from `main`. One PR titled
  `feat(installer): ship go2rtc with server installations`, body `Closes #1180`. Merging does not depend on the UP-3
  backend relay except for the path constant below.
- Commit messages `<type>(<scope>): <lowercase imperative subject>`; scopes: `installer` for `build/**` and
  `scripts/**`, `infra` for `docker/**` and `.dockerignore`, `ci` for `.github/**`, `docs` for root `*.md`, `backend`
  for `apps/backend/**`. Every commit ends with `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`. The PR
  body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Never push to `main`. Do not edit the generated files listed in `CLAUDE.md`.
- **Interface assumption (UP-3):** the constant `GO2RTC_DEFAULT_BINARY_PATH` (string literal in `apps/backend/src/modules/cameras/cameras.constants.ts`, next to `GO2RTC_INSTALL_DIR`) equals
  `/usr/local/lib/smart-panel/go2rtc/go2rtc`. Installer default directory: `/usr/local/lib/smart-panel/go2rtc`,
  binary file name `go2rtc`. Task 8 adds a guard test that compares the two once UP-3 has merged.
- **Pin (development value, UP-0 may change it):** go2rtc `1.9.15` (GitHub release `v1.9.15`, 2026-10-25, latest at
  planning time). Release assets are bare binaries, no zip, no checksum file. SHA-256 values below equal both the
  `digest` GitHub publishes per asset (`gh release view v1.9.15 --repo AlexxIT/go2rtc --json assets`) and a hash
  computed locally from the downloaded assets (binaries were hashed, never executed):

  | Architecture | Release asset | Pin key | SHA-256 |
  |---|---|---|---|
  | linux amd64 | `go2rtc_linux_amd64` | `GO2RTC_SHA256_LINUX_AMD64` | `20b46c6910734cb05ecefb234066f36868ff19b42ba1418a7a32e13a3e035712` |
  | linux arm64 | `go2rtc_linux_arm64` | `GO2RTC_SHA256_LINUX_ARM64` | `af416f22b21a24ab83b8d78642190b4932ae695b4e386853f11d1b0319781763` |
  | linux armv7 (32-bit) | `go2rtc_linux_arm` (built with `GOARM=7`; there is **no** `armv7` asset) | `GO2RTC_SHA256_LINUX_ARM` | `cbffe4075a004e2015fd9d7e324800ab7968b52f49e9ce803361879d5e246028` |

  The upstream `go2rtc_linux_armv6` asset (Pi 1 / Zero) is deliberately not pinned: Node 24 has no ARMv6 build, so
  Smart Panel cannot run there.
- Installer download URL: `https://github.com/AlexxIT/go2rtc/releases/download/v<VERSION>/<asset>`; curl flags
  `--proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 60 --retry 2 --retry-delay 2 -fsSL`
  (same style as `update-worker.sh` download, which uses `--proto '=https'` and `--max-time 300`).
- Installer exit codes: `0` installed, already installed, skipped, or **any** failure (warning on stderr); `1` a
  failure while `--strict` is set; `2` unknown option (usage error). Messages are prefixed `go2rtc: `.
- Installer options: `--skip`, `--strict`, `--arch <name>`, `--dir <path>`, `--help`. Opt-out sources, any one skips
  everything with exit 0 and no network: `--skip`, env `FB_SKIP_GO2RTC=1`, marker file `/etc/smart-panel/go2rtc.skip`.
  The marker exists because the privileged update helper clears the worker environment
  (`apps/backend/src/modules/system/scripts/privileged/helper.py:246-247`), so an env var cannot reach updates.
  Test-only hooks: `FB_GO2RTC_PIN_FILE` (default `<script dir>/pin.env`), `FB_GO2RTC_SKIP_FILE` (default the marker).
- Architecture normalisation: source order `--arch`, then `dpkg --print-architecture`, then `uname -m`.
  `amd64|x86_64` → amd64; `arm64|aarch64` → arm64; `arm|armhf|armv7|armv7l` → arm; everything else (including
  `armv6l`, `armel`, `i386`) is unsupported (warn, exit 0). Independently of the source, `uname -m` = `armv6l` is
  unsupported (Raspberry Pi OS armhf userland runs on ARMv6 boards).
- Pin parsing never sources the file: each key is read with `grep`/`sed` and must match `^[0-9A-Za-z.]+$`
  (version) or `^[0-9a-f]{64}$` (checksums); anything else is a warning, not an install.
- Idempotency is by content: if `<dir>/go2rtc` exists and its SHA-256 equals the pinned one for the architecture, the
  script exits 0 without a network call. Otherwise it converges to the pin (newer or older).
- Install result: directory `0755`, `go2rtc` `0755`, `LICENSE` `0644` (copy of `build/go2rtc/LICENSE`), owner root when
  run as root. No file is left behind on any exit (trap on EXIT, HUP, INT, TERM).
- Shell style: tabs, `set -eu`, no bashisms (`[[`, arrays, `echo -e`, `local`), so it runs under dash, busybox
  (Alpine) and bash. Checked with `shellcheck --severity=warning`.
- Network tests are forbidden: tests replace `curl` through `PATH`.

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first. Each is pinned by a test in
the task named at the end of the line.

1. **Raspberry Pi Zero / 1 (`uname -m` = `armv6l`, dpkg says `armhf`)**: nothing is installed, a warning names the
   board class, exit 0. Installing the ARMv7 asset would fail with SIGILL at first start. `install-server.sh:143`
   maps `armv6l` to `armv7`, so its `get_arch` must not be reused. → Task 2.
2. **32-bit userland on a 64-bit kernel (`uname -m` = `aarch64`, dpkg says `armhf`)**: the `arm` asset is installed,
   not `arm64` (an arm64 binary cannot execute on that userland). → Task 2.
3. **Truncated or tampered download, or a download that dies mid-transfer**: the previously installed binary is
   untouched, no partial file is visible at the final path, exit 0 with a checksum warning (1 with `--strict`). → Task 2.
4. **`curl | bash` of `install-server.sh` from `main` while the newest published npm package predates this change**
   (no `dist/go2rtc/`): warning "this release does not bundle go2rtc", installation continues. The get-script worker
   serves `scripts/install-server.sh` from `raw.githubusercontent.com/.../main` (`apps/get-script/_worker.js:14-17`),
   so the script goes live on merge, before the next release. → Task 4.
5. **GitHub unreachable or hanging during a system update (air-gapped panel)**: the update still ends in `complete`,
   bounded by a hard timeout, never `failed`/held. → Task 7.

---

## File structure

| Path | Responsibility |
|---|---|
| `build/go2rtc/pin.env` (new) | Version + three SHA-256 values. Only file to edit for a version bump. |
| `build/go2rtc/LICENSE` (new) | Verbatim upstream MIT text at the pinned tag; installed next to the binary. |
| `build/go2rtc/install-go2rtc.sh` (new) | The installer. One responsibility: converge the install dir to the pin. |
| `THIRD-PARTY-NOTICES.md` (new, repo root) | go2rtc entry with MIT text. |
| `build/tests/install-go2rtc.test.mjs` (new) | Behaviour tests of the installer with a fake `curl`. |
| `build/tests/install-server-go2rtc.test.mjs` (new) | Extracts `install_go2rtc` from `install-server.sh` (same regex-extraction technique as `build/tests/migrate-privileges.test.mjs`) and runs it with stubs. |
| `apps/backend/package.json` | `build:go2rtc` copy step chained into `build`. |
| `scripts/install-server.sh` | `--skip-go2rtc`, `install_go2rtc()` after the npm install. |
| `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh` | Image-time call, `--strict`. |
| `docker/prod/Dockerfile`, `.dockerignore`, `scripts/test-docker-runtime.sh` | Fetch stage, copy into runtime, smoke assertion. |
| `apps/backend/src/modules/system/scripts/update-worker.sh` + `update-worker.spec.ts` | `install_go2rtc_nonfatal` and three call sites. |
| `.github/workflows/ci-tests.yaml` | Job `installer-script-checks`. |
| `build/docs/INSTALLATION.md`, `build/raspbian/README.md` | Opt-out and behaviour docs. |

Task order is dependency order; every task leaves the tree green.

---

### Task 1: Pin file, licence and third-party notices

**Files:**
- Create: `build/go2rtc/pin.env`, `build/go2rtc/LICENSE`, `THIRD-PARTY-NOTICES.md`
- Test: `build/tests/install-go2rtc.test.mjs` (created here, extended in Task 2)

**Interfaces:**
- Produces: pin keys `GO2RTC_VERSION`, `GO2RTC_SHA256_LINUX_AMD64`, `GO2RTC_SHA256_LINUX_ARM64`,
  `GO2RTC_SHA256_LINUX_ARM` (values in Global Constraints). Task 2 reads exactly these keys.

- [ ] **Step 1: Write the failing pin test** in `build/tests/install-go2rtc.test.mjs` (node:test +
  `node:assert/strict`, files read relative to `import.meta.url`):
  - `pin.env lists a version and one 64-hex checksum for each supported architecture`: version matches
    `^\d+\.\d+\.\d+$`; the three checksum keys match `^[0-9a-f]{64}$`; no other non-comment key exists.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test build/tests/install-go2rtc.test.mjs`
Expected: FAIL, `ENOENT ... build/go2rtc/pin.env`.

- [ ] **Step 3: Create `build/go2rtc/pin.env`** (`KEY=value` lines, `#` comments). Header comment states: pinned
  release `v1.9.15`, checksums equal the GitHub asset `digest` values and were verified against locally downloaded
  assets, "UP-0 (#1176) may change the version; to bump, run `gh release view v<ver> --repo AlexxIT/go2rtc --json assets
  -q '.assets[]|select(.name|startswith("go2rtc_linux"))|"\(.name) \(.digest)"'`, compare with `shasum -a 256` of the
  downloaded assets, edit this file only". Then the four keys with the values from the Global Constraints table.

- [ ] **Step 4: Create `build/go2rtc/LICENSE`**: exact upstream text at the pinned tag.

Run: `gh api "repos/AlexxIT/go2rtc/contents/LICENSE?ref=v1.9.15" -q .content | base64 -d > build/go2rtc/LICENSE`
Expected: 21 lines, first line `MIT License`, third `Copyright (c) 2022 Alexey Khit`.

- [ ] **Step 5: Run the test, expect PASS and commit**

Run: `node --test build/tests/install-go2rtc.test.mjs`
Expected: 1 test passes.

```bash
git add build/go2rtc/pin.env build/go2rtc/LICENSE build/tests/install-go2rtc.test.mjs
git commit -m "feat(installer): pin go2rtc 1.9.15 with per-architecture checksums"
```

- [ ] **Step 6: Write the failing notices test**, same file:
  - `THIRD-PARTY-NOTICES.md names go2rtc, its MIT licence and reproduces the pinned licence text verbatim`:
    `notices.includes(licenseFileContents.trim())`, includes `https://github.com/AlexxIT/go2rtc`, includes `MIT`.
  Run it; expected FAIL (`ENOENT ... THIRD-PARTY-NOTICES.md`).

- [ ] **Step 7: Create `THIRD-PARTY-NOTICES.md`**: intro (Smart Panel is Apache-2.0 per `LICENSE.md`; the listed
  software is downloaded at install time and is not part of this repository or the npm packages); one section
  `go2rtc` with: purpose (camera stream relay run by the cameras module), version "see `build/go2rtc/pin.env`",
  licence MIT, copyright line, project URL, licence URL
  `https://github.com/AlexxIT/go2rtc/blob/master/LICENSE`, then the full licence text in a fenced block.

- [ ] **Step 8: Run the test, expect PASS and commit**

Run: `node --test build/tests/install-go2rtc.test.mjs`
Expected: 2 tests pass.

```bash
git add THIRD-PARTY-NOTICES.md build/tests/install-go2rtc.test.mjs
git commit -m "docs(docs): add third-party notices for go2rtc"
```

---

### Task 2: The installer script

**Files:**
- Create: `build/go2rtc/install-go2rtc.sh` (mode `0755`)
- Modify: `build/tests/install-go2rtc.test.mjs`

**Interfaces:**
- Consumes: pin keys from Task 1.
- Produces: CLI `install-go2rtc.sh [--skip] [--strict] [--arch <name>] [--dir <path>] [--help]`; env `FB_SKIP_GO2RTC`;
  marker `/etc/smart-panel/go2rtc.skip`; test hooks `FB_GO2RTC_PIN_FILE`, `FB_GO2RTC_SKIP_FILE`; exit codes and
  `go2rtc: ` message prefix from Global Constraints. Tasks 4-7 call it as `sh <path>/install-go2rtc.sh [options]`.

**Test harness** (in the test file, before the tests):
- `makeSandbox({ uname, dpkg, curl })` creates a temp dir containing `bin/` (fake tools) and `toolbox/` (symlinks to
  the real `sh mktemp mv cp rm mkdir chmod cat grep sed tr awk dirname basename id printf head install` and whichever
  of `sha256sum`/`shasum` exists). The script runs with `PATH=<sandbox>/bin:<sandbox>/toolbox` only, so the real
  `curl`, `dpkg`, `uname` are never reachable and results do not depend on the host.
- Fake `uname -m` prints the given value. Fake `dpkg --print-architecture` prints the given value, or is absent.
- Fake `curl` appends all its arguments as one line to `<sandbox>/curl.log`, finds the `-o <file>` argument and the
  URL, and copies `<sandbox>/served/<basename of URL>` to the output (exit 22 when absent, like `curl -f`). A mode
  file `<sandbox>/curl.mode` can switch it to `truncate` (writes the first half of the file, exits 18).
- The "binary" is a shell script: `#!/bin/sh` / `echo "go2rtc version 9.9.9 (stub) linux/test"`. A test pin file
  (`<sandbox>/pin.env`, passed through `FB_GO2RTC_PIN_FILE`) sets `GO2RTC_VERSION=9.9.9` and the stub's real SHA-256
  for all three keys. Tests that need a different hash write a different pin file.
- Helper `run(args, env)` returns `{ status, stdout, stderr }` from `spawnSync('sh', [script, ...args])` with
  `FB_GO2RTC_SKIP_FILE` pointing at a non-existent path unless a test sets it.

- [ ] **Step 1: Write the failing tests.** One `it` per line; each asserts exactly what follows the colon.
  - `installs the pinned binary for amd64`: `--arch amd64 --dir <d>`; status 0; `<d>/go2rtc` content equals the
    stub; mode `0755`; `<d>/LICENSE` equals `build/go2rtc/LICENSE`; curl.log has exactly one line containing
    `/releases/download/v9.9.9/go2rtc_linux_amd64`; no other entry in `<d>` (no temp leftovers); stdout contains
    `go2rtc: installed 9.9.9`.
  - `requests the asset that matches each architecture`: `--arch` `arm64`→`go2rtc_linux_arm64`, `arm`→`go2rtc_linux_arm`,
    `armhf`→`go2rtc_linux_arm`, `aarch64`→`go2rtc_linux_arm64`, `x86_64`→`go2rtc_linux_amd64`.
  - `is a no-op when the installed binary already matches the pin`: install twice; second run status 0, curl.log
    still one line, `<d>/go2rtc` inode unchanged, stdout contains `already installed`.
  - `replaces a different installed binary and keeps the install directory clean`: pre-seed `<d>/go2rtc` with other
    content; after run, content is the stub and the inode differs (rename-based replace).
  - `keeps the existing binary and exits 0 on a checksum mismatch`: serve different bytes; pre-seeded binary
    unchanged byte for byte; status 0; stderr contains `go2rtc: warning` and `checksum mismatch`; `<d>` has no
    temp entries.
  - `exits 1 on a checksum mismatch with --strict`.
  - `never exposes a truncated download` (curl mode `truncate`): status 0, `<d>/go2rtc` absent when none existed,
    unchanged when one did; stderr contains `download failed`.
  - `exits 0 with a warning when the download fails` (nothing served): stderr contains `download failed`; with
    `--strict` status 1.
  - `warns and exits 0 when curl is missing` (toolbox without curl): stderr contains `curl is required`.
  - `reports an unsupported architecture without downloading`: `--arch i386`, `--arch armv6l`, `--arch riscv64`;
    status 0; stderr contains `unsupported architecture`; curl.log empty or absent.
  - `treats an ARMv6 board as unsupported even when dpkg reports armhf`: fake uname `armv6l`, dpkg `armhf`, no
    `--arch`; status 0; stderr contains `ARMv6`; no download.
  - `uses the 32-bit asset on a 32-bit userland with a 64-bit kernel`: uname `aarch64`, dpkg `armhf`; curl.log has
    `go2rtc_linux_arm` and not `go2rtc_linux_arm64`.
  - `falls back to uname when dpkg is not available`: no dpkg, uname `x86_64`; asset `go2rtc_linux_amd64`.
  - `skips without touching anything for --skip, FB_SKIP_GO2RTC=1 and the marker file`: three runs; each status 0,
    stdout contains `skipped`, `<d>` not created, curl.log absent.
  - `rejects a malformed pin file`: missing key, uppercase checksum, 63-char checksum, `GO2RTC_VERSION=1.9.15;rm`;
    each: status 0, stderr contains `pin`, no download; a `$(touch <sandbox>/pwned)` value proves the file is not
    sourced (`pwned` absent).
  - `does not install a binary that cannot run` (stub whose `--version` exits 126): status 0, nothing installed,
    stderr contains `does not run`.
  - `warns and exits 0 when the install directory cannot be created` (`--dir` under a read-only dir; skipped when
    the test runs as root): stderr contains `cannot create`.
  - `rejects an unknown option with exit 2`.
  - `--help prints the option list and exits 0`.

- [ ] **Step 2: Run to see failures**

Run: `node --test build/tests/install-go2rtc.test.mjs`
Expected: every new test FAILS (script missing, `sh: ...install-go2rtc.sh: No such file`).

- [ ] **Step 3: Implement `build/go2rtc/install-go2rtc.sh`** with these functions (names fixed so the file reviews
  against the tests): `log`, `warn` (stderr, prefix `go2rtc: warning: `), `fail` (calls `warn`, then `exit 1` when
  `STRICT=1`, else `exit 0`), `read_pin KEY`, `detect_arch` (prints amd64|arm64|arm or returns 1 after `warn`),
  `sha256_of FILE`, `main`. Behaviour, in order:
  1. Parse options (unknown → usage on stderr, exit 2). Skip check (flag, env, marker) → `log "skipped"`, exit 0.
  2. Resolve arch; resolve pin file (`FB_GO2RTC_PIN_FILE` or `$(dirname "$0")/pin.env`; `$0` is made absolute with
     `cd`/`pwd`); read the four keys with `read_pin` (validation per Global Constraints).
  3. If `<dir>/go2rtc` exists and `sha256_of` equals the pinned value: `log "already installed"`, exit 0.
  4. Require `curl`. `mkdir -p <dir>` (failure → `fail "cannot create <dir>"`). `TMP=$(mktemp -d "<dir>/.install.XXXXXX")`;
     `trap 'rm -rf "$TMP"' EXIT HUP INT TERM`.
  5. Download to `$TMP/go2rtc` with the curl flags from Global Constraints. Verify SHA-256 against the pin
     (`checksum mismatch: expected <8 hex>..., got <8 hex>...`, never print whole hashes twice). `chmod 0755`.
     Smoke: `"$TMP/go2rtc" --version` (wrapped in `timeout 10` when available) must print a line starting
     `go2rtc version <VERSION>`; else `fail "downloaded binary does not run on this system"`.
  6. `mv -f "$TMP/go2rtc" "<dir>/go2rtc"` (same filesystem, so the rename is atomic); copy `LICENSE` from the script
     directory through a temp name + `mv` when the source exists; `log "installed <VERSION> (<arch>) to <dir>"`.
  The sha tool is `sha256sum` when present, else `shasum -a 256`; neither present → `fail`. The default directory is
  a top-level assignment `DEFAULT_DIR=/usr/local/lib/smart-panel/go2rtc` (Task 8 reads it).

- [ ] **Step 4: Run tests, expect PASS**

Run: `node --test build/tests/install-go2rtc.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Lint**

Run: `shellcheck --severity=warning build/go2rtc/install-go2rtc.sh`
Expected: no output, exit 0.

- [ ] **Step 6: Real-asset smoke (manual, once, not committed).** Do not execute the real binary on the dev machine;
  instead run the installer into a scratch dir with the real pin and `--arch amd64` under `docker run --rm -v ...
  node:24-alpine` (`apk add curl` first) and check that `<dir>/go2rtc --version` prints `go2rtc version 1.9.15`.
  Expected: exit 0 and that line. This proves the pin's checksum matches what the CDN serves.

- [ ] **Step 7: Commit**

```bash
git add build/go2rtc/install-go2rtc.sh build/tests/install-go2rtc.test.mjs
git commit -m "feat(installer): add checksum-verified go2rtc installer"
```

---

### Task 3: Ship the installer inside the backend build output

Release trees contain only the backend `dist/`: the image update tarball is assembled from the published backend
package (`.github/workflows/alpha-release.yml:524-568`), the first-boot image copies `apps/backend/dist`
(`build/raspbian/build.sh:96`), npm installs resolve the backend package (`files: ["dist/", ...]`,
`apps/backend/package.json:45-51`). `nest-cli.json` assets only copy files below `src`, so a plain asset glob cannot
reach `build/go2rtc/`.

**Files:**
- Modify: `apps/backend/package.json:53` (`build` script) and add a `build:go2rtc` script
- Modify: `docker/prod/Dockerfile:74-78` (backend-builder stage) and `.dockerignore`

**Interfaces:**
- Produces: `dist/go2rtc/install-go2rtc.sh`, `dist/go2rtc/pin.env`, `dist/go2rtc/LICENSE` in every backend build.
  Tasks 4, 5, 7 consume `<backend root>/dist/go2rtc/install-go2rtc.sh`.

- [ ] **Step 1: Run the build to record the failing expectation**

Run: `pnpm --filter @fastybird/smart-panel-backend build && ls apps/backend/dist/go2rtc`
Expected: FAIL, `No such file or directory`.

- [ ] **Step 2: Add the scripts.** `"build:go2rtc": "mkdir -p dist/go2rtc && cp ../../build/go2rtc/install-go2rtc.sh
  ../../build/go2rtc/pin.env ../../build/go2rtc/LICENSE dist/go2rtc/"` and `"build": "nest build && pnpm run
  build:go2rtc"`. (Nest's `deleteOutDir` runs first, so the copy must come after it.)

- [ ] **Step 3: Docker context.** `.dockerignore` excludes `**/build` (line 3) and `*.md`; add `!build/go2rtc`
  directly below `**/build`. In the Dockerfile backend-builder stage add `COPY build/go2rtc/ build/go2rtc/` before
  the `RUN pnpm run generate:spec ...` at line 81 (the copy script reaches `../../build/go2rtc` from `/build/apps/backend`).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @fastybird/smart-panel-backend build && ls apps/backend/dist/go2rtc && cmp apps/backend/dist/go2rtc/pin.env build/go2rtc/pin.env`
Expected: three files listed, `cmp` silent.

Run: `docker buildx build --target backend-builder -f docker/prod/Dockerfile -t sp-be-check .` (Docker 29.9.3 is
installed locally.)
Expected: build succeeds (proves the `.dockerignore` exception works with the `**/build` pattern; if it fails with
`"/build/go2rtc": not found`, move the exception to `!/build/go2rtc/**`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json
git commit -m "feat(backend): bundle the go2rtc installer in the backend build output"
git add docker/prod/Dockerfile .dockerignore
git commit -m "feat(infra): let the docker backend build see the go2rtc installer"
```

---

### Task 4: `install-server.sh`

**Files:**
- Modify: `scripts/install-server.sh` (header options block lines 9-14, option parser 40-66, new function after
  `install_smart_panel` at 298-321, `main` 462-477)
- Create: `build/tests/install-server-go2rtc.test.mjs`

**Interfaces:**
- Consumes: `<backend root>/dist/go2rtc/install-go2rtc.sh` (Task 3), its exit-0 contract (Task 2).
- Produces: option `--skip-go2rtc` (writes the marker `/etc/smart-panel/go2rtc.skip`, so later updates also skip;
  the directory is overridable by env `GO2RTC_MARKER_DIR`, a test hook);
  functions `find_go2rtc_installer` (prints the path or returns 1) and `install_go2rtc` (never returns non-zero).

- [ ] **Step 1: Write the failing tests.** The test reads `scripts/install-server.sh`, extracts the two functions
  with `sed -n '/^find_go2rtc_installer() {/,/^}/p'` (and the same for `install_go2rtc`) into a temp file, and runs
  `bash -c 'set -e; source <funcs>; <call>'` with stubs for `print_step print_success print_warning`, a fake `npm`
  (`npm root -g` prints `<sandbox>/global`), `GO2RTC_MARKER_DIR` pointing into the sandbox. Tests:
  - `runs the installer shipped in the installed package`: stub installer at
    `<sandbox>/global/@fastybird/smart-panel/node_modules/@fastybird/smart-panel-backend/dist/go2rtc/install-go2rtc.sh`
    records its arguments; function returns 0; arguments empty.
  - `warns and continues when the installed release has no installer` (Review Focus 4): returns 0, warning text
    contains `does not bundle go2rtc`.
  - `continues when the installer fails`: stub exits 7; returns 0 under `set -e`; warning printed.
  - `--skip-go2rtc writes the marker and does not run the installer`: marker exists, stub not run, step message
    says skipped.
  - `an existing marker is left alone and still skips` (installer run with `FB_SKIP_GO2RTC` unset).

- [ ] **Step 2: Run to see failures**

Run: `node --test build/tests/install-server-go2rtc.test.mjs`
Expected: FAIL (functions not found in the script).

- [ ] **Step 3: Implement.** Add `SKIP_GO2RTC=false` and the `--skip-go2rtc) SKIP_GO2RTC=true; shift ;;` case, plus a
  header line `--skip-go2rtc    Do not install the go2rtc camera relay (also skips it on later updates)`.
  `find_go2rtc_installer`: `$(npm root -g)/@fastybird/smart-panel/node_modules/@fastybird/smart-panel-backend/dist/go2rtc/install-go2rtc.sh`
  (same layout `update-worker.sh:1553` uses), must be a regular file. `install_go2rtc`: when `SKIP_GO2RTC`, create
  `${GO2RTC_MARKER_DIR:-/etc/smart-panel}` and the marker, print a step message, return 0; otherwise locate the
  installer, run `sh "$installer" || true`-style under `if`, print `print_warning` on any failure, return 0. Call it
  in `main` immediately after `install_smart_panel` and **before** `configure_service` (the service starts there and
  the cameras module checks for the binary at start). Do not reuse `get_arch` (line 140-156 maps `armv6l` to `armv7`);
  the installer detects its own architecture.

- [ ] **Step 4: Clear the shellcheck baseline in this file, no behaviour change.** `shellcheck -f gcc
  scripts/install-server.sh` reports 13 warnings: SC2155 at lines 141, 161, 197, 198, 255, 268, 339, 349, 377, 415,
  453, 454 (split `local x=$(...)` into `local x` + `x=$(...)`), SC2034 at line 230 (`for i` → `for _`).

- [ ] **Step 5: Run tests and lint**

Run: `node --test build/tests/install-server-go2rtc.test.mjs && shellcheck --severity=warning scripts/install-server.sh && bash -n scripts/install-server.sh`
Expected: tests pass, no shellcheck output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/install-server.sh build/tests/install-server-go2rtc.test.mjs
git commit -m "feat(installer): install go2rtc from install-server.sh"
```

---

### Task 5: Raspberry Pi image

The roadmap names `build/raspbian/stage-smart-panel/00-install-deps/01-run-chroot.sh`, but that script runs in the
chroot and sees only the rootfs; the repo is not mounted and `00-install-deps` has no `00-run.sh` to copy files in.
The only application files in the rootfs are `/tmp/smart-panel-files/app` (copied by `01-install-app/00-run.sh:10`,
which `build.sh:96` fills with `apps/backend/dist`, now including `dist/go2rtc/`). So the call goes into
`01-install-app/01-run-chroot.sh`. The display variant does not include this sub-stage (`variants/display.conf`), so
it gets no go2rtc; the `aio` variant does.

**Files:**
- Modify: `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh` (after the `chown`/`chmod` at lines
  145-148, before the temp-file cleanup at line 151)
- Modify: `build/raspbian/README.md` (what is included, lines 11-20)

**Interfaces:**
- Consumes: `${APP_INSTALL_DIR}/dist/go2rtc/install-go2rtc.sh` (variable defined at line 21).

- [ ] **Step 1: Check the baseline.** `shellcheck --severity=warning` on this file is already clean (0 findings).

- [ ] **Step 2: Add the call.** Insert a block with the shape of the InfluxDB step in
  `00-install-deps/01-run-chroot.sh:55-71`: `echo "Installing go2rtc..."`, then
  `sh "${APP_INSTALL_DIR}/dist/go2rtc/install-go2rtc.sh" --strict` and, on failure, `echo "ERROR: go2rtc installation
  failed" >&2; exit 1`. A missing installer file (stale prepared app files) is the same error. `--strict` makes a
  published image impossible without the binary; decision 3 below lets the maintainer drop it, in which case the
  failure branch becomes a `WARNING:` like the InfluxDB step.

- [ ] **Step 3: Verify syntax and lint**

Run: `bash -n build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh && shellcheck --severity=warning build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh`
Expected: no output.

- [ ] **Step 4: Rehearse the installer as the stage runs it** (no pi-gen build). Use the built
  `apps/backend/dist/go2rtc/` from Task 3:

Run: `docker run --rm --platform linux/arm64 -v "$PWD/apps/backend/dist/go2rtc:/g:ro" debian:bookworm-slim sh -c 'apt-get update -qq && apt-get install -y -qq curl ca-certificates && sh /g/install-go2rtc.sh --strict && /usr/local/lib/smart-panel/go2rtc/go2rtc --version'`
Expected: last line `go2rtc version 1.9.15 (...) linux/arm64`, exit 0. (Needs arm64 emulation; on an amd64-only
machine use `--platform linux/amd64` and say so in the PR.)

- [ ] **Step 5: Document.** README "What's Included": add "go2rtc 1.9.15 camera relay (`/usr/local/lib/smart-panel/go2rtc`)"
  and a note that `/etc/smart-panel/go2rtc.skip` disables updates of it.

- [ ] **Step 6: Commit**

```bash
git add build/raspbian
git commit -m "feat(installer): install go2rtc in the Raspberry Pi image"
```

---

### Task 6: Docker image

**Files:**
- Modify: `docker/prod/Dockerfile` (new stage between lines 84 and 86; runtime stage at 89-129 gains one `COPY`;
  stage comment numbers shift)
- Modify: `.dockerignore` (exception already added in Task 3)
- Modify: `scripts/test-docker-runtime.sh` (after readiness, before the final success path, lines ~75-119)

**Interfaces:**
- Consumes: `build/go2rtc/` from the build context; Docker's `TARGETARCH` (`amd64`, `arm64`; the workflow builds
  `linux/amd64` and `linux/arm64` natively, `.github/workflows/build-docker-image.yml:58-62`).
- Produces: `/usr/local/lib/smart-panel/go2rtc/go2rtc` and `LICENSE` in the runtime image.

- [ ] **Step 1: Add the failing assertion first** to `scripts/test-docker-runtime.sh`: run
  `docker run --rm "${platform_args[@]}" --entrypoint /usr/local/lib/smart-panel/go2rtc/go2rtc "$image" --version`
  and require its first line to start `go2rtc version `; on failure print `go2rtc binary missing or not runnable in
  the runtime image` and `exit 1`. Reuse the optional `--platform` handling already at lines 40-42.

- [ ] **Step 2: Build the current Dockerfile and run the script to see it fail**

Run: `docker buildx build -f docker/prod/Dockerfile -t sp-check:before --load . && bash scripts/test-docker-runtime.sh sp-check:before 0.0.0`
Expected: FAIL with the new message. 

- [ ] **Step 3: Add the build stage and copy.**

```dockerfile
# Stage 3: go2rtc relay binary (pinned release, SHA-256 verified)
FROM node:24-alpine AS go2rtc
ARG TARGETARCH
RUN apk add --no-cache curl ca-certificates
COPY build/go2rtc/ /installer/
RUN sh /installer/install-go2rtc.sh --strict --arch "${TARGETARCH}" --dir /out/go2rtc
```

  and in the runtime stage after `COPY var/ /app/var/` (line 108):
  `COPY --from=go2rtc /out/go2rtc/ /usr/local/lib/smart-panel/go2rtc/`. Renumber the runtime stage comment to
  "Stage 4". Docker builds the runtime on musl: the release asset is a static Go binary, the smoke run in the stage
  proves it.

- [ ] **Step 4: Verify both architectures**

Run: `docker buildx build --platform linux/amd64 -f docker/prod/Dockerfile -t sp-check:amd64 --load . && bash scripts/test-docker-runtime.sh sp-check:amd64 "$(node -p "require('./apps/backend/package.json').version")" linux/amd64`
Expected: passes, including the new assertion.
Run the same with `linux/arm64` where emulation is available; otherwise build only the stage:
`docker buildx build --platform linux/arm64 --target go2rtc -f docker/prod/Dockerfile .` (the stage's own smoke run
needs emulation too). Record which was run in the PR. **No pull-request workflow builds this Dockerfile**
(`build-docker-image.yml` is `workflow_call`/`workflow_dispatch` only), so these local runs are the only pre-merge
evidence.

- [ ] **Step 5: Lint and commit**

Run: `shellcheck --severity=warning scripts/test-docker-runtime.sh`
Expected: no output.

```bash
git add docker/prod/Dockerfile scripts/test-docker-runtime.sh
git commit -m "feat(infra): ship go2rtc in the production docker image"
```

---

### Task 7: Existing installations through the update worker

**Files:**
- Modify: `apps/backend/src/modules/system/scripts/update-worker.sh` (new function near `provision_helper`, line
  51-60; call sites after line 1307, after line 1569, before line 1664)
- Modify: `apps/backend/src/modules/system/scripts/update-worker.spec.ts` (fixture archive near line 80-82; new
  `describe` after line 416's block; `runWorker` passes through `overrides`)

**Interfaces:**
- Consumes: `<release backend root>/dist/go2rtc/install-go2rtc.sh` (Task 3). Image release root =
  `$NEW_VERSION_DIR`; npm release root = `$NPM_BACKEND_ROOT` (line 1553).
- Produces: `install_go2rtc_nonfatal <release root>` (always returns 0, never calls `update_status`/`hold_attempt`);
  env `GO2RTC_INSTALL_TIMEOUT_SECONDS` (default `120`), defined next to `START_TIMEOUT_SECONDS` (line 90).

Placement (the service must not be started before the binary exists; the cameras module reports `unavailable` and does
not respawn until config changes, UP-3 outline):
- **Image path:** after the ownership block (line 1307, release tree is `root:root`, `go-w`) and before
  "Stop/qualify service" (line 1309): the old service still runs, so there is no downtime.
- **npm, helper-managed:** after `provision_helper` succeeds (line 1569) and before native workspaces are chowned
  (line 1572). Service is already stopped here; the timeout bounds the added downtime.
- **npm, legacy:** after the `npm install -g` pair (lines 1651-1662), before "Run database migrations" (line 1664).

Execution: `HELPER_MANAGED=1` (root) → `timeout "$GO2RTC_INSTALL_TIMEOUT_SECONDS" /bin/sh "$script"` with
`</dev/null`; otherwise the same through `sudo -n`. The script must be a regular, non-symlink file (same check as
`provision_helper`, line 55). Trust model: the helper already executes `install-helper.py` from the new release tree
as root (line 59), after the tree is root-owned; this runs one more script from that same tree.

- [ ] **Step 1: Write the failing tests** (`describe('go2rtc installer hook')`, legacy image path like the existing
  suite; the fixture `sudo` stub runs the command directly). Extend `createFixture` so the archive may contain
  `dist/go2rtc/install-go2rtc.sh` written by the test (the archive is rebuilt with `tar` as at line 91):
  - `runs the release's installer before the service is stopped`: stub writes `$(cat "$SERVICE_STATE_FILE")` and its
    own path to `<root>/go2rtc-ran`; worker status `success`; file content `active`; path is under the new version
    directory.
  - `completes the update when the installer fails`: stub `exit 7`; worker `success`; `update-status.json` has
    `"status": "complete"`; output contains `go2rtc`.
  - `completes the update when the release has no installer`: archive without `dist/go2rtc`; `success`, `complete`.
  - `bounds a hanging installer` (Review Focus 5): stub `sleep 30`, `GO2RTC_INSTALL_TIMEOUT_SECONDS=1`; worker
    `success` and returns within 15 s (assert elapsed time).
  - `does not follow a symlinked installer`: `dist/go2rtc/install-go2rtc.sh` is a symlink in the archive; stub target
    never runs; update completes.
  - `an opt-out marker is honoured by the real installer` is covered by Task 2 tests; not repeated here.

- [ ] **Step 2: Run to see the failures**

Run: `pnpm --filter @fastybird/smart-panel-backend exec jest src/modules/system/scripts/update-worker.spec.ts -t "go2rtc installer hook"`
Expected: FAIL (first test: `go2rtc-ran` missing; the others may pass trivially, which is fine).

- [ ] **Step 3: Implement `install_go2rtc_nonfatal`** and the three calls. Failure path: one line to stderr
  `go2rtc installer did not complete; cameras fall back to snapshots` and `return 0`. It must be callable under
  `set -e` without aborting (`if ! ...; then warn; fi`). Run time stays out of `update_status`.

- [ ] **Step 4: Clear the shellcheck baseline in this file.** `shellcheck -f gcc` reports warnings at line 1514
  (SC2115, use `"${IMAGE_BASE_DIR:?}/${old_dir}"`; `IMAGE_BASE_DIR` is never empty, default at line 7) and line 1668
  (SC2034, `DB_PATH` assigned and unused: delete the dead assignment). The notes (SC2329 at 229, 931, 962; SC2086 at
  1082) are below the CI threshold and are left alone.

- [ ] **Step 5: Run the whole update-worker suite and lint**

Run: `pnpm --filter @fastybird/smart-panel-backend exec jest src/modules/system/scripts && bash -n apps/backend/src/modules/system/scripts/update-worker.sh && shellcheck --severity=warning apps/backend/src/modules/system/scripts/update-worker.sh`
Expected: all suites pass, no shellcheck output. The helper-managed (root) branch has no existing test harness
(`HELPER_MANAGED` is never set in `update-worker.spec.ts`); it is covered by review and by the acceptance run on a
Pi (UP-20). Record that in the PR.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/system/scripts/update-worker.sh apps/backend/src/modules/system/scripts/update-worker.spec.ts
git commit -m "feat(backend): install go2rtc from the update worker without failing updates"
```

---

### Task 8: CI, path contract guard and docs

**Files:**
- Modify: `.github/workflows/ci-tests.yaml` (new job after `installer-portal-tests`, which ends at line 54)
- Modify: `build/tests/install-go2rtc.test.mjs` (contract guard)
- Modify: `build/docs/INSTALLATION.md` (after the `--with-tailscale` paragraph, ~line 69)

**Interfaces:**
- Consumes: scripts from Tasks 2-7 and the UP-3 constant `GO2RTC_DEFAULT_BINARY_PATH`.

- [ ] **Step 1: Contract guard test** `the default install directory matches the cameras module default binary path`:
  if `apps/backend/src/modules/cameras/cameras.constants.ts` contains `GO2RTC_DEFAULT_BINARY_PATH = '<path>'`
  (regex), assert `<path>` equals `/usr/local/lib/smart-panel/go2rtc/go2rtc` and equals the script's `DEFAULT_DIR`
  plus `/go2rtc`; otherwise `t.skip('UP-3 constant not merged yet')`. Run it, expect pass (skipped on a branch
  without UP-3). When UP-3 merges first, rebase and confirm it runs for real.

- [ ] **Step 2: CI job** `installer-script-checks` ("Installer script checks", `ubuntu-latest`, `timeout-minutes: 5`,
  `needs: check-skip` and the same `if` as its neighbours): checkout, `actions/setup-node@v7` node 24, then
  `shellcheck --severity=warning build/go2rtc/install-go2rtc.sh scripts/install-server.sh scripts/test-docker-runtime.sh
  build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh apps/backend/src/modules/system/scripts/update-worker.sh`
  and `node --test build/tests/install-go2rtc.test.mjs build/tests/install-server-go2rtc.test.mjs`.
  Note: no existing workflow runs the other `build/tests/*.test.mjs` files; wiring them is out of scope (see
  decision 5).

- [ ] **Step 3: Verify the job's commands locally**

Run: the two commands above from the repo root.
Expected: shellcheck silent; node test reports all pass.

- [ ] **Step 4: Docs.** `INSTALLATION.md`: new subsection "Camera relay (go2rtc)": installed to
  `/usr/local/lib/smart-panel/go2rtc/`, pinned and checksum-verified, fetched by the one-liner, the image, the
  Docker build and system updates; opt-out `--skip-go2rtc` (one-liner), `FB_SKIP_GO2RTC=1` (running
  `install-go2rtc.sh` by hand), `/etc/smart-panel/go2rtc.skip` (persistent, also stops update-time installs);
  a failure never fails the installation and cameras fall back to snapshots; unsupported: Pi Zero / 1 (ARMv6).
  Also note the tarball install (Option 3, line ~125) does not run the installer and how to run it by hand
  (`sudo sh <install dir>/dist/go2rtc/install-go2rtc.sh`).

- [ ] **Step 5: Final verification before the PR**

Run: `pnpm --filter @fastybird/smart-panel-backend exec jest src/modules/system/scripts && node --test build/tests/install-go2rtc.test.mjs build/tests/install-server-go2rtc.test.mjs && pnpm run lint:js`
Expected: all pass. Then `git diff main --stat` shows only the files in the File structure table.

- [ ] **Step 6: Commit, push, open PR**

```bash
git add build/tests/install-go2rtc.test.mjs
git commit -m "test(installer): guard the go2rtc install path against the cameras module default"
git add .github/workflows/ci-tests.yaml
git commit -m "ci(ci): lint and test the go2rtc installer scripts"
git add build/docs/INSTALLATION.md
git commit -m "docs(installer): document the go2rtc relay and its opt-out"
git push -u origin feat/cameras-go2rtc-installer
gh pr create --title "feat(installer): ship go2rtc with server installations" --body-file <body>
```

PR body: summary per call site, the pin table, the local Docker evidence from Task 6, the note that the helper-managed
update branch is untested in CI, `Closes #1180`.

---

## Decisions to confirm (assumed as stated; each is a one-line change)

1. Installer and pin reach release trees by a build-time copy into `dist/go2rtc/` (Task 3), canonical files stay in
   `build/go2rtc/`.
2. The Pi image call site is `01-install-app/01-run-chroot.sh`, not `00-install-deps` (Task 5).
3. `--strict` (build fails if go2rtc cannot be fetched) for the Docker build and the Pi image build; every
   user-facing path stays non-fatal.
4. `smart-panel-service update` (`build/bin/smart-panel-service.js:563`) is a second update path that does not
   fetch go2rtc; left to a follow-up (its tests extract code from the source by regex).
5. The existing `build/tests/*.test.mjs` files are not run by any workflow; fixing that is out of scope.
6. ARMv6 (Pi Zero / 1) stays unsupported.

## Acceptance mapping (issue #1180)

| Criterion | Where |
|---|---|
| Pinned release with SHA-256 per arch, verified at download; download failure does not fail installation | Tasks 1, 2 |
| Pi image, `install-server.sh` and Docker install to the module default path | Tasks 4, 5, 6 (+ contract guard, Task 8) |
| Existing installations receive the binary through the normal update path | Tasks 3, 7 |
| MIT notice in third-party notices | Task 1 |
| Opt-out documented; shellcheck clean on touched scripts | Tasks 2, 4, 7, 8 |

## Self-review notes

- Spec coverage: D5 (pinned binary, distribution on all targets, degrade without it), §17 risk row, issue criteria
  all map to tasks above. External-URL mode needs no installer work.
- Type/name consistency: pin keys, `FB_SKIP_GO2RTC`, `FB_GO2RTC_PIN_FILE`, `FB_GO2RTC_SKIP_FILE`, marker path,
  `dist/go2rtc/install-go2rtc.sh`, function names `find_go2rtc_installer`, `install_go2rtc`,
  `install_go2rtc_nonfatal` are used identically in every task.
- Review Focus lines 1-5 each have a named test (Task 2: armv6, 32-bit userland, truncated/tampered; Task 4: older
  package; Task 7: hang/air-gapped).
- Proportion: the plan fixes names, flags, values and test assertions; script bodies are not reproduced.
