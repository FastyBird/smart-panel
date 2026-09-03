/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { existsSync, readFileSync, unlinkSync } from 'fs';

import { Logger } from '@nestjs/common';

import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { SYSTEM_MODULE_NAME, UpdateStatusType } from '../system.constants';

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
	let privilegedWorker: {
		run: jest.Mock;
		getStatus: jest.Mock;
		onStatus: jest.Mock;
	};
	let notifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };

	beforeEach(async () => {
		updateService = {
			setStatus: jest.fn(),
			releaseUpdateLock: jest.fn(),
			acquireUpdateLock: jest.fn().mockReturnValue(true),
			getInstallType: jest.fn().mockReturnValue('npm'),
			getCurrentVersion: jest.fn().mockReturnValue('1.0.0'),
		};
		// UpdateExecutorService now takes PrivilegedWorkerService as a constructor
		// dependency (not used by the checkPendingUpdateStatus path this file covers).
		privilegedWorker = {
			run: jest.fn(),
			getStatus: jest.fn(),
			onStatus: jest.fn(),
		};
		notifications = { notify: jest.fn(), resolve: jest.fn(), resolveAll: jest.fn() };

		// Suppress onModuleInit by not calling it — we test checkPendingUpdateStatus separately
		(existsSync as jest.Mock).mockReturnValue(false);

		executor = new UpdateExecutorService(updateService as any, privilegedWorker as any, notifications as any);
		await executor.onModuleInit();

		jest.clearAllMocks();
	});

	describe('checkPendingUpdateStatus (via onModuleInit)', () => {
		it('should do nothing when no status file exists', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);

			await executor.onModuleInit();

			expect(updateService.setStatus).not.toHaveBeenCalled();
		});

		it('should handle completed update', async () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.COMPLETE,
					phase: 'complete',
					targetVersion: '1.1.0',
					startedAt: new Date().toISOString(),
				}),
			);

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.COMPLETE,
					progressPercent: 100,
				}),
			);
			expect(unlinkSync).toHaveBeenCalled();
			expect(updateService.releaseUpdateLock).toHaveBeenCalled();
		});

		it('should handle failed update', async () => {
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

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: 'npm install failed',
				}),
			);
			expect(unlinkSync).toHaveBeenCalled();
		});

		it('should detect timed-out updates', async () => {
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

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: expect.stringContaining('timed out'),
				}),
			);
		});

		it('should detect interrupted updates (recent but in-progress)', async () => {
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

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: expect.stringContaining('interrupted'),
				}),
			);
		});

		it('should handle corrupt status file', async () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue('not valid json');

			await executor.onModuleInit();

			// Should attempt to clean up the corrupt file
			expect(unlinkSync).toHaveBeenCalled();
		});

		it('raises the persistent update-failed issue when a run reaches FAILED', async () => {
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

			await executor.onModuleInit();

			expect(notifications.notify).toHaveBeenCalledWith({
				source: SYSTEM_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'update-failed',
				severity: NotificationSeverity.ERROR,
				title: 'Update installation failed',
				message: 'npm install failed',
				actions: [{ type: NotificationActionType.LINK, label: 'View update', url: '/system/info', primary: true }],
				persistent: true,
			});
		});

		it('resolves the update-failed and update-available issues when a run completes', async () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.COMPLETE,
					phase: 'complete',
					targetVersion: '1.1.0',
					startedAt: new Date().toISOString(),
				}),
			);

			await executor.onModuleInit();

			expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'update-failed');
			expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'update-available');
		});

		it('does not settle onModuleInit until the update-failed notification is persisted', async () => {
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

			let releaseNotify: () => void = () => undefined;
			notifications.notify.mockImplementation(
				() =>
					new Promise((resolve) => {
						releaseNotify = () => resolve(null);
					}),
			);

			let settled = false;
			const init = executor.onModuleInit().then(() => {
				settled = true;
			});

			// Give every pending microtask a chance to run - onModuleInit must still be waiting
			// on the deferred notify() call, not on anything else.
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(settled).toBe(false);

			releaseNotify();
			await init;

			expect(settled).toBe(true);
		});

		it('attempts both resolutions and logs when one rejects, without breaking onModuleInit', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					status: UpdateStatusType.COMPLETE,
					phase: 'complete',
					targetVersion: '1.1.0',
					startedAt: new Date().toISOString(),
				}),
			);

			notifications.resolve.mockImplementation((_source: string, key: string) => {
				if (key === 'update-failed') {
					return Promise.reject(new Error('database is locked'));
				}

				return Promise.resolve(true);
			});

			await expect(executor.onModuleInit()).resolves.toBeUndefined();

			expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'update-failed');
			expect(notifications.resolve).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, 'update-available');
			expect(
				error.mock.calls.some(([message]) => typeof message === 'string' && message.includes('database is locked')),
			).toBe(true);
		});
	});
});
