/*
eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-call
*/
/*
Reason: reaching a private method and asserting on jest mocks requires dynamic access that
these rules flag unnecessarily.
*/
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { UpdateService } from '../services/update.service';

import { UpdateServerCommand } from './update-server.command';

jest.mock('child_process', () => ({
	...jest.requireActual<typeof import('child_process')>('child_process'),
	execFileSync: jest.fn(),
}));

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
}));

describe('UpdateServerCommand', () => {
	const BASE_DIR = '/opt/smart-panel';
	const NEW_VERSION_DIR = '/opt/smart-panel/v1.1.0-alpha.0';
	const SCRIPT = `${BASE_DIR}/rebuild-native.sh`;

	const nodePrefix = dirname(dirname(process.execPath));
	const nodeHeader = join(nodePrefix, 'include', 'node', 'node.h');

	let command: UpdateServerCommand;

	/** Drives the helper's retry backoff without waiting out the real delays. */
	const runRebuild = async (): Promise<void> => {
		const pending = (command as any).runNativeRebuild(BASE_DIR, NEW_VERSION_DIR) as Promise<void>;
		// Settle both backoffs (10s then 20s) plus slack; a resolved promise ignores the extra.
		const settled = pending.catch((error: unknown) => error);

		await jest.advanceTimersByTimeAsync(60_000);

		const result = await settled;

		if (result instanceof Error) {
			throw result;
		}
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [UpdateServerCommand, { provide: UpdateService, useValue: {} }],
		}).compile();

		command = module.get<UpdateServerCommand>(UpdateServerCommand);

		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.spyOn(console, 'log').mockImplementation(() => {});

		delete process.env.npm_config_nodedir;
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();

		delete process.env.npm_config_nodedir;
	});

	describe('runNativeRebuild', () => {
		it('should point node-gyp at the running Node’s own headers when they are on disk', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path === nodeHeader);
			(execFileSync as jest.Mock).mockReturnValue(Buffer.from(''));

			await runRebuild();

			expect(execFileSync).toHaveBeenCalledTimes(1);

			const [, , options] = (execFileSync as jest.Mock).mock.calls[0];

			// Skipping the nodejs.org header download is the whole point: that fetch is not
			// retried by node-gyp and has rolled back an otherwise complete update.
			expect(options.env.npm_config_nodedir).toBe(nodePrefix);
		});

		it('should leave node-gyp to download headers when none are installed locally', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			(execFileSync as jest.Mock).mockReturnValue(Buffer.from(''));

			await runRebuild();

			const [, , options] = (execFileSync as jest.Mock).mock.calls[0];

			expect(options.env.npm_config_nodedir).toBeUndefined();
		});

		it('should not override an npm_config_nodedir the operator already set', async () => {
			process.env.npm_config_nodedir = '/somewhere/else';

			(existsSync as jest.Mock).mockImplementation((path: string) => path === nodeHeader);
			(execFileSync as jest.Mock).mockReturnValue(Buffer.from(''));

			await runRebuild();

			const [, , options] = (execFileSync as jest.Mock).mock.calls[0];

			expect(options.env.npm_config_nodedir).toBe('/somewhere/else');
		});

		it('should run the image script against the new version directory', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			(execFileSync as jest.Mock).mockReturnValue(Buffer.from(''));

			await runRebuild();

			expect(execFileSync).toHaveBeenCalledWith(
				'bash',
				[SCRIPT, NEW_VERSION_DIR],
				expect.objectContaining({ stdio: 'inherit' }),
			);
		});

		it('should retry a failing rebuild and succeed on a later attempt', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			(execFileSync as jest.Mock)
				.mockImplementationOnce(() => {
					throw new Error('gyp ERR! ETIMEDOUT');
				})
				.mockImplementationOnce(() => {
					throw new Error('gyp ERR! ETIMEDOUT');
				})
				.mockReturnValue(Buffer.from(''));

			await expect(runRebuild()).resolves.toBeUndefined();

			expect(execFileSync).toHaveBeenCalledTimes(3);
		});

		it('should give up after three attempts so the update still rolls back', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			(execFileSync as jest.Mock).mockImplementation(() => {
				throw new Error('gyp ERR! ETIMEDOUT');
			});

			await expect(runRebuild()).rejects.toThrow('gyp ERR! ETIMEDOUT');

			expect(execFileSync).toHaveBeenCalledTimes(3);
		});
	});
});
