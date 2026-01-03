import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { CardEntity } from '../entities/pages-cards.entity';
import { EventType, PAGES_CARDS_PLUGIN_NAME } from '../pages-cards.constants';

@Injectable()
export class PluginResetService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		PAGES_CARDS_PLUGIN_NAME,
		'PluginResetService',
	);

	constructor(
		@InjectRepository(CardEntity)
		private readonly cardsRepository: Repository<CardEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.cardsRepository.deleteAll();

			this.eventEmitter.emit(EventType.CARD_RESET, null);

			this.logger.log('[PAGES CARDS][RESET SERVICE] Plugin data were successfully reset');

			this.eventEmitter.emit(EventType.PLUGIN_RESET, null);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error('[PAGES CARDS][RESET SERVICE] Failed to reset plugin data', {
				message: err.message,
				stack: err.stack,
			});

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}
}
