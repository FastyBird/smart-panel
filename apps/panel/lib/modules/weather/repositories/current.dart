import 'package:fastybird_smart_panel/api/models/weather_module_data_current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class CurrentWeatherRepository extends Repository<CurrentDayModel> {
  /// Per-location weather data storage
  final Map<String, CurrentDayModel> _locationData = {};

  CurrentWeatherRepository({required super.apiClient});

  /// Get weather data for a specific location
  CurrentDayModel? getByLocation(String locationId) {
    return _locationData[locationId];
  }

  /// Get all stored location weather data
  Map<String, CurrentDayModel> get allLocationData =>
      Map.unmodifiable(_locationData);

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertWeather(
    Map<String, dynamic> json, {
    String? locationId,
  }) async {
    try {
      CurrentDayModel newData = CurrentDayModel.fromJson(json);

      bool changed = false;

      // Store by location if locationId provided
      if (locationId != null) {
        final existingData = _locationData[locationId];
        if (existingData != newData) {
          if (kDebugMode) {
            debugPrint(
              '[WEATHER MODULE][DAY] Current day weather for location $locationId was successfully updated',
            );
          }

          _locationData[locationId] = newData;
          changed = true;
        }
      }

      // Also update the primary/global data
      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][DAY] Current day weather was successfully updated',
          );
        }

        data = newData;
        changed = true;
      }

      if (changed) {
        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][DAY] Failed to create day model: ${e.toString()}',
        );
      }

      /// Failed to create new model
    }
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleAllWeather();

        final allWeather = response.data.data;

        for (final locationWeather in allWeather) {
          final currentModel = _mapApiModelToCurrentDay(locationWeather.current);
          final locationId = locationWeather.locationId;

          await _insertCurrentDayModel(currentModel, locationId: locationId);
        }

        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][DAY] Fetched current weather for ${allWeather.length} locations',
          );
        }
      },
      'fetch current weather',
    );
  }

  /// Map API model to panel CurrentDayModel directly to avoid serialization issues
  CurrentDayModel _mapApiModelToCurrentDay(WeatherModuleDataCurrentDay api) {
    return CurrentDayModel(
      temperature: api.temperature.toDouble(),
      temperatureMin: api.temperatureMin?.toDouble(),
      temperatureMax: api.temperatureMax?.toDouble(),
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
      sunrise: api.sunrise,
      sunset: api.sunset,
      dayTime: api.dayTime,
    );
  }

  /// Insert CurrentDayModel directly without JSON conversion
  Future<void> _insertCurrentDayModel(
    CurrentDayModel newData, {
    String? locationId,
  }) async {
    bool changed = false;

    // Store by location if locationId provided
    if (locationId != null) {
      final existingData = _locationData[locationId];
      if (existingData != newData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][DAY] Current day weather for location $locationId was successfully updated',
          );
        }

        _locationData[locationId] = newData;
        changed = true;
      }
    }

    // Also update the primary/global data
    if (data != newData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][DAY] Current day weather was successfully updated',
        );
      }

      data = newData;
      changed = true;
    }

    if (changed) {
      notifyListeners();
    }
  }

  /// Remove weather data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
