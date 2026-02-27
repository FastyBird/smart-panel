import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/buddy/models/conversation.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';

class BuddyRepository extends ChangeNotifier {
  final Dio _dio;

  static const String _basePath = '/modules/buddy';

  /// Active conversations list
  List<BuddyConversationModel> _conversations = [];

  /// Currently active conversation with messages
  BuddyConversationModel? _activeConversation;

  /// Active suggestions
  final Map<String, BuddySuggestionModel> _suggestions = {};

  /// Loading states
  bool _isLoadingConversations = false;
  bool _isSendingMessage = false;

  BuddyRepository({required Dio dio}) : _dio = dio;

  // ============================================
  // Getters
  // ============================================

  List<BuddyConversationModel> get conversations => _conversations;

  BuddyConversationModel? get activeConversation => _activeConversation;

  List<BuddySuggestionModel> get suggestions =>
      _suggestions.values.where((s) => !s.isExpired).toList();

  int get suggestionCount => suggestions.length;

  bool get isLoadingConversations => _isLoadingConversations;

  bool get isSendingMessage => _isSendingMessage;

  // ============================================
  // Conversation API calls
  // ============================================

  Future<void> fetchConversations() async {
    _isLoadingConversations = true;
    notifyListeners();

    try {
      final response = await _dio.get('$_basePath/conversations');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final list = data['data'] as List? ?? [];

        _conversations = list
            .cast<Map<String, dynamic>>()
            .map((json) => BuddyConversationModel.fromJson(json))
            .toList();
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error fetching conversations: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[BUDDY MODULE] Unexpected error fetching conversations: $e');
      }
    }

    _isLoadingConversations = false;
    notifyListeners();
  }

  Future<void> fetchConversation(String id) async {
    try {
      final response = await _dio.get('$_basePath/conversations/$id');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final json = data['data'] as Map<String, dynamic>;

        _activeConversation = BuddyConversationModel.fromJson(json);
        notifyListeners();
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error fetching conversation $id: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Unexpected error fetching conversation $id: $e',
        );
      }
    }
  }

  Future<BuddyConversationModel?> createConversation({
    String? title,
    String? spaceId,
  }) async {
    try {
      final body = <String, dynamic>{
        'data': <String, dynamic>{
          if (title != null) 'title': title,
          if (spaceId != null) 'space_id': spaceId,
        },
      };

      final response = await _dio.post(
        '$_basePath/conversations',
        data: body,
      );

      if (response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300 &&
          response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final json = data['data'] as Map<String, dynamic>;
        final conversation = BuddyConversationModel.fromJson(json);

        _activeConversation = conversation;
        _conversations.insert(0, conversation);
        notifyListeners();

        return conversation;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error creating conversation: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Unexpected error creating conversation: $e',
        );
      }
    }

    return null;
  }

  Future<BuddyMessageModel?> sendMessage(
    String conversationId,
    String content,
  ) async {
    _isSendingMessage = true;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        'data': <String, dynamic>{
          'content': content,
        },
      };

      final response = await _dio.post(
        '$_basePath/conversations/$conversationId/messages',
        data: body,
      );

      if (response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300 &&
          response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final json = data['data'] as Map<String, dynamic>;
        final message = BuddyMessageModel.fromJson(json);

        // Reload conversation to get updated message list
        await fetchConversation(conversationId);

        _isSendingMessage = false;
        notifyListeners();

        return message;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error sending message: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[BUDDY MODULE] Unexpected error sending message: $e');
      }
    }

    _isSendingMessage = false;
    notifyListeners();

    return null;
  }

  Future<void> deleteConversation(String id) async {
    try {
      final response = await _dio.delete('$_basePath/conversations/$id');

      if (response.statusCode == 204 ||
          (response.statusCode != null &&
              response.statusCode! >= 200 &&
              response.statusCode! < 300)) {
        _conversations.removeWhere((c) => c.id == id);

        if (_activeConversation?.id == id) {
          _activeConversation = null;
        }

        notifyListeners();
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error deleting conversation $id: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Unexpected error deleting conversation $id: $e',
        );
      }
    }
  }

  // ============================================
  // Suggestion API calls
  // ============================================

  Future<void> fetchSuggestions({String? spaceId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (spaceId != null) {
        queryParams['space_id'] = spaceId;
      }

      final response = await _dio.get(
        '$_basePath/suggestions',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final list = data['data'] as List? ?? [];

        _suggestions.clear();

        for (var json in list.cast<Map<String, dynamic>>()) {
          try {
            final suggestion = BuddySuggestionModel.fromJson(json);
            _suggestions[suggestion.id] = suggestion;
          } catch (e) {
            if (kDebugMode) {
              debugPrint(
                '[BUDDY MODULE] Failed to parse suggestion: $e',
              );
            }
          }
        }

        notifyListeners();
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error fetching suggestions: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Unexpected error fetching suggestions: $e',
        );
      }
    }
  }

  Future<bool> submitSuggestionFeedback(
    String suggestionId,
    String feedback,
  ) async {
    try {
      final body = <String, dynamic>{
        'data': <String, dynamic>{
          'feedback': feedback,
        },
      };

      final response = await _dio.post(
        '$_basePath/suggestions/$suggestionId/feedback',
        data: body,
      );

      if (response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300) {
        _suggestions.remove(suggestionId);
        notifyListeners();

        return true;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Error submitting feedback: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Unexpected error submitting feedback: $e',
        );
      }
    }

    return false;
  }

  // ============================================
  // WebSocket event handlers
  // ============================================

  void handleSuggestionCreated(Map<String, dynamic> payload) {
    try {
      final suggestion = BuddySuggestionModel.fromJson(payload);
      _suggestions[suggestion.id] = suggestion;
      notifyListeners();

      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] New suggestion received: ${suggestion.id}',
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

  void handleMessageReceived(Map<String, dynamic> payload) {
    try {
      final conversationId = payload['conversation_id'] as String?;

      if (conversationId != null &&
          _activeConversation?.id == conversationId) {
        // Reload the active conversation to get the new message
        fetchConversation(conversationId);
      }

      if (kDebugMode) {
        debugPrint(
          '[BUDDY MODULE] Message received for conversation: $conversationId',
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
  // Active conversation management
  // ============================================

  void setActiveConversation(BuddyConversationModel? conversation) {
    _activeConversation = conversation;
    notifyListeners();
  }

  void clearActiveConversation() {
    _activeConversation = null;
    notifyListeners();
  }

  /// Add a user message locally for immediate UI feedback
  void addLocalUserMessage(String conversationId, String content) {
    if (_activeConversation?.id != conversationId) return;

    final localMessage = BuddyMessageModel(
      id: 'local_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'user',
      content: content,
      createdAt: DateTime.now(),
    );

    final currentMessages =
        List<BuddyMessageModel>.from(_activeConversation!.messages);
    currentMessages.add(localMessage);

    _activeConversation = BuddyConversationModel(
      id: _activeConversation!.id,
      title: _activeConversation!.title,
      spaceId: _activeConversation!.spaceId,
      createdAt: _activeConversation!.createdAt,
      updatedAt: _activeConversation!.updatedAt,
      messages: currentMessages,
    );

    notifyListeners();
  }
}
