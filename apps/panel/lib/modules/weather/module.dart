import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/constants.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/locations.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/foundation.dart';

class WeatherModuleService {
  final SocketService _socketService;

  late CurrentWeatherRepository _currentWeatherRepository;
  late ForecastWeatherRepository _forecastWeatherRepository;
  late LocationsRepository _locationsRepository;

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
    _locationsRepository = LocationsRepository(
      apiClient: apiClient.weatherModule,
    );

    locator.registerSingleton(_currentWeatherRepository);
    locator.registerSingleton(_forecastWeatherRepository);
    locator.registerSingleton(_locationsRepository);
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

    // Set up primary location provider so locations repository can use it for auto-selection
    _locationsRepository.setPrimaryLocationIdProvider(
      () => weatherConfigRepo.data?.primaryLocationId,
    );

    // Create weather service with config from config module
    _weatherService = WeatherService(
      currentDayRepository: _currentWeatherRepository,
      forecastRepository: _forecastWeatherRepository,
      locationsRepository: _locationsRepository,
      configurationRepository: weatherConfigRepo,
    );

    locator.registerSingleton(_weatherService);

    // Fetch configuration (will be done by config module, but ensure it's loaded)
    await weatherConfigRepo.fetchConfiguration();

    // Fetch locations first, then weather data
    await _initializeLocations();
    await _initializeWeatherData();

    await _weatherService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      WeatherModuleConstants.weatherInfoEvent,
      _socketEventHandler,
    );

    // Register location change event handlers
    _socketService.registerEventHandler(
      WeatherModuleConstants.locationCreatedEvent,
      _locationCreatedHandler,
    );
    _socketService.registerEventHandler(
      WeatherModuleConstants.locationUpdatedEvent,
      _locationUpdatedHandler,
    );
    _socketService.registerEventHandler(
      WeatherModuleConstants.locationDeletedEvent,
      _locationDeletedHandler,
    );
  }

  Future<bool> _updateWeatherConfig(String name, Map<String, dynamic> data) async {
    // Custom update handler for weather config
    try {
      final configModule = locator<ConfigModuleService>();
      final repo = configModule.getModuleRepository<WeatherConfigModel>(name);

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
        if (data.containsKey('primary_location_id'))
          'primary_location_id': data['primary_location_id'],
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

  bool get isLoading => _isLoading;

  LocationsRepository get locationsRepository => _locationsRepository;

  void dispose() {
    _socketService.unregisterEventHandler(
      WeatherModuleConstants.weatherInfoEvent,
      _socketEventHandler,
    );
    _socketService.unregisterEventHandler(
      WeatherModuleConstants.locationCreatedEvent,
      _locationCreatedHandler,
    );
    _socketService.unregisterEventHandler(
      WeatherModuleConstants.locationUpdatedEvent,
      _locationUpdatedHandler,
    );
    _socketService.unregisterEventHandler(
      WeatherModuleConstants.locationDeletedEvent,
      _locationDeletedHandler,
    );
  }

  Future<void> _initializeLocations() async {
    try {
      await _locationsRepository.fetchLocations();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE] Error fetching locations: ${e.toString()}',
        );
      }
      // Locations fetch error is not critical - weather may still work with default
    }
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

  void _locationCreatedHandler(String event, Map<String, dynamic> payload) {
    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE] Location created event received: ${payload['id']}',
      );
    }
    // Refresh the locations list to include the new location
    _locationsRepository.refresh();
  }

  void _locationUpdatedHandler(String event, Map<String, dynamic> payload) {
    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE] Location updated event received: ${payload['id']}',
      );
    }
    // Refresh the locations list to get updated data
    _locationsRepository.refresh();
  }

  void _locationDeletedHandler(String event, Map<String, dynamic> payload) {
    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE] Location deleted event received: ${payload['id']}',
      );
    }
    // Remove the deleted location from local data and refresh
    final deletedId = payload['id'] as String?;
    if (deletedId != null) {
      _locationsRepository.removeLocation(deletedId);
    }
  }
}
