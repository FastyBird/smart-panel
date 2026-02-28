class BuddyModuleConstants {
	// Module name
	static const String moduleName = 'buddy-module';

	// Socket event names
	static const String moduleWildcardEvent = 'BuddyModule.*';
	static const String suggestionCreatedEvent = 'BuddyModule.Suggestion.Created';
	static const String conversationMessageReceivedEvent = 'BuddyModule.Conversation.MessageReceived';

	// API paths
	static const String conversationsPath = '/modules/buddy/conversations';
	static const String suggestionsPath = '/modules/buddy/suggestions';
}
