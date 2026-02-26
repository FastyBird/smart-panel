/**
 * OpenAPI extra models for Buddy module
 */
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { BuddyConfigModel } from './models/config.model';

export const BUDDY_SWAGGER_EXTRA_MODELS = [
	// Entities
	BuddyConversationEntity,
	BuddyMessageEntity,
	// Config model
	BuddyConfigModel,
];
