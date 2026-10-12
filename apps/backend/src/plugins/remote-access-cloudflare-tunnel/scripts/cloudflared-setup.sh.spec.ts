import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

/**
 * `bats` is not available in this repo, so the script's own dry-run mode
 * (documented in the file header) is exercised directly with the real
 * `bash` binary — no mocking, this genuinely runs `cloudflared-setup.sh`.
 * `--dry-run` never touches apt for real and always finishes at "complete"
 * with exit 0, regardless of the host OS, so this is safe and deterministic
 * on any developer machine or CI runner. Mirrors `tailscale-setup.sh.spec.ts`.
 */
describe('cloudflared-setup.sh --dry-run', () => {
	const scriptPath = join(__dirname, 'cloudflared-setup.sh');
	let statusDir: string;
	let statusFile: string;

	beforeEach(() => {
		statusDir = mkdtempSync(join(tmpdir(), 'ra13-script-'));
		statusFile = join(statusDir, 'status.json');
	});

	afterEach(() => {
		rmSync(statusDir, { recursive: true, force: true });
	});

	function runDryRun(env: Record<string, string> = {}): { stdout: string; status: unknown } {
		const stdout = execFileSync('bash', [scriptPath, '--dry-run'], {
			env: { ...process.env, STATUS_FILE: statusFile, ...env },
			encoding: 'utf8',
		});

		const status = JSON.parse(readFileSync(statusFile, 'utf8')) as unknown;

		return { stdout, status };
	}

	it('exits 0 and writes a complete status, whether or not cloudflared happens to already be installed here', () => {
		const { status } = runDryRun();

		expect(status).toMatchObject({ state: 'complete', step: 'complete' });
	});

	it('retains the validated job identity in status and rejects invalid input before writing', () => {
		const jobId = 'ad98dd86-83e4-4b3e-ae8e-c30d07c4b8b0';
		expect(runDryRun({ PRIVILEGED_WORKER_JOB_ID: jobId }).status).toMatchObject({ jobId, state: 'complete' });
		rmSync(statusFile);
		expect(() => runDryRun({ PRIVILEGED_WORKER_JOB_ID: 'bad"id' })).toThrow();
		expect(existsSync(statusFile)).toBe(false);
	});

	it('previews the apt install path for a Debian-family OS, without ever piping a downloaded script into a shell', () => {
		const emptyBinDir = mkdtempSync(join(tmpdir(), 'ra13-script-emptybin-'));

		try {
			const { stdout, status } = runDryRun({ PATH: `${emptyBinDir}:/usr/bin:/bin` });

			expect(status).toMatchObject({ state: 'complete', step: 'complete' });
			expect(stdout).not.toMatch(/curl[^\n]*\|\s*(sh|bash)\b/);
		} finally {
			rmSync(emptyBinDir, { recursive: true, force: true });
		}
	});

	it('writes the status file with the canonical PrivilegedWorkerService shape', () => {
		const { status } = runDryRun();
		const record = status as Record<string, unknown>;

		expect(typeof record.state).toBe('string');
		expect(typeof record.step).toBe('string');
		expect(typeof record.message).toBe('string');
	});

	it('makes apt repository files readable before apt runs under the protected helper umask', () => {
		const workDir = join(statusDir, 'repository-fixture');
		const fakeBin = join(workDir, 'bin');
		mkdirSync(fakeBin, { recursive: true });
		const osRelease = join(workDir, 'os-release');
		const keyring = join(workDir, 'keyring.gpg');
		const list = join(workDir, 'provider.list');
		const aptCalls = join(workDir, 'apt-calls');
		writeFileSync(osRelease, 'ID=debian\nVERSION_CODENAME=bookworm\n');
		const source = readFileSync(scriptPath, 'utf8')
			.replaceAll('/etc/os-release', osRelease)
			.replaceAll('/usr/share/keyrings/cloudflare-main.gpg', keyring)
			.replaceAll('/etc/apt/sources.list.d/cloudflared.list', list)
			.replace('if command -v cloudflared >/dev/null 2>&1; then', 'if false; then');
		const scriptCopy = join(workDir, 'setup.sh');
		writeFileSync(scriptCopy, source);
		for (const name of ['curl', 'systemctl', 'tailscale']) {
			writeFileSync(join(fakeBin, name), '#!/bin/bash\nprintf public\n', { mode: 0o755 });
		}
		// Verify permissions at each apt invocation, not just after the setup finishes.
		writeFileSync(
			join(fakeBin, 'apt-get'),
			`#!/usr/bin/env node
const fs = require('node:fs');
for (const path of ${JSON.stringify([keyring, list])}) {
  if ((fs.statSync(path).mode & 0o777) !== 0o644) process.exit(1);
}
fs.appendFileSync(${JSON.stringify(aptCalls)}, process.argv.slice(2).join(' ') + String.fromCharCode(10));
`,
			{ mode: 0o755 },
		);
		const env = {
			...process.env,
			STATUS_FILE: statusFile,
			SMART_PANEL_USER: 'smart-panel',
			PATH: `${fakeBin}:${dirname(process.execPath)}:/usr/bin:/bin`,
		};
		const preview = execFileSync('bash', [scriptCopy, '--dry-run'], { env, encoding: 'utf8' });
		expect(preview).toContain(`chmod 0644 ${keyring} ${list}`);
		expect(existsSync(keyring)).toBe(false);
		// All privileged destinations and host commands are confined to this fixture.
		execFileSync('bash', ['-c', 'umask 0027; exec bash "$1"', 'setup-fixture', scriptCopy], { env, stdio: 'pipe' });
		expect(statSync(keyring).mode & 0o777).toBe(0o644);
		expect(statSync(list).mode & 0o777).toBe(0o644);
		expect(readFileSync(aptCalls, 'utf8').split('\n').filter(Boolean)).toEqual([
			'update -qq',
			'install -y -qq --no-install-recommends cloudflared',
		]);
		expect(JSON.parse(readFileSync(statusFile, 'utf8')) as unknown).toMatchObject({ state: 'complete' });
	});

	it('sets pipefail, so a curl failure inside `curl | tee` is not masked by tee', () => {
		const source = readFileSync(scriptPath, 'utf8');

		expect(source).toMatch(/^set -o pipefail$/m);
	});

	it('reports the keyring download failure (not a later, misleading one) when curl fails — proves pipefail actually works', () => {
		// Runs the real (non-dry-run) install branch without needing an actual
		// Debian host or network access: a scratch copy of the script has
		// `/etc/os-release` swapped for a fake one reporting `ID=debian`, and a
		// fake `curl` that always fails sits ahead of the real one on PATH.
		const workDir = mkdtempSync(join(tmpdir(), 'ra13-script-pipefail-'));

		try {
			const fakeOsRelease = join(workDir, 'os-release');

			writeFileSync(fakeOsRelease, 'ID=debian\nVERSION_CODENAME=bookworm\n');

			const fakeKeyring = join(workDir, 'cloudflare-main.gpg');
			const fakeList = join(workDir, 'cloudflared.list');

			const realSource = readFileSync(scriptPath, 'utf8');
			const patchedSource = realSource
				.replaceAll('/etc/os-release', fakeOsRelease)
				.replaceAll('/usr/share/keyrings/cloudflare-main.gpg', fakeKeyring)
				.replaceAll('/etc/apt/sources.list.d/cloudflared.list', fakeList)
				// Force the install branch regardless of whether the host actually has
				// cloudflared on /usr/bin or /bin already (a real machine testing the
				// WireGuard/other milestones of this same epic plausibly does) — the PATH
				// override below cannot guarantee that on its own.
				.replace('if command -v cloudflared >/dev/null 2>&1; then', 'if false; then');

			expect(patchedSource).not.toBe(realSource); // sanity: the replace actually matched

			const scriptCopy = join(workDir, 'cloudflared-setup.sh');

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
						PATH: `${fakeBinDir}:/usr/bin:/bin`,
					},
					stdio: 'pipe',
				}),
			).toThrow();

			const status = JSON.parse(readFileSync(statusFile, 'utf8')) as Record<string, unknown>;

			expect(status).toMatchObject({
				state: 'failed',
				step: 'install',
				message: 'Failed to download the Cloudflare apt keyring',
			});
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	});
});

/**
 * `--print-plan` (D12's remedy builder — `CloudflareTunnelManagedService.buildInstallRemedy()`)
 * is a separate, read-only mode: no status file, no root/apt required, executes nothing. Run
 * directly with the real `bash` binary, same as the `--dry-run` suite above.
 */
describe('cloudflared-setup.sh --print-plan', () => {
	const scriptPath = join(__dirname, 'cloudflared-setup.sh');

	function runPrintPlan(env: Record<string, string> = {}): string {
		return execFileSync('bash', [scriptPath, '--print-plan'], {
			env: { ...process.env, ...env },
			encoding: 'utf8',
		});
	}

	/**
	 * Runs `--print-plan` against a scratch copy of the script whose own
	 * `/etc/os-release` reference is swapped for a fake file reporting the
	 * given `ID` — same technique the `--dry-run` pipefail spec above uses.
	 */
	function runPrintPlanForDistro(osRelease: string): string {
		const workDir = mkdtempSync(join(tmpdir(), 'ra13-print-plan-'));

		try {
			const fakeOsRelease = join(workDir, 'os-release');

			writeFileSync(fakeOsRelease, osRelease);

			const patchedSource = readFileSync(scriptPath, 'utf8').replaceAll('/etc/os-release', fakeOsRelease);
			const scriptCopy = join(workDir, 'cloudflared-setup.sh');

			writeFileSync(scriptCopy, patchedSource);
			chmodSync(scriptCopy, 0o755);

			return execFileSync('bash', [scriptCopy, '--print-plan'], { encoding: 'utf8' });
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	}

	it('prints the exact keyring/list/update/install lines for a Debian-family host - pipelines carry their own `sudo` (the caller adds sudo to plain lines)', () => {
		const stdout = runPrintPlanForDistro('ID=debian\nVERSION_CODENAME=bookworm\n');
		const lines = stdout.split('\n').filter((line) => line.length > 0);

		expect(lines).toEqual([
			'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null',
			"echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null",
			'chmod 0644 /usr/share/keyrings/cloudflare-main.gpg /etc/apt/sources.list.d/cloudflared.list',
			'apt-get update -qq',
			'apt-get install -y -qq --no-install-recommends cloudflared',
		]);
		expect(stdout).not.toMatch(/curl[^\n]*\|\s*(sh|bash)\b/);
	});

	it("prints nothing on stdout on an unsupported (non-Debian-family) distribution — the caller's signal to fall back to a vendor link", () => {
		const stdout = runPrintPlanForDistro('ID=fedora\nVERSION_CODENAME=\n');

		expect(stdout.trim()).toBe('');
	});

	it('executes nothing and writes no status file, even when STATUS_FILE is set', () => {
		const workDir = mkdtempSync(join(tmpdir(), 'ra13-print-plan-nostatus-'));
		const statusFile = join(workDir, 'status.json');

		try {
			runPrintPlan({ STATUS_FILE: statusFile, PRIVILEGED_WORKER_JOB_ID: 'invalid-id' });

			expect(existsSync(statusFile)).toBe(false);
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	});
});
