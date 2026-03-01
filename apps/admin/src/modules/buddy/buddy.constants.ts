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

export const LLM_PROVIDER_NONE = 'none';

/**
 * Maps legacy enum-based provider values (from pre-plugin configs)
 * to the new plugin-based provider names.
 */
export const LEGACY_PROVIDER_MAP = new Map<string, string>([
	['claude', 'buddy-claude-plugin'],
	['openai', 'buddy-openai-plugin'],
	['ollama', 'buddy-ollama-plugin'],
]);
