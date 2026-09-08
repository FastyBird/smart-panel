import { execFile } from 'node:child_process';

import { CloudflaredCliError, CloudflaredCliService } from './cloudflared-cli.service';

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

type ExecFileCallback = (error: (Error & { code?: string | number }) | null, stdout?: string, stderr?: string) => void;

function mockExecFileOnce(
	handler: () => { stdout?: string; stderr?: string; exitCode?: number; enoent?: boolean },
): void {
	(execFile as unknown as jest.Mock).mockImplementationOnce(
		(_file: string, _args: string[], _options: unknown, ...rest: unknown[]) => {
			const callback = rest[rest.length - 1] as ExecFileCallback;
			const result = handler();

			if (result.enoent) {
				const error: Error & { code?: string } = new Error('spawn cloudflared ENOENT');
				error.code = 'ENOENT';
				callback(error, '', '');
				return {};
			}

			if ((result.exitCode ?? 0) !== 0) {
				const error: Error & { code?: number } = new Error(`Command failed with exit code ${result.exitCode}`);
				error.code = result.exitCode;
				callback(error, result.stdout ?? '', result.stderr ?? '');
				return {};
			}

			callback(null, result.stdout ?? '', result.stderr ?? '');
			return {};
		},
	);
}

describe('CloudflaredCliService', () => {
	let service: CloudflaredCliService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new CloudflaredCliService();
	});

	describe('getVersion', () => {
		it('parses the version number from the standard cloudflared --version output', async () => {
			mockExecFileOnce(() => ({ stdout: 'cloudflared version 2024.6.1 (built 2024-06-18-1341 UTC)\n' }));

			const result = await service.getVersion();

			expect(result.version).toBe('2024.6.1');
			expect(result.raw).toContain('cloudflared version 2024.6.1');
		});

		it('parses a version with only two dotted segments padded by cloudflared itself (defensive)', async () => {
			mockExecFileOnce(() => ({ stdout: 'cloudflared version 2025.1.0\n' }));

			const result = await service.getVersion();

			expect(result.version).toBe('2025.1.0');
		});

		it('throws not-installed when the binary is missing (ENOENT)', async () => {
			mockExecFileOnce(() => ({ enoent: true }));

			await expect(service.getVersion()).rejects.toMatchObject({ kind: 'not-installed' });
		});

		it('throws unknown when the exit code is non-zero', async () => {
			mockExecFileOnce(() => ({ exitCode: 1, stderr: 'permission denied' }));

			const promise = service.getVersion();

			await expect(promise).rejects.toBeInstanceOf(CloudflaredCliError);
			await expect(promise).rejects.toMatchObject({ kind: 'unknown' });
		});

		it('throws unknown when the output has no recognizable version number', async () => {
			mockExecFileOnce(() => ({ stdout: 'not a version string' }));

			await expect(service.getVersion()).rejects.toMatchObject({ kind: 'unknown' });
		});
	});
});
