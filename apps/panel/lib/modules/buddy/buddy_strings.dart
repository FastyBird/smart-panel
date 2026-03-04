/// User-facing strings for the buddy module.
///
/// Centralised here for consistency and future localisation.
class BuddyStrings {
	BuddyStrings._();

	// Suggestion card
	static const dismiss = 'Dismiss';
	static const apply = 'Apply';
	static const gotIt = 'Got it';

	// Chat page — empty / error states
	static const emptyStateMessage = 'Ask me anything about your home!';
	static const initFailedMessage = 'Could not start a conversation';
	static const retry = 'Retry';
	static const providerNotConfiguredTitle = 'AI provider not configured';
	static const providerNotConfiguredDescription =
		'Configure an AI provider in admin settings to enable chat.';
	static const thinking = 'Thinking...';

	// Chat page — input hints
	static const hintProviderNotConfigured = 'AI provider not configured';
	static const hintInitFailed = 'Failed to start conversation';
	static const hintStartingConversation = 'Starting conversation...';
	static const hintDefault = 'Ask about your home...';
}
