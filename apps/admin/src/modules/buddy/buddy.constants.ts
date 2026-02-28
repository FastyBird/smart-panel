export const BUDDY_MODULE_PREFIX = 'buddy';

export const BUDDY_MODULE_NAME = 'buddy-module';

export const BUDDY_MODULE_EVENT_PREFIX = 'BuddyModule.';

export enum EventType {
	SUGGESTION_CREATED = 'BuddyModule.Suggestion.Created',
	CONVERSATION_MESSAGE_RECEIVED = 'BuddyModule.Conversation.MessageReceived',
}

export enum RouteNames {
	BUDDY_SETTINGS = 'buddy_module-settings',
}

export enum LlmProvider {
	CLAUDE = 'claude',
	OPENAI = 'openai',
	OLLAMA = 'ollama',
	NONE = 'none',
}
