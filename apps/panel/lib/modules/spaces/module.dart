import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_notification_service.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/space_suggestion_provider.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/constants.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/covers_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class SpacesModuleService {
  final SocketService _socketService;

  late SpacesRepository _spacesRepository;
  late LightTargetsRepository _lightTargetsRepository;
  late ClimateTargetsRepository _climateTargetsRepository;
  late CoversTargetsRepository _coversTargetsRepository;
  late SpaceStateRepository _spaceStateRepository;
  late MediaActivityRepository _mediaActivityRepository;
  late MediaActivityService _mediaActivityService;
  late SpacesService _spacesService;
  late SpaceSuggestionProvider _suggestionProvider;

  bool _isLoading = true;

  SpacesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
    required Dio dio,
  }) : _socketService = socketService {
    _spacesRepository = SpacesRepository(
      apiClient: apiClient.spacesModule,
    );

    _lightTargetsRepository = LightTargetsRepository(
      apiClient: apiClient.spacesModule,
    );

    _climateTargetsRepository = ClimateTargetsRepository(
      apiClient: apiClient.spacesModule,
    );

    _coversTargetsRepository = CoversTargetsRepository(
      apiClient: apiClient.spacesModule,
    );

    _spaceStateRepository = SpaceStateRepository(
      apiClient: apiClient.spacesModule,
      intentsRepository: locator<IntentsRepository>(),
      commandDispatch: CommandDispatchService(socketService: socketService),
    );

    _mediaActivityRepository = MediaActivityRepository(
      dio: dio,
    );

    _mediaActivityService = MediaActivityService(
      repository: _mediaActivityRepository,
    );

    _spacesService = SpacesService(
      spacesRepository: _spacesRepository,
      lightTargetsRepository: _lightTargetsRepository,
      climateTargetsRepository: _climateTargetsRepository,
      coversTargetsRepository: _coversTargetsRepository,
      spaceStateRepository: _spaceStateRepository,
    );

    locator.registerSingleton(_spacesRepository);
    locator.registerSingleton(_lightTargetsRepository);
    locator.registerSingleton(_climateTargetsRepository);
    locator.registerSingleton(_coversTargetsRepository);
    locator.registerSingleton(_spaceStateRepository);
    locator.registerSingleton(_mediaActivityRepository);
    locator.registerSingleton(_mediaActivityService);
    locator.registerSingleton(_spacesService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    // Register space suggestion provider with global notification service
    _suggestionProvider = SpaceSuggestionProvider();
    try {
      locator<SuggestionNotificationService>().registerProvider(_suggestionProvider);
    } catch (_) {
      // Global notification service not yet available
    }

    await _spacesService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      SpacesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    // Listen for devices module events to sync channel/device names
    // and refresh media endpoints when device assignments change
    _socketService.registerEventHandler(
      DevicesModuleConstants.channelUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.registerEventHandler(
      DevicesModuleConstants.deviceCreatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.registerEventHandler(
      DevicesModuleConstants.deviceUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.registerEventHandler(
      DevicesModuleConstants.deviceDeletedEvent,
      _deviceSocketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[SPACES MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  /// Re-fetch all spaces, targets, and media data.
  Future<void> refresh() async {
    await _spacesRepository.fetchAll();

    // Refresh media activity data for the display's space
    try {
      final displayRoomId = locator<DisplayRepository>().display?.roomId;
      if (displayRoomId != null) {
        await _mediaActivityRepository.fetchAllForSpace(displayRoomId);
      }
    } catch (_) {
      // DisplayRepository not available
    }
  }

  void dispose() {
    // Unregister space suggestion provider from global service
    try {
      locator<SuggestionNotificationService>().unregisterProvider(
        _suggestionProvider.providerId,
      );
    } catch (_) {
      // Global notification service already disposed
    }

    _socketService.unregisterEventHandler(
      SpacesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.channelUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.deviceCreatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.deviceUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.deviceDeletedEvent,
      _deviceSocketEventHandler,
    );

    if (locator.isRegistered<SpacesService>()) {
      locator.unregister<SpacesService>();
    }
    if (locator.isRegistered<MediaActivityService>()) {
      locator.unregister<MediaActivityService>();
    }
    if (locator.isRegistered<MediaActivityRepository>()) {
      locator.unregister<MediaActivityRepository>();
    }
    if (locator.isRegistered<SpaceStateRepository>()) {
      locator.unregister<SpaceStateRepository>();
    }
    if (locator.isRegistered<CoversTargetsRepository>()) {
      locator.unregister<CoversTargetsRepository>();
    }
    if (locator.isRegistered<ClimateTargetsRepository>()) {
      locator.unregister<ClimateTargetsRepository>();
    }
    if (locator.isRegistered<LightTargetsRepository>()) {
      locator.unregister<LightTargetsRepository>();
    }
    if (locator.isRegistered<SpacesRepository>()) {
      locator.unregister<SpacesRepository>();
    }
  }

  /// ////////////////
  /// SOCKET HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Space CREATE/UPDATE
    if (event == SpacesModuleConstants.spaceCreatedEvent ||
        event == SpacesModuleConstants.spaceUpdatedEvent) {
      _spacesRepository.insert([payload]);

      /// Space DELETE
    } else if (event == SpacesModuleConstants.spaceDeletedEvent &&
        payload.containsKey('id')) {
      _spacesRepository.delete(payload['id']);
      _lightTargetsRepository.deleteForSpace(payload['id']);
      _climateTargetsRepository.deleteForSpace(payload['id']);
      _coversTargetsRepository.deleteForSpace(payload['id']);
      _spaceStateRepository.clearForSpace(payload['id']);
      _mediaActivityRepository.clearForSpace(payload['id']);

      /// Light Target CREATE/UPDATE
    } else if (event == SpacesModuleConstants.lightTargetCreatedEvent ||
        event == SpacesModuleConstants.lightTargetUpdatedEvent) {
      _lightTargetsRepository.insertOne(payload);

      /// Light Target DELETE
    } else if (event == SpacesModuleConstants.lightTargetDeletedEvent &&
        payload.containsKey('id')) {
      _lightTargetsRepository.delete(payload['id']);

      /// Climate Target CREATE/UPDATE
    } else if (event == SpacesModuleConstants.climateTargetCreatedEvent ||
        event == SpacesModuleConstants.climateTargetUpdatedEvent) {
      _climateTargetsRepository.insertOne(payload);

      /// Climate Target DELETE
    } else if (event == SpacesModuleConstants.climateTargetDeletedEvent &&
        payload.containsKey('id')) {
      _climateTargetsRepository.delete(payload['id']);

      /// Covers Target CREATE/UPDATE
    } else if (event == SpacesModuleConstants.coversTargetCreatedEvent ||
        event == SpacesModuleConstants.coversTargetUpdatedEvent) {
      _coversTargetsRepository.insertOne(payload);

      /// Covers Target DELETE
    } else if (event == SpacesModuleConstants.coversTargetDeletedEvent &&
        payload.containsKey('id')) {
      _coversTargetsRepository.delete(payload['id']);

      /// Lighting State CHANGED
    } else if (event == SpacesModuleConstants.lightingStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        _spaceStateRepository.updateLightingState(spaceId, stateData);
      }

      /// Climate State CHANGED
    } else if (event == SpacesModuleConstants.climateStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        _spaceStateRepository.updateClimateState(spaceId, stateData);
      }

      /// Covers State CHANGED
    } else if (event == SpacesModuleConstants.coversStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        _spaceStateRepository.updateCoversState(spaceId, stateData);
      }

      /// Sensor State CHANGED
    } else if (event == SpacesModuleConstants.sensorStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        _spaceStateRepository.updateSensorState(spaceId, stateData);
      }

      /// Media Activity step progress event
    } else if (event == SpacesModuleConstants.mediaActivityStepProgressEvent) {
      final spaceId = payload['space_id'] as String?;
      if (spaceId != null) {
        _mediaActivityRepository.updateStepProgress(spaceId, payload);
      }

      /// Media Activity lifecycle events
    } else if (event == SpacesModuleConstants.mediaActivityActivatingEvent ||
        event == SpacesModuleConstants.mediaActivityActivatedEvent ||
        event == SpacesModuleConstants.mediaActivityFailedEvent ||
        event == SpacesModuleConstants.mediaActivityDeactivatedEvent) {
      final spaceId = payload['space_id'] as String?;
      if (spaceId != null) {
        _mediaActivityRepository.updateActiveState(spaceId, payload);
      }

      /// Media Binding CREATE/UPDATE/DELETE — re-fetch bindings
    } else if (event == SpacesModuleConstants.mediaBindingCreatedEvent ||
        event == SpacesModuleConstants.mediaBindingUpdatedEvent ||
        event == SpacesModuleConstants.mediaBindingDeletedEvent) {
      final spaceId = payload['space_id'] as String?;
      if (spaceId != null) {
        _mediaActivityRepository.refreshBindings(spaceId);
      }

      /// Suggestion CREATED
    } else if (event == SpacesModuleConstants.suggestionCreatedEvent) {
      _handleSuggestionCreated(payload);
    }
  }

  void _handleSuggestionCreated(Map<String, dynamic> payload) {
    try {
      final spaceId = payload['space_id'] as String?;
      final typeStr = payload['type'] as String?;
      final title = payload['title'] as String? ?? '';
      final reason = payload['reason'] as String?;

      if (spaceId == null || typeStr == null) return;

      // Only process suggestions for the space this display is assigned to
      try {
        final displayRoomId = locator<DisplayRepository>().display?.roomId;
        if (displayRoomId != null && displayRoomId != spaceId) {
          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE] Ignoring suggestion for space $spaceId '
              '(display is assigned to $displayRoomId)',
            );
          }
          return;
        }
      } catch (_) {
        // DisplayRepository not available — allow suggestion through
      }

      final type = parseSuggestionType(typeStr);
      if (type == null) return;

      final expiresAtStr = payload['expires_at'] as String?;

      final suggestion = SuggestionModel(
        type: type,
        title: title,
        reason: reason,
        intentType: payload['intent_type'] as String?,
        intentMode: payload['intent_mode'] as String?,
        expiresAt: expiresAtStr != null
            ? DateTime.tryParse(expiresAtStr)
            : null,
      );

      final appSuggestion = SpaceAppSuggestion(
        model: suggestion,
        spaceId: spaceId,
      );

      try {
        locator<SuggestionNotificationService>().enqueue(
          appSuggestion,
          providerId: _suggestionProvider.providerId,
        );
      } catch (_) {
        // Global notification service not available
      }

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE] Suggestion created via WebSocket: ${appSuggestion.id}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE] Error handling suggestion event: $e',
        );
      }
    }
  }

  /// Handle devices module events to sync names to targets and refresh
  /// media endpoints when device assignments change.
  void _deviceSocketEventHandler(String event, Map<String, dynamic> payload) {
    if (!payload.containsKey('id')) return;

    final id = payload['id'] as String;

    if (event == DevicesModuleConstants.channelUpdatedEvent) {
      // Sync channel name to targets
      final name = payload['name'] as String?;
      if (name != null) {
        _lightTargetsRepository.updateChannelName(id, name);
        _coversTargetsRepository.updateChannelName(id, name);
      }
    } else if (event == DevicesModuleConstants.deviceCreatedEvent ||
        event == DevicesModuleConstants.deviceUpdatedEvent) {
      // Sync device name to targets
      if (event == DevicesModuleConstants.deviceUpdatedEvent) {
        final name = payload['name'] as String?;
        if (name != null) {
          _lightTargetsRepository.updateDeviceName(id, name);
          _coversTargetsRepository.updateDeviceName(id, name);
        }
      }

      // Refresh media endpoints when a device is created/updated
      // (e.g. assigned to this space via bulkAssign) — the derived
      // endpoint list may have changed.
      final roomId = payload['room_id'] as String?;
      if (roomId != null && _mediaActivityRepository.getEndpoints(roomId).isNotEmpty) {
        _mediaActivityRepository.refreshEndpoints(roomId);
      }
    } else if (event == DevicesModuleConstants.deviceDeletedEvent) {
      // A device was removed — refresh endpoints for the display's space
      // since we don't know which space the device belonged to.
      try {
        final displayRoomId = locator<DisplayRepository>().display?.roomId;
        if (displayRoomId != null) {
          _mediaActivityRepository.refreshEndpoints(displayRoomId);
        }
      } catch (_) {
        // DisplayRepository not available
      }
    }
  }
}
