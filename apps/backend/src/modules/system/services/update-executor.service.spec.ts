/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { existsSync, readFileSync, unlinkSync } from 'fs';

import { UpdateStatusType } from '../system.constants';

import { UpdateExecutorService } from './update-executor.service';

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	mkdirSync: jest.fn(),
	renameSync: jest.fn(),
	unlinkSync: jest.fn(),
}));

describe('UpdateExecutorService', () => {
	let executor: UpdateExecutorService;
	let updateService: {
		setStatus: jest.Mock;
		releaseUpdateLock: jest.Mock;
		acquireUpdateLock: jest.Mock;
		getInstallType: jest.Mock;
		getCurrentVersion: jest.Mock;
	};

	beforeEach(() => {
		updateService = {
			setStatus: jest.fn(),
			releaseUpdateLock: jest.fn(),
			acquireUpdateLock: jest.fn().mockReturnValue(true),
			getInstallType: jest.fn().mockReturnValue('npm'),
			getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
		};

		// Suppress onModuleInit by not calling it — we test checkPendingUpdateStatus separately
		(existsSync as jest.Mock).mockReturnValue(false);

		executor = new UpdateExecutorService(updateService as any);
		executor.onModuleInit();

		jest.clearAllMocks();
	});

	describe('checkPendingUpdateStatus (via onModuleInit)', () => {
		it('should do nothing when no status file exists', () => {
			(existsSync as jest.Mock).mockReturnValue(false);

			executor.onModuleInit();

			expect(updateService.setStatus).not.toHaveBeenCalled();
		});

		it('should handle completed update', () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.COMPLETE,
					phase: 'complete',
					targetVersion: '1.1.0',
					startedAt: new Date().toISOString(),
				}),
			);

			executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.COMPLETE,
					progressPercent: 100,
				}),
			);
			expect(unlinkSync).toHaveBeenCalled();
			expect(updateService.releaseUpdateLock).toHaveBeenCalled();
		});

		it('should handle failed update', () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.FAILED,
					phase: 'installing',
					targetVersion: '1.1.0',
					startedAt: new Date().toISOString(),
					error: 'npm install failed',
				}),
			);

			executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: 'npm install failed',
				}),
			);
			expect(unlinkSync).toHaveBeenCalled();
		});

		it('should detect timed-out updates', () => {
			const oldTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.DOWNLOADING,
					phase: 'downloading',
					targetVersion: '1.1.0',
					startedAt: oldTime,
				}),
			);

			executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: expect.stringContaining('timed out'),
				}),
			);
		});

		it('should detect interrupted updates (recent but in-progress)', () => {
			const recentTime = new Date(Date.now() - 30 * 1000).toISOString();

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.INSTALLING,
					phase: 'installing',
					targetVersion: '1.1.0',
					startedAt: recentTime,
				}),
			);

			executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: expect.stringContaining('interrupted'),
				}),
			);
		});

		it('should handle corrupt status file', () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue('not valid json');

			executor.onModuleInit();

			// Should attempt to clean up the corrupt file
			expect(unlinkSync).toHaveBeenCalled();
		});
	});
});
