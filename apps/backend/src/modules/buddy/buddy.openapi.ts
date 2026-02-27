/**
 * OpenAPI extra models for Buddy module
 */
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';

export const BUDDY_SWAGGER_EXTRA_MODELS = [
	// Entity models
	BuddyConversationEntity,
	BuddyMessageEntity,
];
