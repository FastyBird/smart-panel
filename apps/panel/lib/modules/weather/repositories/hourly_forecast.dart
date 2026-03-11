import 'package:fastybird_smart_panel/modules/weather/models/forecast_hour.dart';
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

        // Access raw response JSON to get hourly_forecast data, since the
        // generated API type may not yet include this field
        final rawData = response.response.data as Map<String, dynamic>?;
        final rawDataList = rawData?['data'] as List<dynamic>?;

        if (rawDataList != null) {
          for (final rawLocationWeather in rawDataList) {
            if (rawLocationWeather is! Map<String, dynamic>) continue;

            final locationId = rawLocationWeather['location_id'] as String?;
            final hourlyForecastRaw = rawLocationWeather['hourly_forecast'];

            if (hourlyForecastRaw != null && hourlyForecastRaw is List && hourlyForecastRaw.isNotEmpty) {
              final hourlyModels = hourlyForecastRaw
                  .map((hour) => ForecastHourModel.fromJson(Map<String, dynamic>.from(hour)))
                  .toList();

              await _insertHourlyModels(hourlyModels, locationId: locationId);
            }
          }
        }

        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][HOURLY] Fetched hourly forecast for ${rawDataList?.length ?? 0} locations',
          );
        }
      },
      'fetch hourly forecast weather',
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
