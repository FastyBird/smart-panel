import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { DisplayInstanceEntity, UserEntity } from '../entities/users.entity';
import { EventType } from '../users.constants';

@Injectable()
export class ModuleResetService {
	private readonly logger = new Logger(ModuleResetService.name);

	constructor(
		@InjectRepository(UserEntity)
		private readonly usersRepository: Repository<UserEntity>,
		@InjectRepository(DisplayInstanceEntity)
		private readonly displaysRepository: Repository<DisplayInstanceEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			this.logger.debug(`[RESET] Resetting all module data`);

			await this.displaysRepository.deleteAll();

			this.eventEmitter.emit(EventType.DISPLAY_INSTANCE_RESET, null);

			await this.usersRepository.deleteAll();

			this.eventEmitter.emit(EventType.USER_RESET, null);

			this.logger.log('[RESET] Module data were successfully reset');

			this.eventEmitter.emit(EventType.MODULE_RESET, null);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error('[RESET] Failed to reset module data', { message: err.message, stack: err.stack });

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}
}
