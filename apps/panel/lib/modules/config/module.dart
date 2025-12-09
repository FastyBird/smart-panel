import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/constants.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/language.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/weather.dart';
import 'package:flutter/foundation.dart';

class ConfigModuleService {
  final SocketService _socketService;

  late LanguageConfigRepository _languageRepository;
  late WeatherConfigRepository _weatherRepository;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _languageRepository = LanguageConfigRepository(
      apiClient: apiClient.configurationModule,
    );
    _weatherRepository = WeatherConfigRepository(
      apiClient: apiClient.configurationModule,
    );

    locator.registerSingleton(_languageRepository);
    locator.registerSingleton(_weatherRepository);
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
    await _weatherRepository.fetchConfiguration();
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    if (payload.containsKey('language') &&
        payload['language'] is Map<String, dynamic>) {
      _languageRepository.insertConfiguration(payload['language']);
    }

    if (payload.containsKey('weather') &&
        payload['weather'] is Map<String, dynamic>) {
      _weatherRepository.insertConfiguration(payload['weather']);
    }
  }
}
