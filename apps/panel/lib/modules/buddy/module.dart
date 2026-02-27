import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/buddy/constants.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';

class BuddyModuleService {
  final SocketService _socketService;

  late BuddyRepository _buddyRepository;
  late BuddyService _buddyService;

  bool _isLoading = true;

  BuddyModuleService({
    required Dio dio,
    required SocketService socketService,
  }) : _socketService = socketService {
    _buddyRepository = BuddyRepository(dio: dio);

    _buddyService = BuddyService(
      repository: _buddyRepository,
    );

    locator.registerSingleton<BuddyRepository>(_buddyRepository);
    locator.registerSingleton<BuddyService>(_buddyService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _buddyService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      BuddyModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[BUDDY MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      BuddyModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  /// ////////////////
  /// SOCKET HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Suggestion CREATED
    if (event == BuddyModuleConstants.suggestionCreatedEvent) {
      _buddyRepository.handleSuggestionCreated(payload);

      /// Conversation MESSAGE RECEIVED
    } else if (event ==
        BuddyModuleConstants.conversationMessageReceivedEvent) {
      _buddyRepository.handleMessageReceived(payload);
    }
  }
}
