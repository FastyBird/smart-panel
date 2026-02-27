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

export enum SuggestionType {
	PATTERN_SCENE_CREATE = 'pattern_scene_create',
	LIGHTING_OPTIMISE = 'lighting_optimise',
	GENERAL_TIP = 'general_tip',
}

export enum SuggestionFeedback {
	APPLIED = 'applied',
	DISMISSED = 'dismissed',
}

export const ACTION_OBSERVER_BUFFER_SIZE = 200;

export const SUGGESTION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

export const SUGGESTION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const SUGGESTION_CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

export const PATTERN_MIN_OCCURRENCES = 3;

export const PATTERN_TIME_WINDOW_MINUTES = 60;

export const PATTERN_LOOKBACK_DAYS = 7;
