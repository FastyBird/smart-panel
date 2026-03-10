import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

@Injectable()
export class BuddyModuleResetService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyModuleResetService');

	constructor(
		@InjectRepository(BuddyMessageEntity)
		private readonly messagesRepository: Repository<BuddyMessageEntity>,
		@InjectRepository(BuddyConversationEntity)
		private readonly conversationsRepository: Repository<BuddyConversationEntity>,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting buddy module factory reset');

		try {
			// Delete messages first (foreign key to conversations)
			await this.messagesRepository.clear();
			await this.conversationsRepository.clear();

			this.logger.log('[RESET] Buddy module factory reset completed successfully');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Buddy module factory reset failed: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
