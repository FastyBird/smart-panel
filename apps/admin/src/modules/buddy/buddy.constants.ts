export const BUDDY_MODULE_PREFIX = 'buddy';

export const BUDDY_MODULE_NAME = 'buddy-module';

export const BUDDY_MODULE_EVENT_PREFIX = 'BuddyModule.';

export enum EventType {
	SUGGESTION_CREATED = 'BuddyModule.Suggestion.Created',
	CONVERSATION_MESSAGE_RECEIVED = 'BuddyModule.Conversation.MessageReceived',
}

export enum RouteNames {
	BUDDY = 'buddy_module-chat',
}

export const LLM_PROVIDER_NONE = 'none';

export const TTS_PLUGIN_NONE = 'none';

export const STT_PLUGIN_NONE = 'none';
