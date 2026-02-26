import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/constants.dart';
import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/config_repository_manager.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/config/services/registration_service.dart';
import 'package:flutter/foundation.dart';

class ConfigModuleService {
  final SocketService _socketService;
  late final ConfigRegistrationService _registrationService;
  late final ConfigRepositoryManager _repositoryManager;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
    required Dio dio,
    required SocketService socketService,
  })  : _socketService = socketService {
    _registrationService = ConfigRegistrationService();
    _repositoryManager = ConfigRepositoryManager(
      registrationService: _registrationService,
      apiClient: apiClient,
      dio: dio,
    );
  }

  /// Register a module configuration model
  void registerModule<T extends Model>(
    String name,
    T Function(Map<String, dynamic>) fromJson, {
    Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler,
  }) {
    _registrationService.registerModule<T>(
      name,
      fromJson,
      updateHandler: updateHandler,
    );
  }

  /// Register a plugin configuration model
  void registerPlugin<T extends Model>(
    String name,
    T Function(Map<String, dynamic>) fromJson, {
    Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler,
  }) {
    _registrationService.registerPlugin<T>(
      name,
      fromJson,
      updateHandler: updateHandler,
    );
  }

  /// Get repository for a registered module
  ModuleConfigRepository<T> getModuleRepository<T extends Model>(String moduleName) {
    return _repositoryManager.getModuleRepository<T>(moduleName);
  }

  /// Get repository for a registered plugin
  ModuleConfigRepository<T> getPluginRepository<T extends Model>(String pluginName) {
    return _repositoryManager.getPluginRepository<T>(pluginName);
  }

  Future<void> initialize() async {
    _isLoading = true;

    // Fetch all registered configurations
    await _repositoryManager.fetchAllConfigurations();

    _isLoading = false;

    _socketService.registerEventHandler(
      ConfigModuleConstants.configUpdatedEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[CONFIG MODULE][MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      ConfigModuleConstants.configUpdatedEvent,
      _socketEventHandler,
    );
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    // Handle module config updates
    if (payload.containsKey('modules')) {
      _processConfigItems(payload['modules'], isModule: true);
    }

    // Handle plugin config updates
    if (payload.containsKey('plugins')) {
      _processConfigItems(payload['plugins'], isModule: false);
    }
  }

  /// Process config items from WebSocket payload.
  /// Supports both array format (backend sends: [{"type": "weather-module", ...}])
  /// and map format (keyed by name: {"weather-module": {...}}).
  void _processConfigItems(dynamic items, {required bool isModule}) {
    final label = isModule ? 'module' : 'plugin';

    Iterable<MapEntry<String, Map<String, dynamic>>> entries;

    if (items is List) {
      // Backend sends an array of objects, each with a "type" field
      entries = items
          .whereType<Map<String, dynamic>>()
          .where((item) => item['type'] is String)
          .map((item) {
            final config = Map<String, dynamic>.of(item)..remove('type');
            return MapEntry(item['type'] as String, config);
          });
    } else if (items is Map<String, dynamic>) {
      // Legacy map format keyed by name
      entries = items.entries
          .where((e) => e.value is Map<String, dynamic>)
          .map((e) => MapEntry(e.key, e.value as Map<String, dynamic>));
    } else {
      return;
    }

    for (final entry in entries) {
      final name = entry.key;
      final isRegistered = isModule
          ? _registrationService.isModuleRegistered(name)
          : _registrationService.isPluginRegistered(name);

      if (isRegistered) {
        try {
          final repo = isModule
              ? _repositoryManager.getModuleRepository(name)
              : _repositoryManager.getPluginRepository(name);
          repo.insertConfiguration(entry.value);
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[CONFIG MODULE] Failed to update configuration for $label $name: ${e.toString()}',
            );
          }
        }
      }
    }
  }
}
