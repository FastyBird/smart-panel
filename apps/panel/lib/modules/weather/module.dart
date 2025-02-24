import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';

class WeatherModuleService {
  late CurrentWeatherRepository _currentWeatherRepository;

  late ForecastWeatherRepository _forecastWeatherRepository;

  bool _isLoading = true;

  WeatherModuleService({
    required ApiClient apiClient,
  }) {
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

    await _initializeWeatherData();

    _isLoading = false;
  }

  bool get isLoading => _isLoading;

  Future<void> _initializeWeatherData() async {
    try {
      await _currentWeatherRepository.fetchWeather();
      await _forecastWeatherRepository.fetchWeather();
    } catch (e) {
      // This error could be ignored
    }
  }
}
