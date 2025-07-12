import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';

@Injectable()
export class ModuleResetService {
	private readonly logger = new Logger(ModuleResetService.name);

	constructor(private readonly configService: NestConfigService) {}

	reset(): Promise<{ success: boolean; reason?: string }> {
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

			this.logger.log('[RESET] Module data were successfully reset');

			return Promise.resolve({ success: true });
		} catch (error) {
			const err = error as Error;

			this.logger.error('[RESET] Failed to reset module data', { message: err.message, stack: err.stack });

			return Promise.resolve({ success: false, reason: error instanceof Error ? error.message : 'Unknown error' });
		}
	}
}
