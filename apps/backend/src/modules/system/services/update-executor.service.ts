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

@Injectable()
export class UpdateExecutorService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateExecutorService');

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

			const child = spawn('bash', [updateScript, targetVersion], {
				detached: true,
				stdio: 'ignore',
				env: {
					...process.env,
					UPDATE_VERSION: targetVersion,
					STATUS_FILE,
					INSTALL_TYPE: installType,
					IMAGE_BASE_DIR: installType === 'image' ? this.updateService.getImageBaseDir() : '',
					DOWNLOAD_URL: downloadUrl ?? '',
				},
			});

			child.unref();

			this.logger.log(`Update worker spawned for version ${targetVersion} (PID: ${child.pid}, type: ${installType})`);
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
