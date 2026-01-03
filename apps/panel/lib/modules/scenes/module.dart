import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/scenes/constants.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/scenes.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:flutter/foundation.dart';

class ScenesModuleService {
  final SocketService _socketService;

  late ScenesRepository _scenesRepository;
  late ScenesService _scenesService;

  bool _isLoading = true;

  ScenesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _scenesRepository = ScenesRepository(
      apiClient: apiClient.scenesModule,
    );

    _scenesService = ScenesService(
      scenesRepository: _scenesRepository,
    );

    locator.registerSingleton(_scenesRepository);
    locator.registerSingleton(_scenesService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _scenesService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      ScenesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[SCENES MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      ScenesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  /// ////////////////
  /// SOCKET HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Scene CREATE/UPDATE
    if (event == ScenesModuleConstants.sceneCreatedEvent ||
        event == ScenesModuleConstants.sceneUpdatedEvent) {
      _scenesRepository.insert([payload]);

      /// Scene DELETE
    } else if (event == ScenesModuleConstants.sceneDeletedEvent &&
        payload.containsKey('id')) {
      _scenesRepository.delete(payload['id']);
    }
  }
}
