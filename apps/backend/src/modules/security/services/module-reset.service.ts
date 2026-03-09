import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SECURITY_MODULE_NAME } from '../security.constants';

@Injectable()
export class SecurityModuleResetService {
	private readonly logger = createExtensionLogger(SECURITY_MODULE_NAME, 'SecurityModuleResetService');

	constructor(
		@InjectRepository(SecurityAlertAckEntity)
		private readonly alertAcksRepository: Repository<SecurityAlertAckEntity>,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting security module factory reset');

		try {
			await this.alertAcksRepository.clear();

			this.logger.log('[RESET] Security module factory reset completed successfully');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Security module factory reset failed: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
