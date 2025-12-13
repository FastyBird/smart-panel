import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
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
        final response = await apiClient.getWeatherModuleCurrent();

        final raw = response.response.data['data'] as Map<String, dynamic>;

        // Extract location_id if present in response
        final locationId = raw['location_id'] as String?;

        insertWeather(raw, locationId: locationId);
      },
      'fetch current weather',
    );
  }

  /// Remove weather data for a specific location
  void removeLocation(String locationId) {
    if (_locationData.containsKey(locationId)) {
      _locationData.remove(locationId);
      notifyListeners();
    }
  }
}
