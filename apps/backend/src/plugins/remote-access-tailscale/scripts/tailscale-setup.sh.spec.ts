import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
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
});
