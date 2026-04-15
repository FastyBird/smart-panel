import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SYSTEM_MODULE_NAME, UpdatePhase, UpdateStatusType } from '../system.constants';

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

const STATUS_POLL_INTERVAL_MS = 3_000; // Poll worker status every 3 seconds
const STATUS_POLL_MAX_MS = UPDATE_TIMEOUT_MS + 30_000; // Stop polling after timeout + grace

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
	private statusPollTimer: NodeJS.Timeout | null = null;
	private progressHighWaterMark = 0;

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

		try {
			const { spawn } = await import('child_process');

			// Spawn the update worker in its own systemd scope so it survives
			// when the smart-panel service is stopped during the update.
			// Without this, systemd kills all processes in the service cgroup.
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

			const setenvArgs = Object.entries(envVars).flatMap(([k, v]) => ['--setenv', `${k}=${v}`]);

			const child = spawn(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--scope',
					'--unit=smart-panel-update',
					...setenvArgs,
					'bash',
					updateScript,
					targetVersion,
				],
				{
					detached: true,
					stdio: 'ignore',
				},
			);

			child.unref();

			this.logger.log(`Update worker spawned for version ${targetVersion} (PID: ${child.pid}, type: ${installType})`);

			// Poll the status file to sync worker progress to in-memory status.
			// This catches fast failures (e.g. sudo check) and provides real-time
			// progress updates to the admin UI via WebSocket.
			this.startStatusPolling();
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

	private startStatusPolling(): void {
		this.stopStatusPolling();
		this.progressHighWaterMark = 10;

		const startedAt = Date.now();

		this.statusPollTimer = setInterval(() => {
			// Stop polling after timeout
			if (Date.now() - startedAt > STATUS_POLL_MAX_MS) {
				this.logger.error('Update status polling timed out');

				this.updateService.setStatus({
					status: UpdateStatusType.FAILED,
					phase: UpdatePhase.FAILED,
					progressPercent: null,
					message: null,
					error: 'Update timed out — no completion signal received',
				});

				this.updateService.releaseUpdateLock();
				this.stopStatusPolling();

				return;
			}

			if (!existsSync(STATUS_FILE)) {
				return;
			}

			try {
				const raw = readFileSync(STATUS_FILE, 'utf-8');
				const fileStatus = JSON.parse(raw) as UpdateProgressFile;

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
					this.stopStatusPolling();
				} else if (fileStatus.status === UpdateStatusType.COMPLETE) {
					this.updateService.setStatus({
						status: UpdateStatusType.COMPLETE,
						phase: UpdatePhase.COMPLETE,
						progressPercent: 100,
						message: `Successfully updated to ${fileStatus.targetVersion}`,
						error: null,
					});

					this.updateService.releaseUpdateLock();
					this.stopStatusPolling();
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
			} catch {
				// File may be mid-write, retry next cycle
			}
		}, STATUS_POLL_INTERVAL_MS);
	}

	private stopStatusPolling(): void {
		if (this.statusPollTimer) {
			clearInterval(this.statusPollTimer);
			this.statusPollTimer = null;
		}
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
