import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/buddy/constants.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/conversation.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';

/// Repository for managing buddy module data.
///
/// Handles API calls to backend buddy endpoints and processes
/// WebSocket events for real-time updates.
class BuddyRepository extends ChangeNotifier {
	final Dio _dio;

	/// All conversations
	List<BuddyConversationModel> _conversations = [];

	/// Messages for the active conversation
	List<BuddyMessageModel> _messages = [];

	/// Active conversation ID
	String? _activeConversationId;

	/// Active suggestions
	List<BuddySuggestionModel> _suggestions = [];

	/// Loading states
	bool _isLoadingConversations = false;
	bool _isLoadingMessages = false;
	bool _isSendingMessage = false;
	bool _isLoadingSuggestions = false;

	/// Error state
	String? _error;

	BuddyRepository({
		required Dio dio,
	}) : _dio = dio;

	// ============================================
	// GETTERS
	// ============================================

	List<BuddyConversationModel> get conversations => _conversations;
	List<BuddyMessageModel> get messages => _messages;
	String? get activeConversationId => _activeConversationId;
	List<BuddySuggestionModel> get suggestions => _suggestions;
	int get suggestionCount => _suggestions.length;

	bool get isLoadingConversations => _isLoadingConversations;
	bool get isLoadingMessages => _isLoadingMessages;
	bool get isSendingMessage => _isSendingMessage;
	bool get isLoadingSuggestions => _isLoadingSuggestions;
	String? get error => _error;

	// ============================================
	// CONVERSATIONS API
	// ============================================

	/// Fetch all conversations
	Future<void> fetchConversations() async {
		_isLoadingConversations = true;
		_error = null;
		notifyListeners();

		try {
			final response = await _dio.get(
				BuddyModuleConstants.conversationsPath,
			);

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data['data'];

				if (data is List) {
					_conversations = data
						.map((json) => BuddyConversationModel.fromJson(
							json as Map<String, dynamic>,
						))
						.toList();
				}
			}
		} on DioException catch (e) {
			_error = _parseError(e);

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error fetching conversations: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			_error = 'Failed to load conversations';

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error fetching conversations: $e');
			}
		} finally {
			_isLoadingConversations = false;
			notifyListeners();
		}
	}

	/// Create a new conversation
	Future<BuddyConversationModel?> createConversation({
		String? title,
		String? spaceId,
	}) async {
		_error = null;

		try {
			final body = <String, dynamic>{};

			if (title != null) body['title'] = title;
			if (spaceId != null) body['space_id'] = spaceId;

			final response = await _dio.post(
				BuddyModuleConstants.conversationsPath,
				data: body,
			);

			if (response.statusCode == 201 && response.data != null) {
				final data = response.data['data'];

				if (data is Map<String, dynamic>) {
					final conversation = BuddyConversationModel.fromJson(data);
					_conversations.insert(0, conversation);
					notifyListeners();

					return conversation;
				}
			}
		} on DioException catch (e) {
			_error = _parseError(e);

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error creating conversation: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			_error = 'Failed to create conversation';

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error creating conversation: $e');
			}
		}

		notifyListeners();

		return null;
	}

	/// Get conversation with messages
	Future<void> fetchConversationMessages(String conversationId) async {
		_isLoadingMessages = true;
		_activeConversationId = conversationId;
		_error = null;
		notifyListeners();

		try {
			final response = await _dio.get(
				'${BuddyModuleConstants.conversationsPath}/$conversationId/messages',
			);

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data['data'];

				if (data is List) {
					_messages = data
						.map((json) => BuddyMessageModel.fromJson(
							json as Map<String, dynamic>,
						))
						.toList();
				}
			}
		} on DioException catch (e) {
			_error = _parseError(e);

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error fetching messages: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			_error = 'Failed to load messages';

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error fetching messages: $e');
			}
		} finally {
			_isLoadingMessages = false;
			notifyListeners();
		}
	}

	/// Send a message and get AI response
	Future<BuddyMessageModel?> sendMessage(
		String conversationId,
		String content,
	) async {
		_isSendingMessage = true;
		_error = null;

		// Add user message immediately for optimistic UI
		final userMessage = BuddyMessageModel(
			id: 'pending_${DateTime.now().millisecondsSinceEpoch}',
			conversationId: conversationId,
			role: BuddyMessageRole.user,
			content: content,
			createdAt: DateTime.now(),
		);
		_messages.add(userMessage);
		notifyListeners();

		try {
			final response = await _dio.post(
				'${BuddyModuleConstants.conversationsPath}/$conversationId/messages',
				data: {'content': content},
			);

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data['data'];

				if (data is Map<String, dynamic>) {
					final assistantMessage = BuddyMessageModel.fromJson(data);

					// Replace pending user message with server version by refreshing
					await fetchConversationMessages(conversationId);

					return assistantMessage;
				}
			}

			// Non-200 status or unexpected data shape — reconcile by refreshing
			// from the server so the optimistic pending_* message is replaced.
			await fetchConversationMessages(conversationId);
		} on DioException catch (e) {
			_error = _parseError(e);

			// Remove the optimistic user message on error
			_messages.removeWhere((m) => m.id == userMessage.id);

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error sending message: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			_error = 'Failed to send message';

			// Remove the optimistic user message on error
			_messages.removeWhere((m) => m.id == userMessage.id);

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error sending message: $e');
			}
		} finally {
			_isSendingMessage = false;
			notifyListeners();
		}

		return null;
	}

	/// Delete a conversation
	Future<bool> deleteConversation(String conversationId) async {
		try {
			final response = await _dio.delete(
				'${BuddyModuleConstants.conversationsPath}/$conversationId',
			);

			if (response.statusCode == 204 || response.statusCode == 200) {
				_conversations.removeWhere((c) => c.id == conversationId);

				if (_activeConversationId == conversationId) {
					_activeConversationId = null;
					_messages = [];
				}

				notifyListeners();

				return true;
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error deleting conversation: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error deleting conversation: $e');
			}
		}

		return false;
	}

	// ============================================
	// SUGGESTIONS API
	// ============================================

	/// Fetch active suggestions
	Future<void> fetchSuggestions({String? spaceId}) async {
		_isLoadingSuggestions = true;
		notifyListeners();

		try {
			final queryParams = <String, dynamic>{};

			if (spaceId != null) queryParams['space_id'] = spaceId;

			final response = await _dio.get(
				BuddyModuleConstants.suggestionsPath,
				queryParameters: queryParams.isNotEmpty ? queryParams : null,
			);

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data['data'];

				if (data is List) {
					_suggestions = data
						.map((json) => BuddySuggestionModel.fromJson(
							json as Map<String, dynamic>,
						))
						.toList();
				}
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error fetching suggestions: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error fetching suggestions: $e');
			}
		} finally {
			_isLoadingSuggestions = false;
			notifyListeners();
		}
	}

	/// Submit feedback for a suggestion.
	///
	/// Returns `true` when the API call succeeds. The suggestion is NOT
	/// removed from [_suggestions] here — call [removeSuggestion] after
	/// the exit animation completes to avoid the widget being ripped out
	/// of the tree mid-animation.
	Future<bool> submitSuggestionFeedback(
		String suggestionId,
		String feedback,
	) async {
		try {
			final response = await _dio.post(
				'${BuddyModuleConstants.suggestionsPath}/$suggestionId/feedback',
				data: {'feedback': feedback},
			);

			if (response.statusCode == 200) {
				return true;
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error submitting feedback: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error submitting feedback: $e');
			}
		}

		return false;
	}

	/// Remove a suggestion from the local list after the UI exit animation
	/// has completed.
	void removeSuggestion(String suggestionId) {
		_suggestions.removeWhere((s) => s.id == suggestionId);
		notifyListeners();
	}

	// ============================================
	// WEBSOCKET EVENT HANDLERS
	// ============================================

	/// Handle a WebSocket event from the buddy module
	void handleSocketEvent(String event, Map<String, dynamic> payload) {
		if (event == BuddyModuleConstants.suggestionCreatedEvent) {
			_handleSuggestionCreated(payload);
		} else if (event == BuddyModuleConstants.conversationMessageReceivedEvent) {
			_handleMessageReceived(payload);
		}
	}

	void _handleSuggestionCreated(Map<String, dynamic> payload) {
		try {
			final suggestion = BuddySuggestionModel.fromJson(payload);

			// Avoid duplicates
			if (!_suggestions.any((s) => s.id == suggestion.id)) {
				_suggestions.add(suggestion);
				notifyListeners();
			}

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Suggestion created via WebSocket: ${suggestion.id}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Failed to parse suggestion event: $e',
				);
			}
		}
	}

	void _handleMessageReceived(Map<String, dynamic> payload) {
		try {
			final conversationId = payload['conversation_id'] as String?;

			// Only add if it's for the active conversation
			if (conversationId != null && conversationId == _activeConversationId) {
				final message = BuddyMessageModel(
					id: payload['message_id'] as String? ?? '',
					conversationId: conversationId,
					role: BuddyMessageRole.fromString(payload['role'] as String? ?? 'assistant'),
					content: payload['content'] as String? ?? '',
					createdAt: DateTime.now(),
				);

				// Avoid duplicates
				if (!_messages.any((m) => m.id == message.id)) {
					_messages.add(message);
					notifyListeners();
				}
			}

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Message received via WebSocket for conversation: $conversationId',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Failed to parse message event: $e',
				);
			}
		}
	}

	// ============================================
	// HELPERS
	// ============================================

	/// Clear error state
	void clearError() {
		_error = null;
		notifyListeners();
	}

	/// Clear active conversation
	void clearActiveConversation() {
		_activeConversationId = null;
		_messages = [];
		notifyListeners();
	}

	String _parseError(DioException e) {
		if (e.response?.statusCode == 503) {
			return 'AI provider not configured';
		}

		if (e.type == DioExceptionType.connectionTimeout ||
			e.type == DioExceptionType.receiveTimeout) {
			return 'Request timed out. Please try again.';
		}

		if (e.type == DioExceptionType.connectionError) {
			return 'Connection error. Please check your network.';
		}

		return 'Something went wrong. Please try again.';
	}
}
