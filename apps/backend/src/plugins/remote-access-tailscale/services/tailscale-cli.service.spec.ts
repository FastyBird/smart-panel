/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { execFile } from 'node:child_process';

import { Test, TestingModule } from '@nestjs/testing';

import { TailscaleCliError, TailscaleCliService, redactTailscaleArgs } from './tailscale-cli.service';

// Only execFile is replaced — other exports stay real, matching
// PlatformService's own test setup for the same kind of probe.
jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

type ExecFileCallback = (
	error: (Error & { code?: string | number; killed?: boolean }) | null,
	stdout?: string,
	stderr?: string,
) => void;

function mockExecFileOnce(
	handler: (
		file: string,
		args: string[],
	) => { stdout?: string; stderr?: string; exitCode?: number; enoent?: boolean; killed?: boolean },
): void {
	(execFile as unknown as jest.Mock).mockImplementationOnce(
		(file: string, args: string[], _options: unknown, ...rest: unknown[]) => {
			const callback = rest[rest.length - 1] as ExecFileCallback;
			const result = handler(file, args);

			if (result.enoent) {
				const error: Error & { code?: string } = new Error('spawn tailscale ENOENT');
				error.code = 'ENOENT';
				callback(error, '', '');
				return {};
			}

			if (result.killed) {
				const error: Error & { killed?: boolean } = new Error('command timed out');
				error.killed = true;
				callback(error, result.stdout ?? '', result.stderr ?? '');
				return {};
			}

			const exitCode = result.exitCode ?? 0;

			if (exitCode !== 0) {
				const error: Error & { code?: number } = new Error(`Command failed with exit code ${exitCode}`);
				error.code = exitCode;
				callback(error, result.stdout ?? '', result.stderr ?? '');
				return {};
			}

			callback(null, result.stdout ?? '', result.stderr ?? '');
			return {};
		},
	);
}

describe('TailscaleCliService', () => {
	let service: TailscaleCliService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TailscaleCliService],
		}).compile();

		service = module.get<TailscaleCliService>(TailscaleCliService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getVersion', () => {
		it('parses a successful `tailscale version --json` response', async () => {
			mockExecFileOnce(() => ({ stdout: JSON.stringify({ majorMinorPatch: '1.78.1', short: '1.78.1' }) }));

			const result = await service.getVersion();

			expect(result.version).toBe('1.78.1');
			expect(execFile).toHaveBeenCalledWith(
				'tailscale',
				['version', '--json'],
				expect.any(Object),
				expect.any(Function),
			);
		});

		it('classifies a missing binary as not-installed', async () => {
			mockExecFileOnce(() => ({ enoent: true }));

			await expect(service.getVersion()).rejects.toMatchObject({ kind: 'not-installed' });
		});

		it('raises unknown when the output is not valid JSON', async () => {
			mockExecFileOnce(() => ({ stdout: 'not json' }));

			await expect(service.getVersion()).rejects.toMatchObject({ kind: 'unknown' });
		});
	});

	describe('getStatus', () => {
		it('parses a successful status document', async () => {
			mockExecFileOnce(() => ({ stdout: JSON.stringify({ BackendState: 'Running', Self: { Online: true } }) }));

			const status = await service.getStatus();

			expect(status.BackendState).toBe('Running');
		});

		it('tolerates a non-zero exit code when stdout still carries a valid status document', async () => {
			// Real `tailscale status` exits 1 whenever the backend is not Running,
			// while still printing a fully valid JSON document to stdout.
			mockExecFileOnce(() => ({
				stdout: JSON.stringify({ BackendState: 'NeedsLogin' }),
				stderr: '',
				exitCode: 1,
			}));

			const status = await service.getStatus();

			expect(status.BackendState).toBe('NeedsLogin');
		});

		it('classifies permission-denied from stderr when stdout has no status document', async () => {
			mockExecFileOnce(() => ({
				stdout: '',
				stderr: 'Access denied: application not authorized to modify Tailscale settings (must be root, or operator)',
				exitCode: 1,
			}));

			await expect(service.getStatus()).rejects.toMatchObject({ kind: 'permission-denied' });
		});

		it('classifies daemon-down from stderr when stdout has no status document', async () => {
			mockExecFileOnce(() => ({
				stdout: '',
				stderr:
					"failed to connect to local tailscaled; it doesn't appear to be running: dial unix /var/run/tailscale/tailscaled.sock: connect: connection refused",
				exitCode: 1,
			}));

			await expect(service.getStatus()).rejects.toMatchObject({ kind: 'daemon-down' });
		});

		it('classifies unknown when stdout is unparseable and stderr matches nothing specific', async () => {
			mockExecFileOnce(() => ({ stdout: '', stderr: 'boom', exitCode: 1 }));

			await expect(service.getStatus()).rejects.toMatchObject({ kind: 'unknown' });
		});

		it('classifies timeout when the process is killed', async () => {
			mockExecFileOnce(() => ({ killed: true }));

			await expect(service.getStatus()).rejects.toMatchObject({ kind: 'timeout' });
		});
	});

	describe('up/set/down/logout/serveReset', () => {
		it('sends `up` with the given flags and resolves on success', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await expect(service.up(['--hostname=panel', '--accept-dns=true'])).resolves.toBeUndefined();
			expect(execFile).toHaveBeenCalledWith(
				'tailscale',
				['up', '--hostname=panel', '--accept-dns=true'],
				expect.any(Object),
				expect.any(Function),
			);
		});

		it('classifies settings-conflict from the reset-or-specify-all-settings error', async () => {
			mockExecFileOnce(() => ({
				stderr: 'invocation requires --reset to override settings, or you must specify all settings',
				exitCode: 1,
			}));

			await expect(service.up(['--hostname=panel'])).rejects.toMatchObject({ kind: 'settings-conflict' });
		});

		it('classifies needs-login from stderr on a `set` failure', async () => {
			mockExecFileOnce(() => ({ stderr: 'not logged in', exitCode: 1 }));

			await expect(service.set(['--hostname=panel'])).rejects.toMatchObject({ kind: 'needs-login' });
		});

		it('sends bare `down`', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.down();

			expect(execFile).toHaveBeenCalledWith('tailscale', ['down'], expect.any(Object), expect.any(Function));
		});

		it('sends bare `logout`', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.logout();

			expect(execFile).toHaveBeenCalledWith('tailscale', ['logout'], expect.any(Object), expect.any(Function));
		});

		it('sends `serve reset`', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.serveReset();

			expect(execFile).toHaveBeenCalledWith('tailscale', ['serve', 'reset'], expect.any(Object), expect.any(Function));
		});
	});

	describe('timeout option', () => {
		it('passes a default 15s timeout', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.down();

			expect(execFile).toHaveBeenCalledWith('tailscale', ['down'], { timeout: 15000 }, expect.any(Function));
		});
	});

	describe('TailscaleCliError', () => {
		it('is an instance of Error and carries its kind', () => {
			const error = new TailscaleCliError('daemon-down', 'boom');

			expect(error).toBeInstanceOf(Error);
			expect(error.kind).toBe('daemon-down');
			expect(error.message).toBe('boom');
		});
	});

	describe('redactTailscaleArgs', () => {
		it('redacts an --auth-key=value form but leaves other arguments untouched', () => {
			const redacted = redactTailscaleArgs(['up', '--hostname=panel', '--auth-key=tskey-abc123', '--ssh=true']);

			expect(redacted).toEqual(['up', '--hostname=panel', '--auth-key=***redacted***', '--ssh=true']);
		});

		it('redacts an --authkey=value form the same way', () => {
			const redacted = redactTailscaleArgs(['up', '--authkey=tskey-abc123']);

			expect(redacted).toEqual(['up', '--authkey=***redacted***']);
		});

		it('redacts the value in the separate `--auth-key value` flag form', () => {
			const redacted = redactTailscaleArgs(['up', '--auth-key', 'tskey-abc123', '--ssh=true']);

			expect(redacted).toEqual(['up', '--auth-key', '***redacted***', '--ssh=true']);
		});

		it('redacts the value in the separate `--authkey value` flag form', () => {
			const redacted = redactTailscaleArgs(['up', '--authkey', 'tskey-abc123']);

			expect(redacted).toEqual(['up', '--authkey', '***redacted***']);
		});

		it('leaves an --auth-key=file:... path visible — it is a path, not the key itself', () => {
			const redacted = redactTailscaleArgs(['up', '--auth-key=file:/tmp/secret-key']);

			expect(redacted).toEqual(['up', '--auth-key=file:/tmp/secret-key']);
		});

		it('does not crash when --auth-key is the last argument with no following value', () => {
			const redacted = redactTailscaleArgs(['up', '--auth-key']);

			expect(redacted).toEqual(['up', '--auth-key']);
		});

		it('does not mutate the original array', () => {
			const original = ['--auth-key=tskey-abc123'];

			redactTailscaleArgs(original);

			expect(original).toEqual(['--auth-key=tskey-abc123']);
		});
	});

	describe('real arguments sent to execFile are never redacted — only the logged copy', () => {
		it('the equals form', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.up(['--auth-key=tskey-abc123']);

			expect(execFile).toHaveBeenCalledWith(
				'tailscale',
				['up', '--auth-key=tskey-abc123'],
				expect.any(Object),
				expect.any(Function),
			);
		});

		it('the separate flag + value form', async () => {
			mockExecFileOnce(() => ({ exitCode: 0 }));

			await service.up(['--auth-key', 'tskey-abc123']);

			expect(execFile).toHaveBeenCalledWith(
				'tailscale',
				['up', '--auth-key', 'tskey-abc123'],
				expect.any(Object),
				expect.any(Function),
			);
		});
	});
});
