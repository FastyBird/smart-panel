import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/constants.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart' as system_module;
import 'package:fastybird_smart_panel/modules/weather/export.dart' as weather_module;
import 'package:flutter/foundation.dart';

class ConfigModuleService {
  final SocketService _socketService;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    // Language and weather config repositories moved to their respective modules
    // SystemConfigRepository handles language settings
    // WeatherConfigRepository handles weather settings
  }

  Future<void> initialize() async {
    _isLoading = true;

    // No initialization needed - repositories are initialized by their respective modules
    // SystemConfigRepository is initialized by SystemModuleService
    // WeatherConfigRepository is initialized by WeatherModuleService

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
      
      // Weather module config update
      if (modules.containsKey('weather-module') &&
          modules['weather-module'] is Map<String, dynamic>) {
        final weatherConfigRepo = locator<weather_module.WeatherConfigRepository>();
        weatherConfigRepo.insertConfiguration(modules['weather-module'] as Map<String, dynamic>);
      }
      
      // System module config update (includes language settings)
      if (modules.containsKey('system-module') &&
          modules['system-module'] is Map<String, dynamic>) {
        final systemConfigRepo = locator<system_module.SystemConfigRepository>();
        systemConfigRepo.insertConfiguration(modules['system-module'] as Map<String, dynamic>);
      }
    }

    // Legacy language config updates are now handled via system-module updates above
  }
}
