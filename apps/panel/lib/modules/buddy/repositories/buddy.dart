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

	/// Callback invoked when a new suggestion arrives via WebSocket.
	/// Used by the notification service to show toast notifications.
	void Function(BuddySuggestionModel suggestion)? onSuggestionCreated;

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
	bool _isLoadingSuggestions = false;

	/// Number of in-flight sendMessage calls. The UI treats > 0 as "sending".
	int _activeSendCount = 0;

	/// Error state
	String? _error;

	/// Whether the last error was a 503 indicating no AI provider is configured.
	bool _isProviderNotConfigured = false;

	/// Whether the last audio error was a 503 indicating STT is not configured.
	bool _isSttNotConfigured = false;

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
	bool get isSendingMessage => _activeSendCount > 0;
	bool get isLoadingSuggestions => _isLoadingSuggestions;
	String? get error => _error;
	bool get isProviderNotConfigured => _isProviderNotConfigured;
	bool get isSttNotConfigured => _isSttNotConfigured;

	// ============================================
	// CONVERSATIONS API
	// ============================================

	/// Fetch all conversations
	Future<void> fetchConversations() async {
		_isLoadingConversations = true;
		_error = null;
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;
		notifyListeners();

		try {
			final response = await _dio.get(
				BuddyModuleConstants.conversationsPath,
			);

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
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
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;

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
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;
		notifyListeners();

		try {
			final response = await _dio.get(
				'${BuddyModuleConstants.conversationsPath}/$conversationId/messages',
			);

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
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
		_activeSendCount++;
		_error = null;
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;

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

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
				final data = response.data['data'];

				if (data is Map<String, dynamic>) {
					final assistantMessage = BuddyMessageModel.fromJson(data);

					// Add the assistant message to the local list immediately
					// so it's visible even if the subsequent refresh fails.
					_messages.add(assistantMessage);

					// Remove the optimistic user message — the server data
					// from reconciliation will contain the real version with
					// a server-assigned ID.
					_messages.removeWhere((m) => m.id == userMessage.id);

					// Decrement before reconciliation so the UI hides the
					// "Thinking…" indicator for this send while still showing
					// it if another send is in-flight.
					_activeSendCount--;
					notifyListeners();

					// Silently reconcile optimistic user message with server
					// state. This must NOT reset _error or toggle
					// _isLoadingMessages — a fetch failure here should not
					// overwrite the successful send context.
					await _reconcileMessages(conversationId);

					return assistantMessage;
				}
			}

			// Non-200 status or unexpected data shape — decrement and
			// reconcile from the server so the optimistic pending_*
			// message is replaced.
			_activeSendCount--;
			notifyListeners();

			await _reconcileMessages(conversationId);
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
			// Only decrement if we haven't already (error paths).
			// Success paths decrement before reconciliation above.
			if (_activeSendCount > 0 && _error != null) {
				_activeSendCount--;
			}
			notifyListeners();
		}

		return null;
	}

	/// Send an audio message — uploads audio, backend transcribes and responds.
	Future<BuddyMessageModel?> sendAudioMessage(
		String conversationId,
		Uint8List audioBytes,
		String mimeType,
	) async {
		_activeSendCount++;
		_error = null;
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;

		// Add optimistic "transcribing…" placeholder
		final userMessage = BuddyMessageModel(
			id: 'pending_audio_${DateTime.now().millisecondsSinceEpoch}',
			conversationId: conversationId,
			role: BuddyMessageRole.user,
			content: 'Transcribing audio...',
			createdAt: DateTime.now(),
		);
		_messages.add(userMessage);
		notifyListeners();

		try {
			final extension = _mimeToExtension(mimeType);

			final formData = FormData.fromMap({
				'audio': MultipartFile.fromBytes(
					audioBytes,
					filename: 'audio.$extension',
					contentType: DioMediaType.parse(mimeType),
				),
			});

			final response = await _dio.post(
				'${BuddyModuleConstants.conversationsPath}/$conversationId/audio',
				data: formData,
			);

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
				final data = response.data['data'];

				if (data is Map<String, dynamic>) {
					final assistantMessage = BuddyMessageModel.fromJson(data);

					_messages.add(assistantMessage);
					_messages.removeWhere((m) => m.id == userMessage.id);

					_activeSendCount--;
					notifyListeners();

					await _reconcileMessages(conversationId);

					return assistantMessage;
				}
			}

			_activeSendCount--;
			notifyListeners();

			await _reconcileMessages(conversationId);
		} on DioException catch (e) {
			_error = _parseAudioError(e);

			_messages.removeWhere((m) => m.id == userMessage.id);

			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error sending audio: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			_error = 'Failed to send audio message';

			_messages.removeWhere((m) => m.id == userMessage.id);

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error sending audio: $e');
			}
		} finally {
			if (_activeSendCount > 0 && _error != null) {
				_activeSendCount--;
			}
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

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
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
				onSuggestionCreated?.call(suggestion);
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
				final rawId = payload['message_id'] as String?;
				final hasServerId = rawId != null && rawId.isNotEmpty;
				final messageId = hasServerId
					? rawId
					: 'ws_${DateTime.now().millisecondsSinceEpoch}';

				final message = BuddyMessageModel(
					id: messageId,
					conversationId: conversationId,
					role: BuddyMessageRole.fromString(payload['role'] as String? ?? 'assistant'),
					content: payload['content'] as String? ?? '',
					createdAt: DateTime.now(),
				);

				// Only deduplicate when the server provided a real ID;
				// messages without an ID get a unique synthetic one above.
				final isDuplicate = hasServerId &&
					_messages.any((m) => m.id == message.id);

				if (!isDuplicate) {
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

	/// Silently refresh the message list from the server without touching
	/// [_error], [_isProviderNotConfigured], or [_isLoadingMessages].
	///
	/// Used after a successful [sendMessage] to reconcile the optimistic
	/// pending user message with the real server data. Failures are logged
	/// but never surface to the UI — the locally-added messages remain.
	///
	/// Any optimistic `pending_*` messages that were added by concurrent
	/// [sendMessage] calls are preserved and appended after the server data
	/// so they are not silently dropped.
	Future<void> _reconcileMessages(String conversationId) async {
		try {
			final response = await _dio.get(
				'${BuddyModuleConstants.conversationsPath}/$conversationId/messages',
			);

			if (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300 && response.data != null) {
				final data = response.data['data'];

				if (data is List) {
					// Collect any optimistic pending messages that are not
					// yet on the server so they survive the list replacement.
					final pendingMessages = _messages
						.where((m) => m.id.startsWith('pending_'))
						.toList();

					_messages = data
						.map((json) => BuddyMessageModel.fromJson(
							json as Map<String, dynamic>,
						))
						.toList();

					if (pendingMessages.isNotEmpty) {
						_messages.addAll(pendingMessages);
					}

					notifyListeners();
				}
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Silent message reconciliation failed: $e',
				);
			}
		}
	}

	/// Clear error state
	void clearError() {
		_error = null;
		_isProviderNotConfigured = false;
		_isSttNotConfigured = false;
		notifyListeners();
	}

	/// Clear active conversation
	void clearActiveConversation() {
		_activeConversationId = null;
		_messages = [];
		notifyListeners();
	}

	String _parseError(DioException e) {
		_isProviderNotConfigured = e.response?.statusCode == 503;

		if (_isProviderNotConfigured) {
			return 'AI provider not configured';
		}

		return _parseGenericError(e);
	}

	String _parseAudioError(DioException e) {
		if (e.response?.statusCode == 503) {
			// The audio endpoint can return 503 from either the STT provider
			// (transcription step) or the LLM provider (chat step). Inspect
			// the response message to distinguish between the two.
			final data = e.response?.data;
			final message = data is Map<String, dynamic> ? data['message'] as String? : null;
			final isLlmError = message != null && message.contains('AI provider');

			if (isLlmError) {
				_isProviderNotConfigured = true;

				return 'AI provider not configured';
			}

			_isSttNotConfigured = true;

			return 'Voice input not configured';
		}

		if (e.response?.statusCode == 413) {
			return 'Audio file is too large (max 25 MB)';
		}

		if (e.response?.statusCode == 415) {
			return 'Unsupported audio format';
		}

		if (e.response?.statusCode == 400) {
			final data = e.response?.data;
			final message = data is Map<String, dynamic> ? data['message'] as String? : null;

			if (message != null && message.isNotEmpty) {
				return message;
			}
		}

		return _parseGenericError(e);
	}

	String _parseGenericError(DioException e) {
		if (e.type == DioExceptionType.connectionTimeout ||
			e.type == DioExceptionType.receiveTimeout) {
			return 'Request timed out. Please try again.';
		}

		if (e.type == DioExceptionType.connectionError) {
			return 'Connection error. Please check your network.';
		}

		return 'Something went wrong. Please try again.';
	}

	String _mimeToExtension(String mimeType) {
		switch (mimeType) {
			case 'audio/wav':
			case 'audio/wave':
			case 'audio/x-wav':
				return 'wav';
			case 'audio/webm':
				return 'webm';
			case 'audio/ogg':
				return 'ogg';
			case 'audio/mpeg':
				return 'mp3';
			default:
				return 'wav';
		}
	}
}
