import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/constants.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/language.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart' as system_module;
import 'package:fastybird_smart_panel/modules/weather/export.dart' as weather_module;
import 'package:flutter/foundation.dart';

class ConfigModuleService {
  final SocketService _socketService;

  late LanguageConfigRepository _languageRepository;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _languageRepository = LanguageConfigRepository(
      apiClient: apiClient.configurationModule,
    );

    locator.registerSingleton(_languageRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeConfigData();

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

  Future<void> _initializeConfigData() async {
    await _languageRepository.fetchConfiguration();
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

    // Handle legacy language config update (for backward compatibility during migration)
    // This will be removed once all references are updated to use system module
    if (payload.containsKey('language') &&
        payload['language'] is Map<String, dynamic>) {
      _languageRepository.insertConfiguration(payload['language']);
    }
  }
}
