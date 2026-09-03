import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { sanitizeErrorMessage } from '../../notifications/notifications.utils';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SYSTEM_MODULE_NAME, UpdatePhase, UpdateStatusType } from '../system.constants';

import { PrivilegedJobStatus, PrivilegedWorkerService } from './privileged-worker.service';
import { UpdateService } from './update.service';

export interface UpdateProgressFile {
	status: UpdateStatusType;
	phase: UpdatePhase;
	targetVersion: string;
	startedAt: string;
	completedAt?: string;
	error?: string;
}

const STATUS_FILE = '/var/lib/smart-panel/update-status.json';
const UPDATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// PrivilegedWorkerService's own hard timeout for this job. Kept slightly longer than
// UPDATE_TIMEOUT_MS (used above for restart-recovery detection) so a completion signal
// landing right at the boundary is still caught by the last poll tick.
const STATUS_POLL_MAX_MS = UPDATE_TIMEOUT_MS + 30_000;

const UPDATE_WORKER_UNIT = 'smart-panel-update';

/**
 * Map worker phases to approximate progress percentages.
 * Image path: downloading→installing→stopping→migrating→starting
 * NPM path:   downloading→stopping→installing→migrating→starting
 * Installing and stopping share the same value so neither path goes backwards.
 */
const PHASE_PROGRESS: Record<string, number> = {
	downloading: 20,
	installing: 45,
	stopping: 45,
	migrating: 65,
	starting: 85,
	complete: 100,
};

/**
 * Maps update-worker.sh's own status-file shape (`status`/`phase`/`error`, from
 * UpdateProgressFile) onto PrivilegedWorkerService's generic PrivilegedJobStatus shape, so the
 * service's own terminal-state detection and one-job-per-unit release work for this legacy
 * format the same way they do for a script that writes the canonical shape directly.
 *
 * `status` and `phase` are always the same string for every non-terminal write in
 * update-worker.sh (e.g. `update_status "downloading" "downloading"`), and UpdateStatusType /
 * UpdatePhase share the same string values, so `phase` alone is enough to recover both when
 * building the in-memory UpdateStatusInfo below.
 */
function mapUpdateWorkerStatus(raw: Record<string, unknown>): Partial<PrivilegedJobStatus> | null {
	const status = raw.status as UpdateStatusType | undefined;

	if (!status) {
		return null;
	}

	const state: PrivilegedJobStatus['state'] =
		status === UpdateStatusType.COMPLETE ? 'complete' : status === UpdateStatusType.FAILED ? 'failed' : 'running';

	return {
		state,
		step: raw.phase as string | undefined,
		message: raw.error as string | undefined,
	};
}

@Injectable()
export class UpdateExecutorService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateExecutorService');
	private progressHighWaterMark = 0;

	constructor(
		private readonly updateService: UpdateService,
		private readonly privilegedWorker: PrivilegedWorkerService,
		private readonly notifications: NotificationsService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.checkPendingUpdateStatus();
	}

	private async checkPendingUpdateStatus(): Promise<void> {
		if (!existsSync(STATUS_FILE)) {
			return;
		}

		try {
			const raw = readFileSync(STATUS_FILE, 'utf-8');
			const status = JSON.parse(raw) as UpdateProgressFile;

			if (status.status === UpdateStatusType.COMPLETE) {
				this.logger.log(`Update to ${status.targetVersion} completed successfully`);

				this.updateService.setStatus({
					status: UpdateStatusType.COMPLETE,
					phase: UpdatePhase.COMPLETE,
					progressPercent: 100,
					message: `Successfully updated to ${status.targetVersion}`,
					error: null,
				});

				await this.reportUpdateSucceeded();
			} else if (status.status === UpdateStatusType.FAILED) {
				this.logger.error(`Update to ${status.targetVersion} failed: ${status.error ?? 'unknown error'}`);

				await this.failUpdate(status.error ?? 'Update failed with unknown error');
			} else {
				// Update was in progress when the service restarted - check timeout
				const startedAt = new Date(status.startedAt).getTime();

				if (Date.now() - startedAt > UPDATE_TIMEOUT_MS) {
					this.logger.error(`Update to ${status.targetVersion} timed out`);

					await this.failUpdate('Update timed out after 10 minutes');
				} else {
					this.logger.warn(
						`Update to ${status.targetVersion} was in progress (phase: ${status.phase}), service restarted`,
					);

					await this.failUpdate(`Update interrupted during ${status.phase} phase`);
				}
			}

			// Clean up status file after processing
			unlinkSync(STATUS_FILE);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read update status file: ${err.message}`);

			try {
				unlinkSync(STATUS_FILE);
			} catch {
				// Ignore cleanup errors
			}
		}

		// Release the lock in case it was set before restart
		this.updateService.releaseUpdateLock();
	}

	async startUpdate(targetVersion: string): Promise<void> {
		if (!this.updateService.acquireUpdateLock()) {
			throw new Error('An update is already in progress');
		}

		const installType = this.updateService.getInstallType();

		this.logger.log(`Starting ${installType} update to version ${targetVersion}`);

		// For image installs, resolve the download URL before spawning the worker
		let downloadUrl: string | undefined;

		if (installType === 'image') {
			const asset = await this.updateService.fetchServerReleaseAsset(targetVersion);

			if (!asset) {
				this.updateService.releaseUpdateLock();

				await this.failUpdate(`No backend release artifact found for version ${targetVersion}`);

				throw new Error(`No backend release artifact found for version ${targetVersion}`);
			}

			downloadUrl = asset.downloadUrl;
		}

		// Write initial status file
		this.writeStatusFile({
			status: UpdateStatusType.DOWNLOADING,
			phase: UpdatePhase.DOWNLOADING,
			targetVersion,
			startedAt: new Date().toISOString(),
		});

		this.updateService.setStatus({
			status: UpdateStatusType.DOWNLOADING,
			phase: UpdatePhase.DOWNLOADING,
			progressPercent: 10,
			message: 'Starting update process...',
			error: null,
			startedAt: new Date(),
		});

		// Spawn detached update script (bundled as NestJS asset in dist/modules/system/scripts/)
		const updateScript = join(__dirname, '..', 'scripts', 'update-worker.sh');

		if (!existsSync(updateScript)) {
			this.updateService.releaseUpdateLock();

			const errorMsg = `Update worker script not found at ${updateScript}`;

			this.logger.error(errorMsg);

			await this.failUpdate(errorMsg);

			this.writeStatusFile({
				status: UpdateStatusType.FAILED,
				phase: UpdatePhase.FAILED,
				targetVersion,
				startedAt: new Date().toISOString(),
				error: errorMsg,
			});

			throw new Error(errorMsg);
		}

		const envVars: Record<string, string> = {
			UPDATE_VERSION: targetVersion,
			STATUS_FILE,
			INSTALL_TYPE: installType,
			IMAGE_BASE_DIR: installType === 'image' ? this.updateService.getImageBaseDir() : '',
			DOWNLOAD_URL: downloadUrl ?? '',
			HOME: process.env.HOME ?? '/root',
			PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
		};

		if (process.env.FB_DATA_DIR) envVars.FB_DATA_DIR = process.env.FB_DATA_DIR;
		if (process.env.FB_DB_PATH) envVars.FB_DB_PATH = process.env.FB_DB_PATH;
		if (process.env.FB_CONFIG_PATH) envVars.FB_CONFIG_PATH = process.env.FB_CONFIG_PATH;

		try {
			// Spawn the update worker in its own systemd scope so it survives when the
			// smart-panel service is stopped during the update — otherwise systemd would
			// kill every process in the service's cgroup, including this one.
			const { id } = await this.privilegedWorker.run({
				unit: UPDATE_WORKER_UNIT,
				script: updateScript,
				args: [targetVersion],
				env: envVars,
				statusFile: STATUS_FILE,
				timeoutMs: STATUS_POLL_MAX_MS,
				mapStatus: mapUpdateWorkerStatus,
			});

			this.logger.log(`Update worker spawned for version ${targetVersion} (job: ${id}, type: ${installType})`);

			// Sync worker progress to in-memory status as PrivilegedWorkerService polls the
			// status file. This catches fast failures (e.g. sudo check) and provides
			// real-time progress updates to the admin UI via WebSocket.
			this.progressHighWaterMark = 10;
			this.watchUpdateJob(id, targetVersion);
		} catch (error) {
			const err = error as Error;

			this.updateService.releaseUpdateLock();

			await this.failUpdate(`Failed to spawn update worker: ${err.message}`);

			this.writeStatusFile({
				status: UpdateStatusType.FAILED,
				phase: UpdatePhase.FAILED,
				targetVersion,
				startedAt: new Date().toISOString(),
				error: `Failed to spawn update worker: ${err.message}`,
			});

			throw error;
		}
	}

	/**
	 * Subscribes to PrivilegedWorkerService's status-file polling for one update job and
	 * translates the (already mapUpdateWorkerStatus-mapped) generic status into this module's
	 * own update status — exactly what the polling interval callback used to do inline before
	 * the spawn/poll/timeout machinery moved to PrivilegedWorkerService. Unsubscribing here is
	 * just hygiene (stop notifications once we've handled a terminal tick); PrivilegedWorkerService
	 * itself — via the mapped status's `state` — is what releases the unit.
	 */
	private watchUpdateJob(id: string, targetVersion: string): void {
		const unsubscribe = this.privilegedWorker.onStatus(id, (status: PrivilegedJobStatus) => {
			if (status.state === 'timeout') {
				this.logger.error('Update status polling timed out');

				// PrivilegedWorkerService calls this handler directly - it is not awaited, so a
				// rejection is chained and logged here rather than left unhandled.
				this.failUpdate('Update timed out — no completion signal received').catch((error: unknown) => {
					this.logHandlerFailure('Failed to record the update timeout', error);
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();

				return;
			}

			if (status.state === 'failed') {
				this.logger.error(`Update worker failed: ${status.message ?? 'unknown error'}`);

				this.failUpdate(status.message ?? 'Update failed with unknown error').catch((error: unknown) => {
					this.logHandlerFailure('Failed to record the update failure', error);
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();

				return;
			}

			if (status.state === 'complete') {
				this.updateService.setStatus({
					status: UpdateStatusType.COMPLETE,
					phase: UpdatePhase.COMPLETE,
					progressPercent: 100,
					message: `Successfully updated to ${targetVersion}`,
					error: null,
				});

				this.reportUpdateSucceeded().catch((error: unknown) => {
					this.logHandlerFailure('Failed to record update success', error);
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();

				return;
			}

			// Running — sync worker phase to in-memory status. Use high-water mark so progress
			// never goes backwards (image and npm paths have different phase ordering).
			// status.step carries update-worker.sh's `phase` value directly (see
			// mapUpdateWorkerStatus), which is always the same string as its `status` value for
			// every non-terminal write, so it doubles as both UpdateStatusType and UpdatePhase here.
			const rawProgress = PHASE_PROGRESS[status.step ?? ''] ?? 10;
			const progress = Math.max(this.progressHighWaterMark, rawProgress);

			this.progressHighWaterMark = progress;

			this.updateService.setStatus({
				status: (status.step as UpdateStatusType) ?? UpdateStatusType.DOWNLOADING,
				phase: (status.step as UpdatePhase) ?? UpdatePhase.DOWNLOADING,
				progressPercent: progress,
				message: `Update in progress: ${status.step}...`,
				error: null,
			});
		});
	}

	private writeStatusFile(status: UpdateProgressFile): void {
		try {
			const dir = dirname(STATUS_FILE);

			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// Atomic write: write to temp file then rename
			const tmpFile = `${STATUS_FILE}.tmp`;

			writeFileSync(tmpFile, JSON.stringify(status, null, '\t'), { mode: 0o644 });

			renameSync(tmpFile, STATUS_FILE);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to write update status file: ${err.message}`);
		}
	}

	/**
	 * Every place a run reaches `FAILED` shares this shape (only `error` varies), so it also
	 * raises the persistent `update-failed` issue - "persistent" because nothing re-detects a
	 * failed install on its own, only the next run or the administrator dismissing it.
	 *
	 * Awaited by every caller so the transition is persisted before the caller moves on -
	 * `startUpdate()`'s failure paths throw immediately afterwards, and the boot-time recovery
	 * path in `checkPendingUpdateStatus()` deletes the status file right after. notify() never
	 * throws, so nothing here can turn a successful call into an unhandled rejection.
	 */
	private async failUpdate(error: string): Promise<void> {
		this.updateService.setStatus({
			status: UpdateStatusType.FAILED,
			phase: UpdatePhase.FAILED,
			progressPercent: null,
			message: null,
			error,
		});

		await this.notifications.notify({
			source: SYSTEM_MODULE_NAME,
			kind: NotificationKind.ISSUE,
			key: 'update-failed',
			severity: NotificationSeverity.ERROR,
			title: 'Update installation failed',
			message: sanitizeErrorMessage(error),
			actions: [{ type: NotificationActionType.LINK, label: 'View update', url: '/system/info', primary: true }],
			persistent: true,
		});
	}

	/**
	 * A successful run clears both the failure it may have left behind and the availability
	 * issue that prompted the install in the first place - waiting for the next scheduled check
	 * (up to 12 h away) to notice the update is gone would leave a stale notification.
	 *
	 * Unlike notify(), resolve() can throw, and the two keys are independent of each other, so
	 * both are attempted even when one fails - each is caught individually rather than one
	 * `Promise.all`, which would abandon the second resolve() the moment the first rejects.
	 */
	private async reportUpdateSucceeded(): Promise<void> {
		const outcomes = await Promise.allSettled([
			this.notifications.resolve(SYSTEM_MODULE_NAME, 'update-failed'),
			this.notifications.resolve(SYSTEM_MODULE_NAME, 'update-available'),
		]);

		for (const outcome of outcomes) {
			if (outcome.status === 'rejected') {
				this.logHandlerFailure('Failed to resolve an update notification', outcome.reason);
			}
		}
	}

	/**
	 * `watchUpdateJob`'s status callback is a synchronous event handler PrivilegedWorkerService
	 * invokes directly - there is nothing there to await - so a rejection from the async helpers
	 * above is chained into this instead of being left an unhandled rejection.
	 */
	private logHandlerFailure(context: string, error: unknown): void {
		const message = error instanceof Error ? error.message : 'Unknown error';

		this.logger.error(`${context}: ${message}`);
	}
}
