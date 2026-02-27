import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/buddy/models/conversation.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';

class BuddyService extends ChangeNotifier {
  final BuddyRepository _repository;

  BuddyService({
    required BuddyRepository repository,
  }) : _repository = repository;

  Future<void> initialize() async {
    _repository.addListener(_onRepositoryChanged);

    await Future.wait([
      _repository.fetchSuggestions(),
      _repository.fetchConversations(),
    ]);
  }

  // ============================================
  // Getters (proxy to repository)
  // ============================================

  List<BuddyConversationModel> get conversations => _repository.conversations;

  BuddyConversationModel? get activeConversation =>
      _repository.activeConversation;

  List<BuddySuggestionModel> get suggestions => _repository.suggestions;

  int get suggestionCount => _repository.suggestionCount;

  bool get isLoadingConversations => _repository.isLoadingConversations;

  bool get isSendingMessage => _repository.isSendingMessage;

  List<BuddyMessageModel> get activeMessages =>
      _repository.activeConversation?.messages ?? [];

  // ============================================
  // Conversation actions
  // ============================================

  Future<BuddyConversationModel?> startNewConversation({
    String? title,
    String? spaceId,
  }) async {
    return _repository.createConversation(title: title, spaceId: spaceId);
  }

  Future<void> openConversation(String id) async {
    await _repository.fetchConversation(id);
  }

  Future<BuddyMessageModel?> sendMessage(String content) async {
    final conversation = _repository.activeConversation;
    if (conversation == null) return null;

    // Add local user message for immediate feedback
    _repository.addLocalUserMessage(conversation.id, content);

    return _repository.sendMessage(conversation.id, content);
  }

  Future<void> deleteConversation(String id) async {
    await _repository.deleteConversation(id);
  }

  void clearActiveConversation() {
    _repository.clearActiveConversation();
  }

  // ============================================
  // Suggestion actions
  // ============================================

  Future<bool> applySuggestion(String suggestionId) async {
    return _repository.submitSuggestionFeedback(suggestionId, 'applied');
  }

  Future<bool> dismissSuggestion(String suggestionId) async {
    return _repository.submitSuggestionFeedback(suggestionId, 'dismissed');
  }

  Future<void> refreshSuggestions({String? spaceId}) async {
    await _repository.fetchSuggestions(spaceId: spaceId);
  }

  // ============================================
  // Internal
  // ============================================

  void _onRepositoryChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    _repository.removeListener(_onRepositoryChanged);
    super.dispose();
  }
}
