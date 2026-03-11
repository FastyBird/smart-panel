import 'package:fastybird_smart_panel/api/models/weather_module_data_forecast_day.dart';
import 'package:fastybird_smart_panel/api/models/weather_module_data_location_weather.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_feels_like.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_temperature.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ForecastWeatherRepository extends Repository<List<ForecastDayModel>> {
  /// Per-location forecast data storage
  final Map<String, List<ForecastDayModel>> _locationData = {};

  /// Provider for the primary location ID from config.
  String? Function()? _primaryLocationIdProvider;

  ForecastWeatherRepository({required super.apiClient});

  /// Set a function to provide the primary location ID.
  void setPrimaryLocationIdProvider(String? Function() provider) {
    _primaryLocationIdProvider = provider;
  }

  /// Get forecast data for a specific location
  List<ForecastDayModel>? getByLocation(String locationId) {
    return _locationData[locationId];
  }

  /// Get all stored location forecast data
  Map<String, List<ForecastDayModel>> get allLocationData =>
      Map.unmodifiable(_locationData);

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertForecast(
    List<Map<String, dynamic>> json, {
    String? locationId,
  }) async {
    late List<ForecastDayModel> insertData = [];

    for (var row in json) {
      try {
        ForecastDayModel day = ForecastDayModel.fromJson(row);

        insertData.add(day);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][FORECAST] Failed to create forecast model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    bool changed = false;

    // Store by location if locationId provided
    if (locationId != null) {
      final existingData = _locationData[locationId];
      if (existingData != insertData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][FORECAST] Weather forecast for location $locationId was successfully updated',
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
          '[WEATHER MODULE][FORECAST] Weather forecast was successfully updated (primary: $locationId)',
        );
      }

      data = insertData;
      changed = true;
    }

    if (changed) {
      notifyListeners();
    }
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleAllWeather();

        await loadFromApiData(response.data.data);
      },
      'fetch forecast weather',
    );
  }

  /// Load forecast data from pre-fetched API data without making an API call.
  Future<void> loadFromApiData(
    List<WeatherModuleDataLocationWeather> allWeather,
  ) async {
    for (final locationWeather in allWeather) {
      final forecastModels = locationWeather.forecast
          .map((day) => _mapApiModelToForecastDay(day))
          .toList();
      final locationId = locationWeather.locationId;

      await _insertForecastModels(forecastModels, locationId: locationId);
    }

    if (kDebugMode) {
      debugPrint(
        '[WEATHER MODULE][FORECAST] Fetched forecast for ${allWeather.length} locations',
      );
    }
  }

  /// Map API model to panel ForecastDayModel directly to avoid serialization issues
  ForecastDayModel _mapApiModelToForecastDay(WeatherModuleDataForecastDay api) {
    return ForecastDayModel(
      temperature: ForecastTemperatureModel(
        morn: api.temperature.morn?.toDouble(),
        day: api.temperature.day?.toDouble(),
        eve: api.temperature.eve?.toDouble(),
        night: api.temperature.night?.toDouble(),
        min: api.temperature.min?.toDouble(),
        max: api.temperature.max?.toDouble(),
      ),
      feelsLike: ForecastFeelsLikeModel(
        morn: api.feelsLike.morn?.toDouble(),
        day: api.feelsLike.day?.toDouble(),
        eve: api.feelsLike.eve?.toDouble(),
        night: api.feelsLike.night?.toDouble(),
      ),
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
      sunrise: api.sunrise,
      sunset: api.sunset,
      moonrise: api.moonrise,
      moonset: api.moonset,
      dayTime: api.dayTime,
    );
  }

  /// Insert ForecastDayModel list directly without JSON conversion
  Future<void> _insertForecastModels(
    List<ForecastDayModel> insertData, {
    String? locationId,
  }) async {
    bool changed = false;

    // Store by location if locationId provided
    if (locationId != null) {
      final existingData = _locationData[locationId];
      if (existingData != insertData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][FORECAST] Weather forecast for location $locationId was successfully updated',
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
          '[WEATHER MODULE][FORECAST] Weather forecast was successfully updated (primary: $locationId)',
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
  /// Call this when the primary location ID changes (e.g., display override changed).
  void reresolvePrimary() {
    final primaryId = _primaryLocationIdProvider?.call();

    if (primaryId != null && _locationData.containsKey(primaryId)) {
      final primaryData = _locationData[primaryId]!;

      if (data != primaryData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][FORECAST] Re-resolved primary location to $primaryId',
          );
        }

        data = primaryData;
        notifyListeners();
      }
    } else if (primaryId == null && _locationData.isNotEmpty) {
      // No primary set, use first available
      final firstData = _locationData.values.first;

      if (data != firstData) {
        data = firstData;
        notifyListeners();
      }
    }
  }

  /// Remove forecast data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
