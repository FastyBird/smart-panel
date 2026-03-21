import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/config/services/registration_service.dart';
import 'package:flutter/foundation.dart';

class ConfigRepositoryManager {
  final ConfigRegistrationService _registrationService;
  final ApiClient _apiClient;
  final Dio _dio;

  /// Repositories stored as dynamic to avoid AOT generic type erasure issues.
  ///
  /// In release (AOT) mode, Dart erases generic type parameters, so
  /// `ModuleConfigRepository<Model>` cannot be cast to
  /// `ModuleConfigRepository<SystemConfigModel>`. By storing as dynamic
  /// and ensuring the repository is always created with the correct
  /// concrete type on first access, the cast works at runtime.
  final Map<String, dynamic> _moduleRepositories = {};
  final Map<String, dynamic> _pluginRepositories = {};

  ConfigRepositoryManager({
    required ConfigRegistrationService registrationService,
    required ApiClient apiClient,
    required Dio dio,
  })  : _registrationService = registrationService,
        _apiClient = apiClient,
        _dio = dio;

  /// Get or create repository for a module.
  ModuleConfigRepository<T> getModuleRepository<T extends Model>(String moduleName) {
    if (!_moduleRepositories.containsKey(moduleName)) {
      final registration = _registrationService.getModuleRegistration(moduleName);
      if (registration == null) {
        throw Exception('Module $moduleName is not registered');
      }

      _moduleRepositories[moduleName] = ModuleConfigRepository<T>(
        moduleName: moduleName,
        apiClient: _apiClient,
        dio: _dio,
        fromJson: registration.fromJson as T Function(Map<String, dynamic>),
        updateHandler: registration.updateHandler,
      );
    }

    return _moduleRepositories[moduleName] as ModuleConfigRepository<T>;
  }

  /// Get or create repository for a plugin.
  ModuleConfigRepository<T> getPluginRepository<T extends Model>(String pluginName) {
    if (!_pluginRepositories.containsKey(pluginName)) {
      final registration = _registrationService.getPluginRegistration(pluginName);
      if (registration == null) {
        throw Exception('Plugin $pluginName is not registered');
      }

      _pluginRepositories[pluginName] = ModuleConfigRepository<T>(
        moduleName: pluginName,
        apiClient: _apiClient,
        dio: _dio,
        fromJson: registration.fromJson as T Function(Map<String, dynamic>),
        updateHandler: registration.updateHandler,
      );
    }

    return _pluginRepositories[pluginName] as ModuleConfigRepository<T>;
  }

  /// Fetch all registered configurations.
  ///
  /// Only fetches from repositories that have already been created via
  /// getModuleRepository/getPluginRepository with the correct type.
  /// For repositories that haven't been accessed yet, fetches using
  /// the raw API endpoint without creating a typed repository.
  Future<void> fetchAllConfigurations() async {
    final registeredModules = _registrationService.getRegisteredModules();
    final registeredPlugins = _registrationService.getRegisteredPlugins();

    if (registeredModules.isEmpty && registeredPlugins.isEmpty) {
      return;
    }

    // Fetch from already-created module repositories
    for (final moduleName in registeredModules) {
      try {
        if (_moduleRepositories.containsKey(moduleName)) {
          final ModuleConfigRepository<Model> repo =
              _moduleRepositories[moduleName] as ModuleConfigRepository<Model>;
          await repo.fetchConfiguration();
        } else {
          // Create with base Model type — this repo will only be used for
          // fetching, not for typed access. If a typed repo is needed later,
          // getModuleRepository<T> will create a new one with the correct type.
          final registration = _registrationService.getModuleRegistration(moduleName);
          if (registration != null) {
            final repo = ModuleConfigRepository<Model>(
              moduleName: moduleName,
              apiClient: _apiClient,
              dio: _dio,
              fromJson: registration.fromJson,
              updateHandler: registration.updateHandler,
            );
            await repo.fetchConfiguration();
            // Don't store in _moduleRepositories — let getModuleRepository<T>
            // create the properly typed version on first typed access.
          }
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Failed to fetch configuration for module $moduleName: ${e.toString()}',
          );
        }
      }
    }

    // Fetch from already-created plugin repositories
    for (final pluginName in registeredPlugins) {
      try {
        if (_pluginRepositories.containsKey(pluginName)) {
          final ModuleConfigRepository<Model> repo =
              _pluginRepositories[pluginName] as ModuleConfigRepository<Model>;
          await repo.fetchConfiguration();
        } else {
          final registration = _registrationService.getPluginRegistration(pluginName);
          if (registration != null) {
            final repo = ModuleConfigRepository<Model>(
              moduleName: pluginName,
              apiClient: _apiClient,
              dio: _dio,
              fromJson: registration.fromJson,
              updateHandler: registration.updateHandler,
            );
            await repo.fetchConfiguration();
          }
        }
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
