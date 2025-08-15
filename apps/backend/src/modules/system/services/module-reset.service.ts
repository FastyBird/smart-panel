import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../users/users.constants';
import { DisplayProfileEntity } from '../entities/system.entity';

@Injectable()
export class ModuleResetService {
	private readonly logger = new Logger(ModuleResetService.name);

	constructor(
		@InjectRepository(DisplayProfileEntity)
		private readonly displaysRepository: Repository<DisplayProfileEntity>,
		private readonly configService: NestConfigService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			this.logger.debug(`[RESET] Resetting all module data`);

			const secureStoragePath = getEnvValue<string>(this.configService, 'FB_SECURE_STORAGE_PATH', '/var/smart-panel');

			const resolvedPath = resolve(secureStoragePath);

			if (!existsSync(resolvedPath)) {
				this.logger.warn(`[RESET] Secure storage folder does not exist: ${resolvedPath}`);

				return Promise.resolve({ success: true });
			}

			const files = readdirSync(resolvedPath);

			for (const file of files) {
				const filePath = join(resolvedPath, file);

				if (statSync(filePath).isFile()) {
					unlinkSync(filePath);
					this.logger.debug(`[RESET] Removed secure file: ${file}`);
				}
			}

			await this.displaysRepository.deleteAll();

			this.eventEmitter.emit(EventType.DISPLAY_INSTANCE_RESET, null);

			this.logger.log('[RESET] Module data were successfully reset');

			return Promise.resolve({ success: true });
		} catch (error) {
			const err = error as Error;

			this.logger.error('[RESET] Failed to reset module data', { message: err.message, stack: err.stack });

			return Promise.resolve({ success: false, reason: error instanceof Error ? error.message : 'Unknown error' });
		}
	}
}
