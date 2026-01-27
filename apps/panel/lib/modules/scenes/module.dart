import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/scenes/constants.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/actions.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/scenes.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/plugin.dart';
import 'package:flutter/foundation.dart';

class ScenesModuleService {
  final SocketService _socketService;

  late ScenesRepository _scenesRepository;
  late ActionsRepository _actionsRepository;
  late ScenesService _scenesService;

  bool _isLoading = true;

  ScenesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    // Register plugins first (they register mappers)
    ScenesLocalPlugin.register();

    // Initialize ActionsRepository first (dependency for ScenesRepository)
    _actionsRepository = ActionsRepository(
      apiClient: apiClient.scenesModule,
    );

    // Initialize ScenesRepository with ActionsRepository and CommandDispatch dependencies
    _scenesRepository = ScenesRepository(
      apiClient: apiClient.scenesModule,
      actionsRepository: _actionsRepository,
      commandDispatch: CommandDispatchService(socketService: socketService),
    );

    _scenesService = ScenesService(
      scenesRepository: _scenesRepository,
      actionsRepository: _actionsRepository,
    );

    locator.registerSingleton(_scenesRepository);
    locator.registerSingleton(_actionsRepository);
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
      // Insert scene (embedded actions are automatically inserted)
      _scenesRepository.insert([payload]);

      /// Scene DELETE
    } else if (event == ScenesModuleConstants.sceneDeletedEvent &&
        payload.containsKey('id')) {
      // ScenesRepository.delete also deletes associated actions
      _scenesRepository.delete(payload['id']);

      /// Action CREATE/UPDATE
    } else if (event == ScenesModuleConstants.actionCreatedEvent ||
        event == ScenesModuleConstants.actionUpdatedEvent) {
      _actionsRepository.insert([payload]);

      /// Action DELETE
    } else if (event == ScenesModuleConstants.actionDeletedEvent &&
        payload.containsKey('id')) {
      _actionsRepository.delete(payload['id']);
    }
  }
}
