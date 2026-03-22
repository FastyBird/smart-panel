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
  ///
  /// Uses `is` type check instead of `as` cast to handle AOT generic type
  /// erasure. If a repository was previously stored with a different type
  /// parameter (e.g., base `Model` from an untyped call), it is discarded
  /// and recreated with the correct concrete type.
  ModuleConfigRepository<T> getModuleRepository<T extends Model>(String moduleName) {
    final stored = _moduleRepositories[moduleName];

    if (stored != null && stored is ModuleConfigRepository<T>) {
      return stored;
    }

    // Either no repo exists, or stored repo has incompatible type in AOT mode.
    final registration = _registrationService.getModuleRegistration(moduleName);
    if (registration == null) {
      throw Exception('Module $moduleName is not registered');
    }

    final repo = ModuleConfigRepository<T>(
      moduleName: moduleName,
      apiClient: _apiClient,
      dio: _dio,
      fromJson: registration.fromJson as T Function(Map<String, dynamic>),
      updateHandler: registration.updateHandler,
    );
    _moduleRepositories[moduleName] = repo;

    return repo;
  }

  /// Get or create repository for a plugin.
  ///
  /// Same AOT-safe type check as [getModuleRepository].
  ModuleConfigRepository<T> getPluginRepository<T extends Model>(String pluginName) {
    final stored = _pluginRepositories[pluginName];

    if (stored != null && stored is ModuleConfigRepository<T>) {
      return stored;
    }

    final registration = _registrationService.getPluginRegistration(pluginName);
    if (registration == null) {
      throw Exception('Plugin $pluginName is not registered');
    }

    final repo = ModuleConfigRepository<T>(
      moduleName: pluginName,
      apiClient: _apiClient,
      dio: _dio,
      fromJson: registration.fromJson as T Function(Map<String, dynamic>),
      updateHandler: registration.updateHandler,
    );
    _pluginRepositories[pluginName] = repo;

    return repo;
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

    // Fetch from already-created module repositories.
    // Uses dynamic dispatch to avoid AOT generic type cast failures.
    for (final moduleName in registeredModules) {
      try {
        if (_moduleRepositories.containsKey(moduleName)) {
          // Dynamic dispatch — the stored repo has a concrete type parameter
          // that may differ from <Model>, so we avoid casting entirely.
          await (_moduleRepositories[moduleName] as dynamic).fetchConfiguration();
        } else {
          // Create a temporary repo for fetching only — don't store it.
          // getModuleRepository<T> will create the properly typed version
          // on first typed access.
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

    // Fetch from already-created plugin repositories.
    for (final pluginName in registeredPlugins) {
      try {
        if (_pluginRepositories.containsKey(pluginName)) {
          await (_pluginRepositories[pluginName] as dynamic).fetchConfiguration();
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
