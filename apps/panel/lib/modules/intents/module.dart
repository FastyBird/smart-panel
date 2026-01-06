import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/constants.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';

class IntentsModuleService {
  final SocketService _socketService;

  late IntentsRepository _intentsRepository;
  late IntentOverlayService _intentOverlayService;

  bool _isLoading = true;

  IntentsModuleService({
    required SocketService socketService,
  }) : _socketService = socketService {
    _intentsRepository = IntentsRepository();

    _intentOverlayService = IntentOverlayService(
      intentsRepository: _intentsRepository,
    );

    locator.registerSingleton<IntentsRepository>(_intentsRepository);
    locator.registerSingleton<IntentOverlayService>(_intentOverlayService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _intentOverlayService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      IntentsModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    // Listen for socket disconnects to clear stale intents
    _socketService.addConnectionListener(_handleConnectionChange);

    if (kDebugMode) {
      debugPrint(
        '[INTENTS MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      IntentsModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
    _socketService.removeConnectionListener(_handleConnectionChange);

    _intentsRepository.dispose();
    _intentOverlayService.dispose();
  }

  /// Handle socket connection state changes
  void _handleConnectionChange(bool isConnected) {
    if (!isConnected) {
      // Socket disconnected - clear all intents to prevent stale locks
      if (kDebugMode) {
        debugPrint(
          '[INTENTS MODULE] Socket disconnected, clearing all intents',
        );
      }
      _intentsRepository.clearAll();
    }
  }

  /// ////////////////
  /// SOCKET HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Intent CREATED
    if (event == IntentsModuleConstants.intentCreatedEvent) {
      _handleIntentCreated(payload);

      /// Intent COMPLETED
    } else if (event == IntentsModuleConstants.intentCompletedEvent) {
      _handleIntentCompleted(payload);

      /// Intent EXPIRED
    } else if (event == IntentsModuleConstants.intentExpiredEvent) {
      _handleIntentExpired(payload);
    }
  }

  /// Handle intent.created event
  void _handleIntentCreated(Map<String, dynamic> payload) {
    try {
      _intentsRepository.insertFromJson(payload);

      final intentId = payload['intent_id'] as String;
      final expiresAt = DateTime.parse(payload['expires_at'] as String);

      // Schedule local expiration as a fallback in case the completion event is lost
      // Add a small buffer (500ms) to allow for network latency
      final now = DateTime.now();
      final expirationDuration =
          expiresAt.difference(now) + const Duration(milliseconds: 500);

      if (expirationDuration.inMilliseconds > 0) {
        _intentsRepository.scheduleExpiration(intentId, expirationDuration);

        if (kDebugMode) {
          debugPrint(
            '[INTENTS MODULE] Scheduled local fallback expiration for $intentId in ${expirationDuration.inMilliseconds}ms',
          );
        }
      }

      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Intent created: $intentId');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Failed to parse intent.created: $e');
      }
    }
  }

  /// Handle intent.completed event
  void _handleIntentCompleted(Map<String, dynamic> payload) {
    try {
      final intentId = payload['intent_id'] as String;

      // Store results for failure indicators
      _intentsRepository.storeResultsFromJson(payload);

      _intentsRepository.remove(intentId);

      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Intent completed: $intentId');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Failed to parse intent.completed: $e');
      }
    }
  }

  /// Handle intent.expired event
  void _handleIntentExpired(Map<String, dynamic> payload) {
    try {
      final intentId = payload['intent_id'] as String;

      _intentsRepository.remove(intentId);

      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Intent expired: $intentId');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS MODULE] Failed to parse intent.expired: $e');
      }
    }
  }
}
