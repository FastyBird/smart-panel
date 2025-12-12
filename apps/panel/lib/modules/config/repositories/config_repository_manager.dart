import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/config/services/registration_service.dart';
import 'package:flutter/foundation.dart';

class ConfigRepositoryManager {
  final ConfigRegistrationService _registrationService;
  final ApiClient _apiClient;

  final Map<String, ChangeNotifier> _moduleRepositories = {};
  final Map<String, ChangeNotifier> _pluginRepositories = {};

  ConfigRepositoryManager({
    required ConfigRegistrationService registrationService,
    required ApiClient apiClient,
  })  : _registrationService = registrationService,
        _apiClient = apiClient;

  /// Get or create repository for a module
  ModuleConfigRepository<T> getModuleRepository<T extends Model>(String moduleName) {
    if (!_moduleRepositories.containsKey(moduleName)) {
      final registration = _registrationService.getModuleRegistration(moduleName);
      if (registration == null) {
        throw Exception('Module $moduleName is not registered');
      }

      final repository = ModuleConfigRepository<T>(
        moduleName: moduleName,
        apiClient: _apiClient,
        fromJson: registration.fromJson as T Function(Map<String, dynamic>),
        updateHandler: registration.updateHandler,
      );

      _moduleRepositories[moduleName] = repository;
    }

    return _moduleRepositories[moduleName] as ModuleConfigRepository<T>;
  }

  /// Get or create repository for a plugin
  ModuleConfigRepository<T> getPluginRepository<T extends Model>(String pluginName) {
    if (!_pluginRepositories.containsKey(pluginName)) {
      final registration = _registrationService.getPluginRegistration(pluginName);
      if (registration == null) {
        throw Exception('Plugin $pluginName is not registered');
      }

      final repository = ModuleConfigRepository<T>(
        moduleName: pluginName,
        apiClient: _apiClient,
        fromJson: registration.fromJson as T Function(Map<String, dynamic>),
        updateHandler: registration.updateHandler,
      );

      _pluginRepositories[pluginName] = repository;
    }

    return _pluginRepositories[pluginName] as ModuleConfigRepository<T>;
  }

  /// Fetch all registered configurations
  Future<void> fetchAllConfigurations() async {
    // Get list of registered modules and plugins
    final registeredModules = _registrationService.getRegisteredModules();
    final registeredPlugins = _registrationService.getRegisteredPlugins();

    if (registeredModules.isEmpty && registeredPlugins.isEmpty) {
      return;
    }

    // Fetch each registered module configuration
    for (final moduleName in registeredModules) {
      try {
        final repo = getModuleRepository(moduleName);
        await repo.fetchConfiguration();
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Failed to fetch configuration for module $moduleName: ${e.toString()}',
          );
        }
      }
    }

    // Fetch each registered plugin configuration
    for (final pluginName in registeredPlugins) {
      try {
        final repo = getPluginRepository(pluginName);
        await repo.fetchConfiguration();
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Failed to fetch configuration for plugin $pluginName: ${e.toString()}',
          );
        }
      }
    }
  }

  /// Fetch specific module configuration
  Future<void> fetchModuleConfiguration(String moduleName) async {
    final repo = getModuleRepository(moduleName);
    await repo.fetchConfiguration();
  }

  /// Fetch specific plugin configuration
  Future<void> fetchPluginConfiguration(String pluginName) async {
    final repo = getPluginRepository(pluginName);
    await repo.fetchConfiguration();
  }

  List<String> getRegisteredModules() {
    return _registrationService.getRegisteredModules();
  }

  List<String> getRegisteredPlugins() {
    return _registrationService.getRegisteredPlugins();
  }
}
