import 'package:fastybird_smart_panel/api/models/weather_module_data_current_day.dart';
import 'package:fastybird_smart_panel/api/models/weather_module_data_location_weather.dart';
import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class CurrentWeatherRepository extends Repository<CurrentDayModel> {
  /// Per-location weather data storage
  final Map<String, CurrentDayModel> _locationData = {};

  /// Provider for the primary location ID from config.
  String? Function()? _primaryLocationIdProvider;

  CurrentWeatherRepository({required super.apiClient});

  /// Set a function to provide the primary location ID.
  void setPrimaryLocationIdProvider(String? Function() provider) {
    _primaryLocationIdProvider = provider;
  }

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

      await _insertCurrentDayModel(newData, locationId: locationId);
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

        await loadFromApiData(response.data.data);
      },
      'fetch current weather',
    );
  }

  /// Load current weather from pre-fetched API data without making an API call.
  Future<void> loadFromApiData(
    List<WeatherModuleDataLocationWeather> allWeather,
  ) async {
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

    // Update global data only for the primary location (or if no location specified)
    final primaryId = _primaryLocationIdProvider?.call();
    final isPrimary = locationId == null || locationId == primaryId || primaryId == null;

    if (isPrimary && data != newData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][DAY] Current day weather was successfully updated (primary: $locationId)',
        );
      }

      data = newData;
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
            '[WEATHER MODULE][DAY] Re-resolved primary location to $primaryId',
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

  /// Remove weather data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
