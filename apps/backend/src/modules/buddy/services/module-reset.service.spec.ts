import { Repository } from 'typeorm';

import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';
import { BuddySuggestionEntity } from '../entities/buddy-suggestion.entity';

import { BuddyModuleResetService } from './module-reset.service';

describe('BuddyModuleResetService scoped references', () => {
	it('clears scoped action references after persistent Buddy state is cleared', async () => {
		const messages = { clear: jest.fn().mockResolvedValue(undefined) };
		const conversations = { clear: jest.fn().mockResolvedValue(undefined) };
		const suggestions = { clear: jest.fn().mockResolvedValue(undefined) };
		const shortIdMapping = { clearAllScopes: jest.fn() };
		const service = new BuddyModuleResetService(
			messages as unknown as Repository<BuddyMessageEntity>,
			conversations as unknown as Repository<BuddyConversationEntity>,
			suggestions as unknown as Repository<BuddySuggestionEntity>,
			shortIdMapping as unknown as ShortIdMappingService,
		);

		await expect(service.reset()).resolves.toEqual({ success: true });
		expect(shortIdMapping.clearAllScopes).toHaveBeenCalledTimes(1);
	});

	it('clears scoped references before a persistent reset can fail', async () => {
		const resetFailure = new Error('database unavailable');
		const messages = { clear: jest.fn().mockRejectedValue(resetFailure) };
		const shortIdMapping = { clearAllScopes: jest.fn() };
		const service = new BuddyModuleResetService(
			messages as unknown as Repository<BuddyMessageEntity>,
			{ clear: jest.fn() } as unknown as Repository<BuddyConversationEntity>,
			{ clear: jest.fn() } as unknown as Repository<BuddySuggestionEntity>,
			shortIdMapping as unknown as ShortIdMappingService,
		);

		await expect(service.reset()).resolves.toEqual({ success: false, reason: resetFailure.message });
		expect(shortIdMapping.clearAllScopes).toHaveBeenCalledTimes(1);
	});
});
