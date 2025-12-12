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
    if (payload.containsKey('modules') &&
        payload['modules'] is Map<String, dynamic>) {
      final modules = payload['modules'] as Map<String, dynamic>;

      for (final entry in modules.entries) {
        final moduleName = entry.key;
        if (_registrationService.isModuleRegistered(moduleName)) {
          try {
            final repo = _repositoryManager.getModuleRepository(moduleName);
            if (entry.value is Map<String, dynamic>) {
              repo.insertConfiguration(entry.value as Map<String, dynamic>);
            }
          } catch (e) {
            if (kDebugMode) {
              debugPrint(
                '[CONFIG MODULE] Failed to update configuration for module $moduleName: ${e.toString()}',
              );
            }
          }
        }
      }
    }

    // Handle plugin config updates
    if (payload.containsKey('plugins') &&
        payload['plugins'] is Map<String, dynamic>) {
      final plugins = payload['plugins'] as Map<String, dynamic>;

      for (final entry in plugins.entries) {
        final pluginName = entry.key;
        if (_registrationService.isPluginRegistered(pluginName)) {
          try {
            final repo = _repositoryManager.getPluginRepository(pluginName);
            if (entry.value is Map<String, dynamic>) {
              repo.insertConfiguration(entry.value as Map<String, dynamic>);
            }
          } catch (e) {
            if (kDebugMode) {
              debugPrint(
                '[CONFIG MODULE] Failed to update configuration for plugin $pluginName: ${e.toString()}',
              );
            }
          }
        }
      }
    }
  }
}
