import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/weather/constants.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/foundation.dart';

class WeatherModuleService {
  final SocketService _socketService;

  late CurrentWeatherRepository _currentWeatherRepository;
  late ForecastWeatherRepository _forecastWeatherRepository;

  late WeatherService _weatherService;

  bool _isLoading = true;

  WeatherModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _currentWeatherRepository = CurrentWeatherRepository(
      apiClient: apiClient.weatherModule,
    );
    _forecastWeatherRepository = ForecastWeatherRepository(
      apiClient: apiClient.weatherModule,
    );

    locator.registerSingleton(_currentWeatherRepository);
    locator.registerSingleton(_forecastWeatherRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    // Register weather config model with config module
    final configModule = locator<ConfigModuleService>();
    configModule.registerModule<WeatherConfigModel>(
      'weather-module',
      WeatherConfigModel.fromJson,
      updateHandler: _updateWeatherConfig,
    );

    // Get weather config repository from config module
    final weatherConfigRepo = configModule.getModuleRepository<WeatherConfigModel>('weather-module');

    // Weather config is now managed by config module
    // No need to create wrapper or register separately

    // Create weather service with config from config module
    _weatherService = WeatherService(
      currentDayRepository: _currentWeatherRepository,
      forecastRepository: _forecastWeatherRepository,
      configurationRepository: weatherConfigRepo,
    );

    locator.registerSingleton(_weatherService);

    // Fetch configuration (will be done by config module, but ensure it's loaded)
    await weatherConfigRepo.fetchConfiguration();
    await _initializeWeatherData();

    await _weatherService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      WeatherModuleConstants.weatherInfoEvent,
      _socketEventHandler,
    );
  }

  Future<bool> _updateWeatherConfig(String name, Map<String, dynamic> data) async {
    // Custom update handler for weather config
    // This handles the update logic that was in WeatherConfigRepository.setWeatherUnit
    try {
      final configModule = locator<ConfigModuleService>();
      final repo = configModule.getModuleRepository<WeatherConfigModel>(name);
      
      // Build update data with all current fields
      final currentConfig = repo.data;
      if (currentConfig == null) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE] Cannot update config: current configuration is null',
          );
        }
        return false;
      }

      final updateDataMap = <String, dynamic>{
        'type': name,
        'location_type': _convertWeatherLocationTypeToApiString(currentConfig.locationType),
        'unit': data['unit'] ?? _convertWeatherUnitToApiString(currentConfig.unit),
        if (currentConfig.openWeatherApiKey != null)
          'open_weather_api_key': currentConfig.openWeatherApiKey,
      };

      // Use the repository's raw update method to avoid infinite recursion
      return await repo.updateConfigurationRaw(updateDataMap);
    } catch (e, stackTrace) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE] Error updating weather config: ${e.toString()}',
        );
        debugPrint('[WEATHER MODULE] Stack trace: $stackTrace');
      }
      return false;
    }
  }

  String _convertWeatherLocationTypeToApiString(WeatherLocationType locationType) {
    return locationType.value;
  }

  String _convertWeatherUnitToApiString(WeatherUnit unit) {
    return unit.value;
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      WeatherModuleConstants.weatherInfoEvent,
      _socketEventHandler,
    );
  }

  Future<void> _initializeWeatherData() async {
    try {
      await _currentWeatherRepository.fetchWeather();
      await _forecastWeatherRepository.fetchWeather();
    } catch (e) {
      // This error could be ignored
    }
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    if (payload.containsKey('current') &&
        payload['current'] is Map<String, dynamic>) {
      _currentWeatherRepository.insertWeather(payload['current']);
    }

    if (payload.containsKey('forecast') && payload['forecast'] is List) {
      List<Map<String, dynamic>> mapped = (payload['forecast'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      _forecastWeatherRepository.insertForecast(mapped);
    }
  }
}
