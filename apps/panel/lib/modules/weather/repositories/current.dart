import 'dart:convert';

import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class CurrentWeatherRepository extends Repository<CurrentDayModel> {
  CurrentWeatherRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertWeather(Map<String, dynamic> json) async {
    try {
      CurrentDayModel newData = CurrentDayModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[WEATHER MODULE][DAY] Current day weather was successfully updated',
          );
        }

        data = newData;

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

        final data = response.data.data;

        insertWeather(jsonDecode(jsonEncode(data)));
      },
      'fetch current weather',
    );
  }
}
