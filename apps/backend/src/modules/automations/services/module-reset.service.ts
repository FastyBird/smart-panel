import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { AUTOMATIONS_MODULE_NAME, EventType } from '../automations.constants';
import { AutomationRunEntity } from '../entities/automation-runs.entity';
import { AutomationEntity } from '../entities/automations.entity';

@Injectable()
export class AutomationsModuleResetService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationsModuleResetService');

	constructor(
		@InjectRepository(AutomationEntity)
		private readonly automationsRepository: Repository<AutomationEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting automations module factory reset');

		try {
			const automationsCount = await this.automationsRepository.count();
			// One transaction: should the automations not go, their run history stays as well
			await this.automationsRepository.manager.transaction(async (manager) => {
				// The run history goes first: it belongs to the automations
				await manager.clear(AutomationRunEntity);
				await manager.clear(AutomationEntity);
			});

			this.logger.log('[RESET] Automations module factory reset completed successfully');

			this.eventEmitter.emit(EventType.MODULE_RESET, {
				automationsDeleted: automationsCount,
			});

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Automations module factory reset failed: ${err.message}`);

			return {
				success: false,
				reason: err.message,
			};
		}
	}
}
