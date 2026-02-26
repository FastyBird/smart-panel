export const BUDDY_MODULE_PREFIX = 'buddy';

export const BUDDY_MODULE_NAME = 'buddy-module';

export const BUDDY_MODULE_API_TAG_NAME = 'Buddy module';

export const BUDDY_MODULE_API_TAG_DESCRIPTION =
	'AI assistant module providing text chat, context-aware suggestions, and proactive home automation insights.';

export enum EventType {
	SUGGESTION_CREATED = 'BuddyModule.Suggestion.Created',
	CONVERSATION_MESSAGE_RECEIVED = 'BuddyModule.Conversation.MessageReceived',
}

export enum LlmProvider {
	CLAUDE = 'claude',
	OPENAI = 'openai',
	OLLAMA = 'ollama',
	NONE = 'none',
}

export enum MessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	SYSTEM = 'system',
}

export const ACTION_OBSERVER_BUFFER_SIZE = 200;
