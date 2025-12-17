import 'package:fastybird_smart_panel/api/models/weather_module_data_forecast_day.dart';
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

  ForecastWeatherRepository({required super.apiClient});

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

    // Also update the primary/global data
    if (data != insertData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][FORECAST] Weather forecast was successfully updated',
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

        final allWeather = response.data.data;

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
      },
      'fetch forecast weather',
    );
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

    // Also update the primary/global data
    if (data != insertData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][FORECAST] Weather forecast was successfully updated',
        );
      }

      data = insertData;
      changed = true;
    }

    if (changed) {
      notifyListeners();
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
