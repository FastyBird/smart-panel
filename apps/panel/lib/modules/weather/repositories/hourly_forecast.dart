import 'package:fastybird_smart_panel/api/models/weather_module_data_forecast_hour.dart';
import 'package:fastybird_smart_panel/api/models/weather_module_data_location_weather.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_hour.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class HourlyForecastWeatherRepository extends Repository<List<ForecastHourModel>> {
  /// Per-location hourly forecast data storage
  final Map<String, List<ForecastHourModel>> _locationData = {};

  /// Provider for the primary location ID from config.
  String? Function()? _primaryLocationIdProvider;

  HourlyForecastWeatherRepository({required super.apiClient});

  /// Set a function to provide the primary location ID.
  void setPrimaryLocationIdProvider(String? Function() provider) {
    _primaryLocationIdProvider = provider;
  }

  /// Get hourly forecast data for a specific location
  List<ForecastHourModel>? getByLocation(String locationId) {
    return _locationData[locationId];
  }

  /// Get all stored location hourly forecast data
  Map<String, List<ForecastHourModel>> get allLocationData =>
      Map.unmodifiable(_locationData);

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertHourlyForecast(
    List<Map<String, dynamic>> json, {
    String? locationId,
  }) async {
    List<ForecastHourModel> insertData = [];

    for (var row in json) {
      try {
        ForecastHourModel hour = ForecastHourModel.fromJson(row);
        insertData.add(hour);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][HOURLY] Failed to create hourly forecast model: ${e.toString()}',
          );
        }
      }
    }

    await _insertHourlyModels(insertData, locationId: locationId);
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleAllWeather();

        await loadFromApiData(response.data.data);
      },
      'fetch hourly forecast weather',
    );
  }

  /// Load hourly forecast from pre-fetched API data without making an API call.
  Future<void> loadFromApiData(
    List<WeatherModuleDataLocationWeather> allWeather,
  ) async {
    for (final locationWeather in allWeather) {
      final hourlyForecast = locationWeather.hourlyForecast;

      if (hourlyForecast != null && hourlyForecast.isNotEmpty) {
        final hourlyModels = hourlyForecast
            .map((hour) => _mapApiModelToForecastHour(hour))
            .toList();
        final locationId = locationWeather.locationId;

        await _insertHourlyModels(hourlyModels, locationId: locationId);
      }
    }

    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE][HOURLY] Fetched hourly forecast for ${allWeather.length} locations',
      );
    }
  }

  /// Map API model to panel ForecastHourModel
  ForecastHourModel _mapApiModelToForecastHour(WeatherModuleDataForecastHour api) {
    return ForecastHourModel(
      temperature: api.temperature.toDouble(),
      feelsLike: api.feelsLike.toDouble(),
      pressure: api.pressure.toInt(),
      humidity: api.humidity.toInt(),
      weather: WeatherInfoModel(
        code: api.weather.code,
        main: api.weather.main,
        description: api.weather.description,
        icon: api.weather.icon,
      ),
      wind: WindModel(
        speed: api.wind.speed.toDouble(),
        deg: api.wind.deg.toInt(),
        gust: api.wind.gust?.toDouble(),
      ),
      clouds: api.clouds.toDouble(),
      rain: api.rain?.toDouble(),
      snow: api.snow?.toDouble(),
      dateTime: api.dateTime,
    );
  }

  /// Insert ForecastHourModel list directly
  Future<void> _insertHourlyModels(
    List<ForecastHourModel> insertData, {
    String? locationId,
  }) async {
    bool changed = false;

    // Store by location if locationId provided
    if (locationId != null) {
      final existingData = _locationData[locationId];
      if (existingData != insertData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][HOURLY] Hourly forecast for location $locationId was successfully updated',
          );
        }

        _locationData[locationId] = insertData;
        changed = true;
      }
    }

    // Update global data only for the primary location (or if no location specified)
    final primaryId = _primaryLocationIdProvider?.call();
    final isPrimary = locationId == null || locationId == primaryId || primaryId == null;

    if (isPrimary && data != insertData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][HOURLY] Hourly forecast was successfully updated (primary: $locationId)',
        );
      }

      data = insertData;
      changed = true;
    }

    if (changed) {
      notifyListeners();
    }
  }

  /// Re-resolve which location's data should be the global `data`.
  void reresolvePrimary() {
    final primaryId = _primaryLocationIdProvider?.call();

    if (primaryId != null && _locationData.containsKey(primaryId)) {
      final primaryData = _locationData[primaryId]!;

      if (data != primaryData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][HOURLY] Re-resolved primary location to $primaryId',
          );
        }

        data = primaryData;
        notifyListeners();
      }
    } else if (primaryId == null && _locationData.isNotEmpty) {
      final firstData = _locationData.values.first;

      if (data != firstData) {
        data = firstData;
        notifyListeners();
      }
    }
  }

  /// Remove hourly forecast data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
