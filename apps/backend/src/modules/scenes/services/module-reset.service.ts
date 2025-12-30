import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { SceneActionEntity, SceneConditionEntity, SceneEntity, SceneTriggerEntity } from '../entities/scenes.entity';
import { EventType } from '../scenes.constants';

@Injectable()
export class ScenesModuleResetService {
	private readonly logger = new Logger(ScenesModuleResetService.name);

	constructor(
		@InjectRepository(SceneEntity)
		private readonly scenesRepository: Repository<SceneEntity>,
		@InjectRepository(SceneActionEntity)
		private readonly actionsRepository: Repository<SceneActionEntity>,
		@InjectRepository(SceneConditionEntity)
		private readonly conditionsRepository: Repository<SceneConditionEntity>,
		@InjectRepository(SceneTriggerEntity)
		private readonly triggersRepository: Repository<SceneTriggerEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting scenes module factory reset');

		try {
			// Delete in order: triggers, conditions, actions, then scenes (due to foreign keys)
			const triggersCount = await this.triggersRepository.count();
			await this.triggersRepository.clear();
			this.logger.debug(`[RESET] Deleted ${triggersCount} scene triggers`);

			const conditionsCount = await this.conditionsRepository.count();
			await this.conditionsRepository.clear();
			this.logger.debug(`[RESET] Deleted ${conditionsCount} scene conditions`);

			const actionsCount = await this.actionsRepository.count();
			await this.actionsRepository.clear();
			this.logger.debug(`[RESET] Deleted ${actionsCount} scene actions`);

			const scenesCount = await this.scenesRepository.count();
			await this.scenesRepository.clear();
			this.logger.debug(`[RESET] Deleted ${scenesCount} scenes`);

			this.logger.log('[RESET] Scenes module factory reset completed successfully');

			this.eventEmitter.emit(EventType.MODULE_RESET, {
				scenesDeleted: scenesCount,
				actionsDeleted: actionsCount,
				conditionsDeleted: conditionsCount,
				triggersDeleted: triggersCount,
			});

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Scenes module factory reset failed: ${err.message}`);

			return {
				success: false,
				reason: err.message,
			};
		}
	}
}
