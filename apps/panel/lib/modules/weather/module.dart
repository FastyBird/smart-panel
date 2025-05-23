import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/constants.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';

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

    _weatherService = WeatherService(
      currentDayRepository: _currentWeatherRepository,
      forecastRepository: _forecastWeatherRepository,
      configurationRepository: locator<WeatherConfigRepository>(),
    );

    locator.registerSingleton(_currentWeatherRepository);
    locator.registerSingleton(_forecastWeatherRepository);

    locator.registerSingleton(_weatherService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeWeatherData();

    await _weatherService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      WeatherModuleConstants.weatherInfoEvent,
      _socketEventHandler,
    );
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
