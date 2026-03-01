import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/buddy/models/conversation.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';

/// Service that provides a single source of truth for buddy state.
///
/// Proxies the [BuddyRepository] and provides convenience methods
/// for the presentation layer.
class BuddyService extends ChangeNotifier {
	final BuddyRepository _buddyRepository;

	Timer? _updateDebounce;

	BuddyService({
		required BuddyRepository buddyRepository,
	}) : _buddyRepository = buddyRepository;

	Future<void> initialize() async {
		_buddyRepository.addListener(_scheduleUpdate);

		// Fetch initial suggestions
		await _buddyRepository.fetchSuggestions();
	}

	// ============================================
	// CONVERSATION ACCESSORS
	// ============================================

	List<BuddyConversationModel> get conversations => _buddyRepository.conversations;
	List<BuddyMessageModel> get messages => _buddyRepository.messages;
	String? get activeConversationId => _buddyRepository.activeConversationId;

	bool get isLoadingConversations => _buddyRepository.isLoadingConversations;
	bool get isLoadingMessages => _buddyRepository.isLoadingMessages;
	bool get isSendingMessage => _buddyRepository.isSendingMessage;

	bool get hasActiveConversation => _buddyRepository.activeConversationId != null;

	// ============================================
	// SUGGESTION ACCESSORS
	// ============================================

	List<BuddySuggestionModel> get suggestions => _buddyRepository.suggestions;
	int get suggestionCount => _buddyRepository.suggestionCount;
	bool get hasSuggestions => _buddyRepository.suggestionCount > 0;
	bool get isLoadingSuggestions => _buddyRepository.isLoadingSuggestions;

	// ============================================
	// ERROR ACCESSORS
	// ============================================

	String? get error => _buddyRepository.error;
	bool get hasError => _buddyRepository.error != null;

	bool get isProviderNotConfigured => _buddyRepository.isProviderNotConfigured;
	bool get isSttNotConfigured => _buddyRepository.isSttNotConfigured;

	// ============================================
	// CONVERSATION ACTIONS
	// ============================================

	/// Start a new chat conversation
	Future<BuddyConversationModel?> startNewConversation({
		String? title,
		String? spaceId,
	}) async {
		final conversation = await _buddyRepository.createConversation(
			title: title,
			spaceId: spaceId,
		);

		if (conversation != null) {
			await _buddyRepository.fetchConversationMessages(conversation.id);
		}

		return conversation;
	}

	/// Open an existing conversation
	Future<void> openConversation(String conversationId) async {
		await _buddyRepository.fetchConversationMessages(conversationId);
	}

	/// Send a message in the active conversation
	Future<BuddyMessageModel?> sendMessage(String content) async {
		final conversationId = _buddyRepository.activeConversationId;

		if (conversationId == null) return null;

		return _buddyRepository.sendMessage(conversationId, content);
	}

	/// Send an audio message in the active conversation
	Future<BuddyMessageModel?> sendAudioMessage(
		Uint8List audioBytes,
		String mimeType,
	) async {
		final conversationId = _buddyRepository.activeConversationId;

		if (conversationId == null) return null;

		return _buddyRepository.sendAudioMessage(
			conversationId,
			audioBytes,
			mimeType,
		);
	}

	/// Delete a conversation
	Future<bool> deleteConversation(String conversationId) async {
		return _buddyRepository.deleteConversation(conversationId);
	}

	/// Close the active conversation
	void closeConversation() {
		_buddyRepository.clearActiveConversation();
	}

	/// Refresh conversations list
	Future<void> refreshConversations() async {
		await _buddyRepository.fetchConversations();
	}

	// ============================================
	// SUGGESTION ACTIONS
	// ============================================

	/// Accept a suggestion
	Future<bool> acceptSuggestion(String suggestionId) async {
		return _buddyRepository.submitSuggestionFeedback(
			suggestionId,
			'applied',
		);
	}

	/// Dismiss a suggestion
	Future<bool> dismissSuggestion(String suggestionId) async {
		return _buddyRepository.submitSuggestionFeedback(
			suggestionId,
			'dismissed',
		);
	}

	/// Remove a suggestion from the local list after its exit animation
	/// has completed.
	void removeSuggestion(String suggestionId) {
		_buddyRepository.removeSuggestion(suggestionId);
	}

	/// Refresh suggestions
	Future<void> refreshSuggestions({String? spaceId}) async {
		await _buddyRepository.fetchSuggestions(spaceId: spaceId);
	}

	// ============================================
	// ERROR HANDLING
	// ============================================

	/// Clear any error state
	void clearError() {
		_buddyRepository.clearError();
	}

	// ============================================
	// INTERNAL
	// ============================================

	void _scheduleUpdate() {
		_updateDebounce?.cancel();
		_updateDebounce = Timer(const Duration(milliseconds: 50), () {
			notifyListeners();
		});
	}

	@override
	void dispose() {
		_updateDebounce?.cancel();
		_buddyRepository.removeListener(_scheduleUpdate);
		super.dispose();
	}
}
