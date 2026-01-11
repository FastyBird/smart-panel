import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/spaces/constants.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:flutter/foundation.dart';

class SpacesModuleService {
  final SocketService _socketService;

  late SpacesRepository _spacesRepository;
  late LightTargetsRepository _lightTargetsRepository;
  late ClimateTargetsRepository _climateTargetsRepository;
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

    _spacesService = SpacesService(
      spacesRepository: _spacesRepository,
      lightTargetsRepository: _lightTargetsRepository,
      climateTargetsRepository: _climateTargetsRepository,
    );

    locator.registerSingleton(_spacesRepository);
    locator.registerSingleton(_lightTargetsRepository);
    locator.registerSingleton(_climateTargetsRepository);
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
    }
  }

  /// Handle devices module events to sync names to light targets
  void _deviceSocketEventHandler(String event, Map<String, dynamic> payload) {
    if (!payload.containsKey('id')) return;

    final id = payload['id'] as String;

    if (event == DevicesModuleConstants.channelUpdatedEvent) {
      // Sync channel name to light targets
      final name = payload['name'] as String?;
      if (name != null) {
        _lightTargetsRepository.updateChannelName(id, name);
      }
    } else if (event == DevicesModuleConstants.deviceUpdatedEvent) {
      // Sync device name to light targets
      final name = payload['name'] as String?;
      if (name != null) {
        _lightTargetsRepository.updateDeviceName(id, name);
      }
    }
  }
}
