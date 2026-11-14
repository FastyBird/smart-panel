import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/automations/constants.dart';
import 'package:fastybird_smart_panel/modules/automations/repositories/automations.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:flutter/foundation.dart';

/// Lists the automations of the spaces and lets the panel switch them on or
/// off. There is no editing and no running on the panel.
class AutomationsModuleService {
  final SocketService _socketService;

  late AutomationsRepository _repository;
  late AutomationsService _service;

  bool _isLoading = true;

  AutomationsModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _repository = AutomationsRepository(apiClient: apiClient.automationsModule);
    _service = AutomationsService(repository: _repository);

    locator.registerSingleton(_repository);
    locator.registerSingleton(_service);
  }

  AutomationsRepository get repository => _repository;

  AutomationsService get service => _service;

  bool get isLoading => _isLoading;

  Future<void> initialize() async {
    _isLoading = true;

    await _service.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      AutomationsModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint('[AUTOMATIONS MODULE] Module was successfully initialized');
    }
  }

  /// Re-fetch all automations, a safety net for missed websocket events.
  Future<void> refresh() async {
    await _repository.fetchAll();
  }

  void dispose() {
    _socketService.unregisterEventHandler(
      AutomationsModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (locator.isRegistered<AutomationsService>()) {
      locator.unregister<AutomationsService>();
    }
    if (locator.isRegistered<AutomationsRepository>()) {
      locator.unregister<AutomationsRepository>();
    }

    _service.dispose();
    _repository.dispose();
  }

  /// ////////////////
  /// SOCKET HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    if (event == AutomationsModuleConstants.automationCreatedEvent ||
        event == AutomationsModuleConstants.automationUpdatedEvent) {
      _repository.insert([payload]);
    } else if (event == AutomationsModuleConstants.automationDeletedEvent &&
        payload['id'] is String) {
      _repository.delete(payload['id'] as String);
    } else if (event == AutomationsModuleConstants.moduleResetEvent) {
      _repository.clear();
    }
  }
}
