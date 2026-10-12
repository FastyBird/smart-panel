/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { existsSync, readFileSync, unlinkSync } from 'fs';

import { Logger } from '@nestjs/common';

import * as privilegedHelper from '../../../common/utils/privileged-helper.utils';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { SYSTEM_MODULE_NAME, UPDATE_TIMEOUT_MS, UPDATE_WORKER_TIMEOUT_MS, UpdateStatusType } from '../system.constants';

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
		clearUpdateStatus: jest.Mock;
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
			clearUpdateStatus: jest.fn().mockResolvedValue(undefined),
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

	afterEach(() => {
		executor.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('launches updates independently and preserves a readable initial progress message', async () => {
		(existsSync as jest.Mock).mockImplementation((path: string) => !path.includes('update-attempt'));
		privilegedWorker.run.mockResolvedValue({ id: 'update-job' });
		privilegedWorker.onStatus.mockImplementation((_id: string, handler: (status: unknown) => void) => {
			handler({ id: 'update-job', state: 'running' });

			return jest.fn();
		});

		await executor.startUpdate('1.1.0-alpha.25');

		expect(privilegedWorker.run).toHaveBeenCalledWith(
			expect.objectContaining({
				unit: 'smart-panel-update',
				unitType: 'service',
				timeoutMs: 1_830_000,
				env: expect.objectContaining({
					UPDATE_START_MODE: 'running-service',
					UPDATE_OBSERVER_GID: String(process.getgid()),
				}),
			}),
		);
		expect(updateService.setStatus).toHaveBeenLastCalledWith(
			expect.objectContaining({
				status: UpdateStatusType.DOWNLOADING,
				message: 'Starting update process...',
			}),
		);
	});

	describe('root-owned update state', () => {
		beforeEach(() => {
			jest.spyOn(privilegedHelper, 'privilegedHelperPresent').mockReturnValue(true);
		});

		it('launches using helper state without writing backend-owned files', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			privilegedWorker.run.mockResolvedValue({ id: 'helper-job' });
			privilegedWorker.onStatus.mockReturnValue(jest.fn());
			await executor.startUpdate('1.2.3');
			expect(privilegedWorker.clearUpdateStatus).toHaveBeenCalledTimes(1);
			expect(privilegedWorker.run).toHaveBeenCalledWith(
				expect.objectContaining({
					job: 'update',
					timeoutMs: 1_830_000,
					statusFile: privilegedHelper.PRIVILEGED_OPERATIONS.update.statusFile,
				}),
			);
			expect(unlinkSync).not.toHaveBeenCalled();
		});

		it('refuses a new launch when the helper cannot acknowledge a recovery hold', async () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			privilegedWorker.clearUpdateStatus.mockRejectedValue(new Error('recovery required'));
			await expect(executor.startUpdate('1.2.3')).rejects.toThrow('recovery required');
			expect(privilegedWorker.run).not.toHaveBeenCalled();
			expect(unlinkSync).not.toHaveBeenCalled();
		});

		it('preserves malformed durable state and refuses new updates', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue('{"state":"unknown"}');
			await executor.onModuleInit();
			await expect(executor.startUpdate('1.2.3')).rejects.toThrow('operator recovery');
			expect(privilegedWorker.run).not.toHaveBeenCalled();
			expect(privilegedWorker.clearUpdateStatus).not.toHaveBeenCalled();
			expect(unlinkSync).not.toHaveBeenCalled();
		});

		it('observes the root updater after a backend restart and fails closed if its durable record disappears', async () => {
			jest.useFakeTimers();
			let attemptExists = true;
			(existsSync as jest.Mock).mockImplementation((path: string) =>
				path.includes('update-attempt') ? attemptExists : true,
			);
			(readFileSync as jest.Mock).mockImplementation((path: string) =>
				JSON.stringify(
					path.includes('update-attempt')
						? {
								attemptId: 'live-root',
								ownerPid: process.pid,
								targetVersion: '1.2.3',
								state: 'active',
								phase: 'starting',
								recoveryRequired: false,
							}
						: {
								status: UpdateStatusType.COMPLETE,
								phase: 'complete',
								targetVersion: '1.2.3',
								startedAt: new Date().toISOString(),
							},
				),
			);
			await executor.onModuleInit();
			expect(updateService.setStatus).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: UpdateStatusType.STARTING }),
			);
			attemptExists = false;
			await jest.advanceTimersByTimeAsync(3000);
			expect(updateService.setStatus).toHaveBeenLastCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.FAILED,
					error: expect.stringContaining('lost its durable recovery record'),
				}),
			);
			expect(privilegedWorker.clearUpdateStatus).not.toHaveBeenCalled();
			expect(unlinkSync).not.toHaveBeenCalled();
		});

		it('keeps durable completion when acknowledgement races the updater exit', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					attemptId: 'completed-root',
					ownerPid: 999999,
					targetVersion: '1.2.3',
					state: 'complete',
					phase: 'complete',
					recoveryRequired: false,
				}),
			);
			privilegedWorker.clearUpdateStatus.mockRejectedValue(new Error('unit is still active'));
			await executor.onModuleInit();
			expect(updateService.setStatus).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
			);
			expect(notifications.notify).not.toHaveBeenCalled();
			expect(unlinkSync).not.toHaveBeenCalled();
		});

		it('holds recovery-required metadata even if its state claims completion', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					attemptId: 'held-root',
					ownerPid: 999999,
					targetVersion: '1.2.3',
					state: 'complete',
					phase: 'migrating',
					recoveryRequired: true,
				}),
			);
			await executor.onModuleInit();
			await expect(executor.startUpdate('1.2.4')).rejects.toThrow('requires recovery');
			expect(updateService.setStatus).not.toHaveBeenCalledWith(
				expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
			);
			expect(privilegedWorker.clearUpdateStatus).not.toHaveBeenCalled();
		});

		it('acknowledges a recovered completed attempt through the helper', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					attemptId: 'root-attempt',
					ownerPid: 999999,
					targetVersion: '1.2.3',
					state: 'complete',
					phase: 'complete',
					recoveryRequired: false,
				}),
			);
			await executor.onModuleInit();
			expect(privilegedWorker.clearUpdateStatus).toHaveBeenCalledTimes(1);
			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
			);
			expect(unlinkSync).not.toHaveBeenCalled();
		});
	});

	describe('checkPendingUpdateStatus (via onModuleInit)', () => {
		it.each([true, false])(
			'restores startup progress without blocking initialization (status file: %s)',
			async (hasStatus) => {
				jest.useFakeTimers();
				(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt') || hasStatus);
				(readFileSync as jest.Mock).mockImplementation((path: string) => {
					if (path.includes('update-attempt')) {
						return JSON.stringify({
							attemptId: 'attempt-startup',
							ownerPid: process.pid,
							targetVersion: '1.1.0-alpha.18',
							state: 'active',
							phase: 'starting',
							recoveryRequired: false,
						});
					}

					return JSON.stringify({
						status: UpdateStatusType.STARTING,
						phase: 'starting',
						targetVersion: '1.1.0-alpha.18',
						startedAt: new Date().toISOString(),
					});
				});

				const init = executor.onModuleInit();
				await init;

				expect(updateService.setStatus).toHaveBeenCalledWith({
					status: UpdateStatusType.STARTING,
					phase: 'starting',
					progressPercent: 85,
					message: 'Update in progress: starting...',
					error: null,
				});
				await expect(executor.startUpdate('1.1.0-alpha.19')).rejects.toThrow('requires recovery');
				expect(privilegedWorker.run).not.toHaveBeenCalled();
				expect(updateService.releaseUpdateLock).not.toHaveBeenCalled();
				expect(unlinkSync).not.toHaveBeenCalled();

				expect(updateService.setStatus).not.toHaveBeenCalledWith(
					expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
				);

				executor.onModuleDestroy();
				jest.useRealTimers();
			},
		);

		it('accepts a reconciled failure without reporting success', async () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockImplementation((path: string) => {
				if (path.includes('update-attempt')) {
					return JSON.stringify({
						attemptId: 'attempt-reconciled',
						ownerPid: 999999,
						targetVersion: '1.1.0-alpha.18',
						state: 'reconciled',
						phase: 'reconciled_post_migration',
						recoveryRequired: false,
						error: 'Target service did not reach verified health after migration',
					});
				}

				return JSON.stringify({
					status: UpdateStatusType.FAILED,
					phase: UpdateStatusType.FAILED,
					targetVersion: '1.1.0-alpha.18',
					startedAt: new Date().toISOString(),
					error: 'Target service did not reach verified health after migration',
				});
			});

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({ status: UpdateStatusType.FAILED }),
			);
			expect(updateService.setStatus).not.toHaveBeenCalledWith(
				expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
			);
		});

		it.each([null, 'EPERM'])(
			'reconciles a live worker with process probe error %s when its durable attempt completes',
			async (probeError) => {
				jest.spyOn(process, 'kill').mockImplementation(() => {
					if (probeError) throw Object.assign(new Error('Operation not permitted'), { code: probeError });
					return true;
				});
				jest.useFakeTimers();
				(existsSync as jest.Mock).mockReturnValue(true);
				let attemptReads = 0;
				(readFileSync as jest.Mock).mockImplementation((path: string) => {
					if (path.includes('update-attempt')) {
						attemptReads += 1;

						return JSON.stringify(
							attemptReads <= 2
								? {
										attemptId: 'attempt-1',
										ownerPid: process.pid,
										targetVersion: '1.1.0-alpha.15',
										state: 'active',
										phase: 'starting',
										recoveryRequired: false,
									}
								: {
										attemptId: 'attempt-1',
										ownerPid: process.pid,
										targetVersion: '1.1.0-alpha.15',
										state: 'complete',
										phase: 'complete',
										recoveryRequired: false,
									},
						);
					}

					return JSON.stringify({
						status: UpdateStatusType.STARTING,
						phase: 'starting',
						targetVersion: '1.1.0-alpha.15',
						startedAt: new Date().toISOString(),
					});
				});

				const init = executor.onModuleInit();
				await init;
				expect(updateService.setStatus).toHaveBeenLastCalledWith(
					expect.objectContaining({ status: UpdateStatusType.STARTING, progressPercent: 85 }),
				);
				await jest.advanceTimersByTimeAsync(3_000);
				jest.useRealTimers();

				expect(updateService.setStatus).toHaveBeenCalledWith(
					expect.objectContaining({
						status: UpdateStatusType.COMPLETE,
						progressPercent: 100,
					}),
				);
				expect(unlinkSync).toHaveBeenCalled();
				expect(updateService.releaseUpdateLock).toHaveBeenCalled();
			},
		);

		it('reconciles a complete attempt even when completed status was not persisted', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					attemptId: 'attempt-complete',
					ownerPid: process.pid,
					targetVersion: '1.1.0-alpha.15',
					state: 'complete',
					phase: 'complete',
					recoveryRequired: false,
				}),
			);

			await executor.onModuleInit();

			expect(updateService.setStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					status: UpdateStatusType.COMPLETE,
					message: 'Successfully updated to 1.1.0-alpha.15',
				}),
			);
			expect(updateService.releaseUpdateLock).toHaveBeenCalled();
		});

		it('reports an unresolved recovery hold without deleting its status or attempt', async () => {
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockImplementation((path: string) => {
				if (path.includes('update-attempt')) {
					return JSON.stringify({
						attemptId: 'attempt-2',
						ownerPid: 999999,
						targetVersion: '1.1.0-alpha.15',
						state: 'recovery_required',
						phase: 'migration_failed',
						recoveryRequired: true,
						error: 'migration failed; recovery required',
					});
				}

				return JSON.stringify({
					status: UpdateStatusType.FAILED,
					phase: 'failed',
					targetVersion: '1.1.0-alpha.15',
					startedAt: new Date().toISOString(),
					error: 'migration failed; recovery required',
				});
			});

			await executor.onModuleInit();

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'migration failed; recovery required' }),
			);
			expect(unlinkSync).not.toHaveBeenCalled();
			expect(updateService.releaseUpdateLock).not.toHaveBeenCalled();
		});

		it.each([true, false])(
			'observes a live slow update past ten minutes (eventual completion: %s)',
			async (complete) => {
				jest.useFakeTimers();
				jest.spyOn(privilegedHelper, 'privilegedHelperPresent').mockReturnValue(true);
				jest.spyOn(process, 'kill').mockReturnValue(true);
				(existsSync as jest.Mock).mockReturnValue(true);
				let state = 'active';
				const startedAt = new Date(Date.now() - 12 * 60_000).toISOString();
				(readFileSync as jest.Mock).mockImplementation((path: string) =>
					JSON.stringify(
						path.includes('update-attempt')
							? {
									attemptId: 'slow-update',
									ownerPid: process.pid,
									targetVersion: '1.1.0-alpha.63',
									state,
									phase: state === 'active' ? 'starting' : 'complete',
									recoveryRequired: false,
								}
							: {
									status: state === 'active' ? UpdateStatusType.STARTING : UpdateStatusType.COMPLETE,
									phase: state === 'active' ? 'starting' : 'complete',
									targetVersion: '1.1.0-alpha.63',
									startedAt,
								},
					),
				);

				await executor.onModuleInit();
				await jest.advanceTimersByTimeAsync(12 * 60_000);
				expect(updateService.setStatus).not.toHaveBeenCalledWith(
					expect.objectContaining({ status: UpdateStatusType.FAILED }),
				);
				expect(privilegedWorker.clearUpdateStatus).not.toHaveBeenCalled();
				expect(updateService.releaseUpdateLock).not.toHaveBeenCalled();

				if (complete) {
					state = 'complete';
					await jest.advanceTimersByTimeAsync(3_000);
					expect(updateService.setStatus).toHaveBeenLastCalledWith(
						expect.objectContaining({ status: UpdateStatusType.COMPLETE }),
					);
					expect(privilegedWorker.clearUpdateStatus).toHaveBeenCalledTimes(1);
				} else {
					await jest.advanceTimersByTimeAsync(UPDATE_WORKER_TIMEOUT_MS - 12 * 60_000);
					expect(updateService.setStatus).toHaveBeenLastCalledWith(
						expect.objectContaining({ status: UpdateStatusType.FAILED, error: expect.stringContaining('recovery') }),
					);
					expect(privilegedWorker.clearUpdateStatus).not.toHaveBeenCalled();
					expect(updateService.releaseUpdateLock).not.toHaveBeenCalled();
				}
			},
		);

		it('does not permit another update while a durable attempt requires recovery', async () => {
			(existsSync as jest.Mock).mockImplementation((path: string) => path.includes('update-attempt'));
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({
					attemptId: 'attempt-3',
					ownerPid: 999999,
					targetVersion: '1.1.0-alpha.15',
					state: 'recovery_required',
					phase: 'start_failed',
					recoveryRequired: true,
				}),
			);

			await expect(executor.startUpdate('1.1.0-alpha.16')).rejects.toThrow('requires recovery');
			expect(updateService.acquireUpdateLock).not.toHaveBeenCalled();
		});

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
			const oldTime = new Date(Date.now() - UPDATE_TIMEOUT_MS - 1).toISOString();

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
					error: 'Update timed out after 30 minutes',
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
