import { CronJob } from 'cron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { ILogger } from '../../../modules/system/logger/logger';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';
import { LoggerRotatingFileException } from '../logger-rotating-file.exceptions';
import { RotatingFileConfigModel } from '../models/config.model';

/**
 * Rotating file logger service.
 *
 * This service is managed by PluginServiceManagerService and implements
 * the IManagedPluginService interface for centralized lifecycle management.
 */
@Injectable()
export class FileLoggerService implements ILogger, IManagedPluginService {
	private readonly logger = new Logger(FileLoggerService.name);

	readonly pluginName = LOGGER_ROTATING_FILE_PLUGIN_NAME;
	readonly serviceId = 'file-logger';

	private dir: string | undefined;

	private pluginConfig: RotatingFileConfigModel | null = null;

	private state: ServiceState = 'stopped';

	constructor(
		private readonly configService: ConfigService,
		private readonly scheduler: SchedulerRegistry,
	) {}

	/**
	 * Start the service.
	 * Called by PluginServiceManagerService when the plugin is enabled.
	 */
	async start(): Promise<void> {
		if (this.state === 'started' || this.state === 'starting') {
			return;
		}

		this.state = 'starting';

		this.logger.log('[ROTATING FILE LOGGER][LOGGER] Starting file logger service');

		await this.validateAndPrepareDir().catch((err: Error) => {
			this.logger.error(`[ROTATING FILE LOGGER][LOGGER] Rotating file logger disabled: ${err?.message ?? err}`);

			this.dir = undefined;
			this.state = 'error';
		});

		if (this.dir) {
			this.registerCleanupJob();
			this.state = 'started';
		}
	}

	/**
	 * Stop the service gracefully.
	 * Called by PluginServiceManagerService when the plugin is disabled or app shuts down.
	 */
	stop(): Promise<void> {
		if (this.state === 'stopped' || this.state === 'stopping') {
			return Promise.resolve();
		}

		this.state = 'stopping';

		this.logger.log('[ROTATING FILE LOGGER][LOGGER] Stopping file logger service');

		this.unregisterCleanupJob();

		this.dir = undefined;

		this.state = 'stopped';

		return Promise.resolve();
	}

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Handle configuration changes without full restart.
	 * Called by PluginServiceManagerService when config updates occur.
	 */
	onConfigChanged(): Promise<void> {
		// Clear cached config so next access gets fresh values
		this.pluginConfig = null;

		return Promise.resolve();
	}

	async append(obj: unknown): Promise<void> {
		if (this.state !== 'started' || !this.dir) {
			return;
		}

		try {
			const file = this.currentName();

			await fs.appendFile(file, JSON.stringify(obj) + '\n', 'utf8');
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ROTATING FILE LOGGER][LOGGER] Failed to append log: ${err?.message ?? err}`);
		}
	}

	private currentName(date = new Date()) {
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');

		return path.join(this.dir, `${this.filePrefix}-${yyyy}-${mm}-${dd}.log`);
	}

	private async validateAndPrepareDir(): Promise<void> {
		const raw =
			this.config.dir && this.config.dir.trim().length > 0
				? this.config.dir
				: path.resolve(__dirname, '../../../../../../logs');

		const absolute = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);

		await fs.mkdir(absolute, { recursive: true });

		const st = await fs.stat(absolute);

		if (!st.isDirectory()) {
			throw new LoggerRotatingFileException(`Path is not a directory: ${absolute}`);
		}

		const probe = path.join(absolute, '.write-probe');

		await fs.writeFile(probe, 'ok', 'utf8');
		await fs.rm(probe).catch(() => void 0);

		this.dir = absolute;
	}

	private get filePrefix(): string {
		return this.config.filePrefix || 'smart-panel';
	}

	private get config(): RotatingFileConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<RotatingFileConfigModel>(LOGGER_ROTATING_FILE_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	private registerCleanupJob() {
		const expr = this.config.cleanupCron ?? '15 3 * * *';
		const name = `${LOGGER_ROTATING_FILE_PLUGIN_NAME}:cleanup`;

		if (!this.dir) {
			this.unregisterCleanupJob();

			return;
		}

		try {
			if (this.scheduler.doesExist('cron', name)) {
				this.scheduler.deleteCronJob(name);
			}

			const job = new CronJob(expr, () =>
				this.cleanup().catch((err: Error) => {
					this.logger.error(`[ROTATING FILE LOGGER][LOGGER] Cleanup failed: ${err?.message ?? err}`);
				}),
			);

			this.scheduler.addCronJob(name, job);

			job.start();
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ROTATING FILE LOGGER][LOGGER] Failed to register cleanup cron "${expr}": ${err?.message ?? err}`,
			);
		}
	}

	private unregisterCleanupJob(): void {
		const name = `${LOGGER_ROTATING_FILE_PLUGIN_NAME}:cleanup`;

		try {
			if (this.scheduler.doesExist('cron', name)) {
				this.scheduler.deleteCronJob(name);
			}
		} catch {
			/* ignore */
		}
	}

	public async cleanup(): Promise<void> {
		const cfg = this.config;

		if (this.state !== 'started' || !this.dir) {
			return;
		}

		const keepDays = cfg.retentionDays ?? 7;

		const cutoff = new Date();

		cutoff.setDate(cutoff.getDate() - keepDays);

		const dirents = await fs.readdir(this.dir, { withFileTypes: true });

		const prefix = `${this.filePrefix}-`;
		const suffix = '.log';

		for (const d of dirents) {
			if (!d.isFile()) {
				continue;
			}

			const name = d.name;

			if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
				continue;
			}

			const datePart = name.slice(prefix.length, name.length - suffix.length); // "2025-10-20"
			const dt = new Date(datePart + 'T00:00:00Z');

			if (Number.isNaN(dt.getTime())) {
				continue;
			}

			if (dt < cutoff) {
				const full = path.join(this.dir, name);

				await fs.rm(full).catch((err: Error) => {
					this.logger.warn(`[ROTATING FILE LOGGER][LOGGER] Failed to remove old log "${name}": ${err?.message ?? err}`);
				});
			}
		}
	}
}
