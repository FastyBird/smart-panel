import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/constants.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/hourly_forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/locations.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/foundation.dart';

class WeatherModuleService {
  final SocketService _socketService;

  late CurrentWeatherRepository _currentWeatherRepository;
  late ForecastWeatherRepository _forecastWeatherRepository;
  late HourlyForecastWeatherRepository _hourlyForecastWeatherRepository;
  late LocationsRepository _locationsRepository;

  late WeatherService _weatherService;
  late ModuleConfigRepository<WeatherConfigModel> _weatherConfigRepo;

  bool _isLoading = true;

  /// Track display listener for cleanup
  VoidCallback? _displayListener;
  /// Track weather config listener for cleanup
  VoidCallback? _weatherConfigListener;
  /// Track last known resolved location ID to detect changes
  String? _lastResolvedLocationId;

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
    _hourlyForecastWeatherRepository = HourlyForecastWeatherRepository(
      apiClient: apiClient.weatherModule,
    );
    _locationsRepository = LocationsRepository(
      apiClient: apiClient.weatherModule,
    );

    locator.registerSingleton(_currentWeatherRepository);
    locator.registerSingleton(_forecastWeatherRepository);
    locator.registerSingleton(_hourlyForecastWeatherRepository);
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
    _weatherConfigRepo = configModule.getModuleRepository<WeatherConfigModel>('weather-module');

    // Resolve weather location: display override > weather config primary
    String? resolveLocationId() {
      try {
        final displayRepo = locator<DisplayRepository>();
        final displayOverride = displayRepo.weatherLocationId;
        if (displayOverride != null) return displayOverride;
      } catch (_) {
        // Display repository not yet available
      }
      return _weatherConfigRepo.data?.primaryLocationId;
    }

    // Set up primary location provider so repositories can filter by primary location
    _locationsRepository.setPrimaryLocationIdProvider(resolveLocationId);
    _currentWeatherRepository.setPrimaryLocationIdProvider(resolveLocationId);
    _forecastWeatherRepository.setPrimaryLocationIdProvider(resolveLocationId);
    _hourlyForecastWeatherRepository.setPrimaryLocationIdProvider(resolveLocationId);

    // Create weather service with config from config module
    _weatherService = WeatherService(
      currentDayRepository: _currentWeatherRepository,
      forecastRepository: _forecastWeatherRepository,
      hourlyForecastRepository: _hourlyForecastWeatherRepository,
      locationsRepository: _locationsRepository,
      configurationRepository: _weatherConfigRepo,
    );

    locator.registerSingleton(_weatherService);

    // Fetch configuration (will be done by config module, but ensure it's loaded)
    await _weatherConfigRepo.fetchConfiguration();

    // Fetch locations first, then weather data
    await _initializeLocations();
    await _initializeWeatherData();

    await _weatherService.initialize();

    _isLoading = false;

    // Track the initial resolved location ID
    _lastResolvedLocationId = resolveLocationId();

    // Listen for display weatherLocationId changes to re-resolve primary weather data
    try {
      final displayRepo = locator<DisplayRepository>();

      _displayListener = () {
        _checkAndReresolvePrimary(resolveLocationId);
      };

      displayRepo.addListener(_displayListener!);
    } catch (_) {
      // Display repository not available
    }

    // Listen for weather config primaryLocationId changes to re-resolve primary weather data
    _weatherConfigListener = () {
      _checkAndReresolvePrimary(resolveLocationId);
    };

    _weatherConfigRepo.addListener(_weatherConfigListener!);

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

  /// Check if the resolved location ID changed and re-resolve if needed
  void _checkAndReresolvePrimary(String? Function() resolveLocationId) {
    final newResolvedId = resolveLocationId();

    if (newResolvedId != _lastResolvedLocationId) {
      _lastResolvedLocationId = newResolvedId;

      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE] Resolved weather location changed to: $newResolvedId — re-resolving primary',
        );
      }

      _currentWeatherRepository.reresolvePrimary();
      _forecastWeatherRepository.reresolvePrimary();
      _hourlyForecastWeatherRepository.reresolvePrimary();
    }
  }

  void dispose() {
    // Remove display listener
    if (_displayListener != null) {
      try {
        locator<DisplayRepository>().removeListener(_displayListener!);
      } catch (_) {
        // Display repository may already be disposed
      }
      _displayListener = null;
    }

    // Remove weather config listener
    if (_weatherConfigListener != null) {
      try {
        _weatherConfigRepo.removeListener(_weatherConfigListener!);
      } catch (_) {
        // Config repository may already be disposed
      }
      _weatherConfigListener = null;
    }

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
      await _hourlyForecastWeatherRepository.fetchWeather();
    } catch (e) {
      // This error could be ignored
    }
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    // Extract location_id from payload if available
    final locationId = payload['location_id'] as String?;

    if (payload.containsKey('current') &&
        payload['current'] is Map<String, dynamic>) {
      _currentWeatherRepository.insertWeather(
        payload['current'],
        locationId: locationId,
      );
    }

    if (payload.containsKey('forecast') && payload['forecast'] is List) {
      List<Map<String, dynamic>> mapped = (payload['forecast'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      _forecastWeatherRepository.insertForecast(
        mapped,
        locationId: locationId,
      );
    }

    if (payload.containsKey('hourly_forecast') && payload['hourly_forecast'] is List) {
      List<Map<String, dynamic>> mapped = (payload['hourly_forecast'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      _hourlyForecastWeatherRepository.insertHourlyForecast(
        mapped,
        locationId: locationId,
      );
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
      _hourlyForecastWeatherRepository.removeLocation(deletedId);
    }
  }
}
