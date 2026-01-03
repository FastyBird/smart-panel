import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { UserEntity } from '../entities/users.entity';
import { EventType, USERS_MODULE_NAME } from '../users.constants';

@Injectable()
export class ModuleResetService {
	private readonly logger = createExtensionLogger(USERS_MODULE_NAME, 'ModuleResetService');

	constructor(
		@InjectRepository(UserEntity)
		private readonly usersRepository: Repository<UserEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.usersRepository.deleteAll();

			this.eventEmitter.emit(EventType.USER_RESET, null);

			this.logger.log('Module data were successfully reset');

			this.eventEmitter.emit(EventType.MODULE_RESET, null);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to reset module data', { message: err.message, stack: err.stack });

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}
}
