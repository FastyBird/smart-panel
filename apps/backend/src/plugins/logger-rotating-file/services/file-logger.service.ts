import { CronJob } from 'cron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ILogger } from '../../../modules/system/logger/logger';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';
import { LoggerRotatingFileException } from '../logger-rotating-file.exceptions';
import { RotatingFileLoggerConfigModel } from '../models/config.model';

@Injectable()
export class FileLoggerService implements ILogger {
	private readonly logger = new Logger(FileLoggerService.name);

	private dir: string | undefined;

	private pluginConfig: RotatingFileLoggerConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly scheduler: SchedulerRegistry,
	) {}

	public async initialize(): Promise<void> {
		if (this.config.enabled) {
			await this.validateAndPrepareDir().catch((err: Error) => {
				this.logger.error(`[ROTATING FILE LOGGER][LOGGER] Rotating file logger disabled: ${err?.message ?? err}`);

				this.dir = undefined;
			});

			this.registerCleanupJob();
		} else {
			this.unregisterCleanupJob();

			this.dir = undefined;
		}
	}

	async append(obj: unknown): Promise<void> {
		if (!this.config.enabled || !this.dir) {
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

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	async handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;

		await this.initialize();
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

	private get config(): RotatingFileLoggerConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<RotatingFileLoggerConfigModel>(
				LOGGER_ROTATING_FILE_PLUGIN_NAME,
			);
		}

		return this.pluginConfig;
	}

	private registerCleanupJob() {
		const expr = this.config.cleanupCron ?? '15 3 * * *';
		const name = `${LOGGER_ROTATING_FILE_PLUGIN_NAME}:cleanup`;

		if (!this.config.enabled || !this.dir) {
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

		if (!cfg.enabled || !this.dir) {
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
