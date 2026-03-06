/**
 * OpenAPI extra models for Buddy module
 */
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { BuddyConfigModel } from './models/config.model';
import { ConversationResponseModel, ConversationsResponseModel } from './models/conversation-response.model';
import { MessageResponseModel, MessagesResponseModel } from './models/message-response.model';
import { ProviderStatusDataModel, ProviderStatusesResponseModel } from './models/provider-status.model';
import {
	SuggestionDataModel,
	SuggestionFeedbackResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionResponseModel,
	SuggestionsResponseModel,
} from './models/suggestion-response.model';
import {
	SttProviderStatusesResponseModel,
	TtsProviderStatusesResponseModel,
	VoiceProviderStatusDataModel,
} from './models/voice-provider-status.model';

export const BUDDY_SWAGGER_EXTRA_MODELS = [
	// Entities
	BuddyConversationEntity,
	BuddyMessageEntity,
	// Config model
	BuddyConfigModel,
	// Response models
	ConversationResponseModel,
	ConversationsResponseModel,
	MessageResponseModel,
	MessagesResponseModel,
	ProviderStatusDataModel,
	ProviderStatusesResponseModel,
	VoiceProviderStatusDataModel,
	SttProviderStatusesResponseModel,
	TtsProviderStatusesResponseModel,
	SuggestionDataModel,
	SuggestionResponseModel,
	SuggestionsResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionFeedbackResponseModel,
];
