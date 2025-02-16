import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/weather_location_weather.dart';
import 'package:fastybird_smart_panel/api/weather_module/weather_module_client.dart';
import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:flutter/foundation.dart';

class WeatherModuleRepository extends ChangeNotifier {
  final WeatherModuleClient _apiClient;

  late CurrentDayModel? _currentWeather;
  late List<ForecastDayModel> _forecast = [];

  bool _isLoading = true;

  WeatherModuleRepository({
    required WeatherModuleClient apiClient,
  }) : _apiClient = apiClient;

  Future<void> initialize() async {
    _isLoading = true;

    try {
      await _loadWeather();
    } catch (e) {
      // Failed to fetch weather
      _currentWeather = null;
      _forecast = [];
    }

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  CurrentDayModel? get currentWeather => _currentWeather;

  List<ForecastDayModel> get forecast => _forecast;

  Future<bool> refresh() async {
    try {
      await _loadWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> _loadWeather() async {
    var resConfig = await _fetchWeather();

    _currentWeather = CurrentDayModel(
      temperature: resConfig.current.temperature.toDouble(),
      temperatureMin: resConfig.current.temperatureMin?.toDouble(),
      temperatureMax: resConfig.current.temperatureMax?.toDouble(),
      feelsLike: resConfig.current.feelsLike.toDouble(),
      pressure: resConfig.current.pressure.toInt(),
      humidity: resConfig.current.humidity.toInt(),
      weather: WeatherInfoModel(
        code: resConfig.current.weather.code.toInt(),
        main: resConfig.current.weather.main,
        description: resConfig.current.weather.description,
        icon: resConfig.current.weather.icon,
      ),
      wind: WindModel(
        speed: resConfig.current.wind.speed.toDouble(),
        deg: resConfig.current.wind.deg.toInt(),
        gust: resConfig.current.wind.gust?.toDouble(),
      ),
      clouds: resConfig.current.clouds.toDouble(),
      rain: resConfig.current.rain?.toDouble(),
      snow: resConfig.current.snow?.toDouble(),
      sunrise: resConfig.current.sunrise,
      sunset: resConfig.current.sunset,
      dayTime: resConfig.current.dayTime,
    );

    _forecast = resConfig.forecast
        .map((day) => ForecastDayModel(
              temperature: ForecastTemperatureModel(
                morn: day.temperature.morn?.toDouble(),
                day: day.temperature.day?.toDouble(),
                eve: day.temperature.eve?.toDouble(),
                night: day.temperature.night?.toDouble(),
                min: day.temperature.min?.toDouble(),
                max: day.temperature.max?.toDouble(),
              ),
              feelsLike: ForecastFeelsLikeModel(
                morn: day.feelsLike.morn?.toDouble(),
                day: day.feelsLike.day?.toDouble(),
                eve: day.feelsLike.eve?.toDouble(),
                night: day.feelsLike.night?.toDouble(),
              ),
              pressure: day.pressure.toInt(),
              humidity: day.humidity.toInt(),
              weather: WeatherInfoModel(
                code: day.weather.code.toInt(),
                main: day.weather.main,
                description: day.weather.description,
                icon: day.weather.icon,
              ),
              wind: WindModel(
                speed: day.wind.speed.toDouble(),
                deg: day.wind.deg.toInt(),
                gust: day.wind.gust?.toDouble(),
              ),
              clouds: day.clouds.toDouble(),
              rain: day.rain?.toDouble(),
              snow: day.snow?.toDouble(),
              sunrise: day.sunrise,
              sunset: day.sunset,
              moonrise: day.moonrise,
              moonset: day.moonset,
              dayTime: day.dayTime,
            ))
        .toList();
  }

  Future<WeatherLocationWeather> _fetchWeather() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getWeatherModuleWeather();

        return response.data.data;
      },
      'fetch weather',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
