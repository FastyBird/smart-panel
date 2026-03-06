import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_result.dart';
import 'package:fastybird_smart_panel/modules/deck/models/intent_result.dart';
import 'package:fastybird_smart_panel/modules/deck/types/intent_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:flutter/foundation.dart';

/// Service that handles intent routing and execution.
///
/// The intents layer provides a unified interface for actions from UI
/// and future voice control, routing to the appropriate underlying services.
///
/// UI components should call intents methods instead of directly calling
/// services, enabling consistent behavior and future extensibility.
class IntentsService extends ChangeNotifier {
  final EventBus _eventBus;
  final ScenesService? _scenesService;
  final ChannelPropertiesRepository? _channelPropertiesRepository;

  /// The current deck result (set during hydration).
  DeckResult? _currentDeck;

  /// The current room context (for room-specific actions).
  String? _currentRoomId;

  IntentsService({
    required EventBus eventBus,
    ScenesService? scenesService,
    ChannelPropertiesRepository? channelPropertiesRepository,
  })  : _eventBus = eventBus,
        _scenesService = scenesService,
        _channelPropertiesRepository = channelPropertiesRepository;

  /// Sets the current deck for navigation intents.
  void setDeck(DeckResult deck) {
    _currentDeck = deck;
  }

  /// Sets the current room context.
  void setRoomContext(String? roomId) {
    _currentRoomId = roomId;
    notifyListeners();
  }

  /// Gets the current room context.
  String? get currentRoomId => _currentRoomId;

  /// Navigates to a specific deck item by ID.
  ///
  /// Fires a NavigateToDeckItemEvent that the deck navigation UI should handle.
  IntentResult navigateToDeckItem(String itemId, {required AppLocalizations localizations}) {
    if (_currentDeck == null) {
      return IntentResult.failure(
        IntentType.navigateToDeckItem,
        message: localizations.intent_error_deck_not_initialized,
      );
    }

    final item = _currentDeck!.items.where((i) => i.id == itemId).firstOrNull;
    if (item == null) {
      return IntentResult.invalid(
        IntentType.navigateToDeckItem,
        message: localizations.intent_error_deck_item_not_found,
      );
    }

    // Fire navigation event
    _eventBus.fire(NavigateToDeckItemEvent(itemId));

    if (kDebugMode) {
      debugPrint('[INTENTS] Navigating to deck item: $itemId');
    }

    return IntentResult.success(
      IntentType.navigateToDeckItem,
      data: {'itemId': itemId},
    );
  }

  /// Navigates to the home/start item.
  IntentResult navigateHome({required AppLocalizations localizations}) {
    if (_currentDeck == null) {
      return IntentResult.failure(
        IntentType.navigateHome,
        message: localizations.intent_error_deck_not_initialized,
      );
    }

    final startItem = _currentDeck!.startItem;
    if (startItem == null) {
      return IntentResult.failure(
        IntentType.navigateHome,
        message: localizations.intent_error_no_home_item,
      );
    }

    return navigateToDeckItem(startItem.id, localizations: localizations);
  }

  /// Activates a scene by ID.
  Future<IntentResult> activateScene(String sceneId, {required AppLocalizations localizations}) async {
    if (_scenesService == null) {
      return IntentResult.failure(
        IntentType.activateScene,
        message: localizations.intent_error_scenes_not_available,
      );
    }

    try {
      final result = await _scenesService.triggerScene(sceneId);

      if (result.success) {
        if (result.failureCount > 0) {
          return IntentResult.partialSuccess(
            IntentType.activateScene,
            message: result.errorMessage ?? localizations.space_scene_partial_success,
            data: {
              'sceneId': sceneId,
              'successCount': result.successCount,
              'failureCount': result.failureCount,
            },
          );
        }

        return IntentResult.success(
          IntentType.activateScene,
          message: localizations.space_scene_triggered,
          data: {
            'sceneId': sceneId,
            'successCount': result.successCount,
          },
        );
      }

      return IntentResult.failure(
        IntentType.activateScene,
        message: result.errorMessage ?? localizations.intent_error_scene_activation_failed,
        data: {'sceneId': sceneId},
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS] Failed to activate scene: $e');
      }

      return IntentResult.failure(
        IntentType.activateScene,
        message: localizations.intent_error_scene_activation_error,
        data: {'sceneId': sceneId, 'error': e.toString()},
      );
    }
  }

  /// Sets a device channel property value.
  Future<IntentResult> setDeviceProperty({
    required String propertyId,
    required dynamic value,
    required AppLocalizations localizations,
  }) async {
    if (_channelPropertiesRepository == null) {
      return IntentResult.failure(
        IntentType.setDeviceProperty,
        message: localizations.intent_error_device_repo_not_available,
      );
    }

    try {
      final success = await _channelPropertiesRepository.setValue(
        propertyId,
        value,
      );

      if (success) {
        return IntentResult.success(
          IntentType.setDeviceProperty,
          data: {'propertyId': propertyId, 'value': value},
        );
      }

      return IntentResult.failure(
        IntentType.setDeviceProperty,
        message: localizations.intent_error_set_property_failed,
        data: {'propertyId': propertyId, 'value': value},
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS] Failed to set device property: $e');
      }

      return IntentResult.failure(
        IntentType.setDeviceProperty,
        message: localizations.intent_error_set_property_error,
        data: {'propertyId': propertyId, 'error': e.toString()},
      );
    }
  }

  /// Toggles a boolean device property.
  Future<IntentResult> toggleDevice(String propertyId, {required AppLocalizations localizations}) async {
    if (_channelPropertiesRepository == null) {
      return IntentResult.failure(
        IntentType.toggleDevice,
        message: localizations.intent_error_device_repo_not_available,
      );
    }

    try {
      final success = await _channelPropertiesRepository.toggleValue(
        propertyId,
      );

      if (success) {
        return IntentResult.success(
          IntentType.toggleDevice,
          data: {'propertyId': propertyId},
        );
      }

      return IntentResult.failure(
        IntentType.toggleDevice,
        message: localizations.intent_error_toggle_device_failed,
        data: {'propertyId': propertyId},
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENTS] Failed to toggle device: $e');
      }

      return IntentResult.failure(
        IntentType.toggleDevice,
        message: localizations.intent_error_toggle_device_error,
        data: {'propertyId': propertyId, 'error': e.toString()},
      );
    }
  }

  /// Sets the room context for room-specific actions.
  ///
  /// This is useful when the user navigates to a room and subsequent
  /// actions should be scoped to that room.
  IntentResult setRoomContextIntent(String? roomId) {
    setRoomContext(roomId);

    return IntentResult.success(
      IntentType.setRoomContext,
      data: {'roomId': roomId},
    );
  }
}
