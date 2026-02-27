/**
 * OpenAPI extra models for Buddy module
 */
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { ConversationResponseModel, ConversationsResponseModel } from './models/conversation-response.model';
import { MessageResponseModel } from './models/message-response.model';

export const BUDDY_SWAGGER_EXTRA_MODELS = [
	// Response models
	ConversationResponseModel,
	ConversationsResponseModel,
	MessageResponseModel,
	// Entity models
	BuddyConversationEntity,
	BuddyMessageEntity,
];
