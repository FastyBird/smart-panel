import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/constants.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/covers_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:flutter/foundation.dart';

class SpacesModuleService {
  final SocketService _socketService;

  late SpacesRepository _spacesRepository;
  late LightTargetsRepository _lightTargetsRepository;
  late ClimateTargetsRepository _climateTargetsRepository;
  late CoversTargetsRepository _coversTargetsRepository;
  late SpaceStateRepository _spaceStateRepository;
  late SpacesService _spacesService;

  bool _isLoading = true;

  SpacesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
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
    locator.registerSingleton(_spacesService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _spacesService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      SpacesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    // Listen for devices module events to sync channel/device names
    _socketService.registerEventHandler(
      DevicesModuleConstants.channelUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.registerEventHandler(
      DevicesModuleConstants.deviceUpdatedEvent,
      _deviceSocketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[SPACES MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      SpacesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.channelUpdatedEvent,
      _deviceSocketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.deviceUpdatedEvent,
      _deviceSocketEventHandler,
    );

    // Dispose service first to remove its repository listeners
    _spacesService.dispose();

    // Clear all repository data to prevent memory leaks
    _spacesRepository.clearAll();
    _lightTargetsRepository.clearAll();
    _climateTargetsRepository.clearAll();
    _coversTargetsRepository.clearAll();
    _spaceStateRepository.clearAll();
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
    }
  }

  /// Handle devices module events to sync names to targets
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
    } else if (event == DevicesModuleConstants.deviceUpdatedEvent) {
      // Sync device name to targets
      final name = payload['name'] as String?;
      if (name != null) {
        _lightTargetsRepository.updateDeviceName(id, name);
        _coversTargetsRepository.updateDeviceName(id, name);
      }
    }
  }
}
