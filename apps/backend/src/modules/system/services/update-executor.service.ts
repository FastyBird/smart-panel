import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
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

@Injectable()
export class UpdateExecutorService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateExecutorService');
	private progressHighWaterMark = 0;

	// Property injection keeps the constructor's signature — and every existing call site
	// that builds this service directly, e.g. `new UpdateExecutorService(updateService)` — unchanged.
	@Inject(PrivilegedWorkerService)
	private readonly privilegedWorker!: PrivilegedWorkerService;

	constructor(private readonly updateService: UpdateService) {}

	onModuleInit(): void {
		this.checkPendingUpdateStatus();
	}

	private checkPendingUpdateStatus(): void {
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
			} else if (status.status === UpdateStatusType.FAILED) {
				this.logger.error(`Update to ${status.targetVersion} failed: ${status.error ?? 'unknown error'}`);

				this.updateService.setStatus({
					status: UpdateStatusType.FAILED,
					phase: UpdatePhase.FAILED,
					progressPercent: null,
					message: null,
					error: status.error ?? 'Update failed with unknown error',
				});
			} else {
				// Update was in progress when the service restarted - check timeout
				const startedAt = new Date(status.startedAt).getTime();

				if (Date.now() - startedAt > UPDATE_TIMEOUT_MS) {
					this.logger.error(`Update to ${status.targetVersion} timed out`);

					this.updateService.setStatus({
						status: UpdateStatusType.FAILED,
						phase: UpdatePhase.FAILED,
						progressPercent: null,
						message: null,
						error: 'Update timed out after 10 minutes',
					});
				} else {
					this.logger.warn(
						`Update to ${status.targetVersion} was in progress (phase: ${status.phase}), service restarted`,
					);

					this.updateService.setStatus({
						status: UpdateStatusType.FAILED,
						phase: UpdatePhase.FAILED,
						progressPercent: null,
						message: null,
						error: `Update interrupted during ${status.phase} phase`,
					});
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

				this.updateService.setStatus({
					status: UpdateStatusType.FAILED,
					phase: UpdatePhase.FAILED,
					progressPercent: null,
					message: null,
					error: `No backend release artifact found for version ${targetVersion}`,
				});

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

			this.updateService.setStatus({
				status: UpdateStatusType.FAILED,
				phase: UpdatePhase.FAILED,
				progressPercent: null,
				message: null,
				error: errorMsg,
			});

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

			this.updateService.setStatus({
				status: UpdateStatusType.FAILED,
				phase: UpdatePhase.FAILED,
				progressPercent: null,
				message: null,
				error: `Failed to spawn update worker: ${err.message}`,
			});

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
	 * translates whatever it forwards into this module's own update status — exactly what the
	 * polling interval callback used to do inline before the spawn/poll/timeout machinery moved
	 * to PrivilegedWorkerService.
	 *
	 * `status.state` only carries a real value (`'timeout'`) when PrivilegedWorkerService
	 * synthesizes it itself, after the hard timeout — update-worker.sh's own status file uses
	 * `status`/`phase`/`error`, not the generic `state`/`step`/`message` shape, so every other
	 * tick is re-read as the UpdateProgressFile it actually is.
	 */
	private watchUpdateJob(id: string, targetVersion: string): void {
		const unsubscribe = this.privilegedWorker.onStatus(id, (status: PrivilegedJobStatus) => {
			if (status.state === 'timeout') {
				this.logger.error('Update status polling timed out');

				this.updateService.setStatus({
					status: UpdateStatusType.FAILED,
					phase: UpdatePhase.FAILED,
					progressPercent: null,
					message: null,
					error: 'Update timed out — no completion signal received',
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();

				return;
			}

			const fileStatus = status as unknown as UpdateProgressFile;

			if (fileStatus.status === UpdateStatusType.FAILED) {
				this.logger.error(`Update worker failed: ${fileStatus.error ?? 'unknown error'}`);

				this.updateService.setStatus({
					status: UpdateStatusType.FAILED,
					phase: UpdatePhase.FAILED,
					progressPercent: null,
					message: null,
					error: fileStatus.error ?? 'Update failed with unknown error',
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();
			} else if (fileStatus.status === UpdateStatusType.COMPLETE) {
				this.updateService.setStatus({
					status: UpdateStatusType.COMPLETE,
					phase: UpdatePhase.COMPLETE,
					progressPercent: 100,
					message: `Successfully updated to ${targetVersion}`,
					error: null,
				});

				this.updateService.releaseUpdateLock();
				unsubscribe();
			} else {
				// In-progress — sync worker phase to in-memory status.
				// Use high-water mark so progress never goes backwards
				// (image and npm paths have different phase ordering).
				const rawProgress = PHASE_PROGRESS[fileStatus.phase] ?? 10;
				const progress = Math.max(this.progressHighWaterMark, rawProgress);

				this.progressHighWaterMark = progress;

				this.updateService.setStatus({
					status: fileStatus.status ?? UpdateStatusType.DOWNLOADING,
					phase: fileStatus.phase ?? UpdatePhase.DOWNLOADING,
					progressPercent: progress,
					message: `Update in progress: ${fileStatus.phase}...`,
					error: null,
				});
			}
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
}
