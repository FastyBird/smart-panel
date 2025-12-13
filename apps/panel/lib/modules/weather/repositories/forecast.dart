import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
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
        final response = await apiClient.getWeatherModuleForecast();

        final raw = response.response.data['data'] as List;

        // Try to extract location_id from the first item if available
        String? locationId;
        if (raw.isNotEmpty && raw.first is Map<String, dynamic>) {
          locationId = (raw.first as Map<String, dynamic>)['location_id'] as String?;
        }

        insertForecast(raw.cast<Map<String, dynamic>>(), locationId: locationId);
      },
      'fetch forecast weather',
    );
  }

  /// Remove forecast data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
