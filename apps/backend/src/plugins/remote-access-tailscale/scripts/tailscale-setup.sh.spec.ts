import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * `bats` is not available in this repo, so the script's own dry-run mode
 * (documented in the file header) is exercised directly with the real
 * `bash` binary — no mocking, this genuinely runs `tailscale-setup.sh`.
 * `--dry-run` never touches apt/systemd/tailscale for real and always
 * finishes at "complete" with exit 0, regardless of the host OS, so this is
 * safe and deterministic on any developer machine or CI runner.
 */
describe('tailscale-setup.sh --dry-run', () => {
	const scriptPath = join(__dirname, 'tailscale-setup.sh');
	let statusDir: string;
	let statusFile: string;

	beforeEach(() => {
		statusDir = mkdtempSync(join(tmpdir(), 'ra5-script-'));
		statusFile = join(statusDir, 'status.json');
	});

	afterEach(() => {
		rmSync(statusDir, { recursive: true, force: true });
	});

	function runDryRun(env: Record<string, string> = {}): { stdout: string; status: unknown } {
		const stdout = execFileSync('bash', [scriptPath, '--dry-run'], {
			env: { ...process.env, STATUS_FILE: statusFile, SMART_PANEL_USER: 'smart-panel', ...env },
			encoding: 'utf8',
		});

		const status = JSON.parse(readFileSync(statusFile, 'utf8')) as unknown;

		return { stdout, status };
	}

	it('exits 0 and writes a complete status, whether or not tailscale happens to already be installed here', () => {
		const { status } = runDryRun();

		expect(status).toMatchObject({ state: 'complete', step: 'complete' });
	});

	it('prints the planned systemctl and operator commands', () => {
		const { stdout } = runDryRun();

		expect(stdout).toContain('systemctl enable --now tailscaled');
		expect(stdout).toContain('tailscale set --operator=smart-panel');
	});

	it('previews the apt install path for a Debian-family OS, without ever piping a downloaded script into a shell', () => {
		// PATH stripped of any real `tailscale` so the install branch is taken,
		// and /etc/os-release is faked via a directory shadowing the real path
		// is not attempted (out of scope for a portable unit test) — instead
		// this asserts the negative: no command line here ever contains a
		// pipe into `sh`/`bash`, on this host's real (whatever it is) os-release.
		const emptyBinDir = mkdtempSync(join(tmpdir(), 'ra5-script-emptybin-'));

		try {
			const { stdout, status } = runDryRun({ PATH: `${emptyBinDir}:/usr/bin:/bin` });

			expect(status).toMatchObject({ state: 'complete', step: 'complete' });
			expect(stdout).not.toMatch(/curl[^\n]*\|\s*(sh|bash)\b/);
		} finally {
			rmSync(emptyBinDir, { recursive: true, force: true });
		}
	});

	it('writes the status file with the canonical PrivilegedWorkerService shape', () => {
		// expect.any(String) inside a plain object literal trips
		// @typescript-eslint/no-unsafe-assignment (see the same note in
		// tailscale-node-managed.service.spec.ts) — checked field-by-field
		// instead.
		const { status } = runDryRun();
		const record = status as Record<string, unknown>;

		expect(typeof record.state).toBe('string');
		expect(typeof record.step).toBe('string');
		expect(typeof record.message).toBe('string');
	});

	it('sets pipefail, so a curl failure inside `curl | tee` is not masked by tee', () => {
		const source = readFileSync(scriptPath, 'utf8');

		expect(source).toMatch(/^set -o pipefail$/m);
	});

	it('reports the keyring download failure (not a later, misleading one) when curl fails — proves pipefail actually works', () => {
		// Real bug this guards against: without `set -o pipefail`, `curl (fails)
		// | tee (still exits 0)` reports success, so the `|| { write_status
		// failed install ...; exit 1; }` guard never fires and the script keeps
		// going — it would eventually fail somewhere else (e.g. "command not
		// found" for apt-get, which isn't on PATH here either) with a
		// different, misleading message. Asserting the *specific* keyring
		// message is what makes this test able to catch a pipefail regression.
		//
		// Runs the real (non-dry-run) install branch without needing an actual
		// Debian host or network access: a scratch copy of the script has
		// `/etc/os-release` swapped for a fake one reporting `ID=debian`, and a
		// fake `curl` that always fails sits ahead of the real one on PATH.
		const workDir = mkdtempSync(join(tmpdir(), 'ra5-script-pipefail-'));

		try {
			const fakeOsRelease = join(workDir, 'os-release');

			writeFileSync(fakeOsRelease, 'ID=debian\nVERSION_CODENAME=bookworm\n');

			// Also redirect the keyring/list destinations tee writes to: the real
			// paths are root-owned system locations, and without this a plain
			// permission error there (independent of pipefail) would make this
			// test pass for the wrong reason regardless of the fix.
			const fakeKeyring = join(workDir, 'tailscale-archive-keyring.gpg');
			const fakeList = join(workDir, 'tailscale.list');

			const realSource = readFileSync(scriptPath, 'utf8');
			const patchedSource = realSource
				.replaceAll('/etc/os-release', fakeOsRelease)
				.replaceAll('/usr/share/keyrings/tailscale-archive-keyring.gpg', fakeKeyring)
				.replaceAll('/etc/apt/sources.list.d/tailscale.list', fakeList);

			expect(patchedSource).not.toBe(realSource); // sanity: the replace actually matched

			const scriptCopy = join(workDir, 'tailscale-setup.sh');

			writeFileSync(scriptCopy, patchedSource);
			chmodSync(scriptCopy, 0o755);

			const fakeBinDir = join(workDir, 'bin');

			mkdirSync(fakeBinDir);
			writeFileSync(join(fakeBinDir, 'curl'), '#!/bin/bash\nexit 1\n');
			chmodSync(join(fakeBinDir, 'curl'), 0o755);

			expect(() =>
				execFileSync('bash', [scriptCopy], {
					env: {
						...process.env,
						STATUS_FILE: statusFile,
						SMART_PANEL_USER: 'smart-panel',
						PATH: `${fakeBinDir}:/usr/bin:/bin`,
					},
					stdio: 'pipe',
				}),
			).toThrow();

			const status = JSON.parse(readFileSync(statusFile, 'utf8')) as Record<string, unknown>;

			expect(status).toMatchObject({
				state: 'failed',
				step: 'install',
				message: 'Failed to download the Tailscale apt keyring',
			});
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	});
});

/**
 * `--print-plan` (D12's remedy builder — `TailscaleNodeManagedService.buildInstallRemedy()`
 * and its `daemon`/`operator` siblings) is a separate, read-only mode: no
 * status file, no root/apt/systemd required, executes nothing. Run directly
 * with the real `bash` binary, same as the `--dry-run` suite above.
 */
describe('tailscale-setup.sh --print-plan', () => {
	const scriptPath = join(__dirname, 'tailscale-setup.sh');

	function runPrintPlan(args: string[], env: Record<string, string> = {}): string {
		return execFileSync('bash', [scriptPath, '--print-plan', ...args], {
			env: { ...process.env, SMART_PANEL_USER: 'smart-panel', ...env },
			encoding: 'utf8',
		});
	}

	/**
	 * Runs `--print-plan --step=install` against a scratch copy of the script
	 * whose own `/etc/os-release` reference is swapped for a fake file
	 * reporting the given `ID`/`VERSION_CODENAME` — same technique the
	 * `--dry-run` pipefail spec above uses, so distro detection is exercised
	 * deterministically regardless of the real host/CI runner's own OS.
	 */
	function runPrintPlanInstallForDistro(osRelease: string): string {
		const workDir = mkdtempSync(join(tmpdir(), 'ra17-print-plan-'));

		try {
			const fakeOsRelease = join(workDir, 'os-release');

			writeFileSync(fakeOsRelease, osRelease);

			const patchedSource = readFileSync(scriptPath, 'utf8').replaceAll('/etc/os-release', fakeOsRelease);
			const scriptCopy = join(workDir, 'tailscale-setup.sh');

			writeFileSync(scriptCopy, patchedSource);
			chmodSync(scriptCopy, 0o755);

			return execFileSync('bash', [scriptCopy, '--print-plan', '--step=install'], {
				env: { ...process.env, SMART_PANEL_USER: 'smart-panel' },
				encoding: 'utf8',
			});
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	}

	it('prints the exact apt keyring/list/update/install lines for a Debian-family host - pipelines carry their own `sudo` on the `tee` side, plain commands are unprefixed (the caller adds sudo)', () => {
		const stdout = runPrintPlanInstallForDistro('ID=debian\nVERSION_CODENAME=bookworm\n');
		const lines = stdout.split('\n').filter((line) => line.length > 0);

		expect(lines).toEqual([
			'curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null',
			'curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list >/dev/null',
			'apt-get update -qq',
			'apt-get install -y -qq --no-install-recommends tailscale',
		]);
		expect(stdout).not.toMatch(/curl[^\n]*\|\s*(sh|bash)\b/);
	});

	it("prints nothing on stdout for --step=install on an unsupported (non-Debian-family) distribution — the caller's signal to fall back to a vendor link", () => {
		const stdout = runPrintPlanInstallForDistro('ID=fedora\nVERSION_CODENAME=\n');

		expect(stdout.trim()).toBe('');
	});

	it('prints the fixed systemctl one-liner for --step=daemon, independent of the detected distribution', () => {
		const stdout = runPrintPlan(['--step=daemon']);

		expect(stdout.trim()).toBe('systemctl enable --now tailscaled');
	});

	it('prints the fixed tailscale one-liner naming SMART_PANEL_USER for --step=operator', () => {
		const stdout = runPrintPlan(['--step=operator'], { SMART_PANEL_USER: 'smart-panel' });

		expect(stdout.trim()).toBe('tailscale set --operator=smart-panel');
	});

	it('executes nothing and writes no status file, even when STATUS_FILE is set', () => {
		const workDir = mkdtempSync(join(tmpdir(), 'ra17-print-plan-nostatus-'));
		const statusFile = join(workDir, 'status.json');

		try {
			runPrintPlan(['--step=daemon'], { STATUS_FILE: statusFile });

			expect(existsSync(statusFile)).toBe(false);
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	});

	it('exits 0 even for an unrecognised --step value, printing nothing', () => {
		const stdout = runPrintPlan(['--step=bogus']);

		expect(stdout.trim()).toBe('');
	});
});
