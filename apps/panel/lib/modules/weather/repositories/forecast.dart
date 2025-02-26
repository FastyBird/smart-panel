import 'dart:convert';

import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ForecastWeatherRepository extends Repository<List<ForecastDayModel>> {
  ForecastWeatherRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchWeather();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertForecast(List<Map<String, dynamic>> json) async {
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

    if (data != insertData) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][FORECAST] Weather forecast was successfully updated',
        );
      }

      data = insertData;

      notifyListeners();
    }
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleForecast();

        final data = response.data.data;

        List<Map<String, dynamic>> forecast = [];

        for (var day in data) {
          forecast.add(jsonDecode(jsonEncode(day)));
        }

        insertForecast(forecast);
      },
      'fetch forecast weather',
    );
  }
}
