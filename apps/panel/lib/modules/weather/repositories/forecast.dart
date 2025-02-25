import 'dart:convert';

import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';

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

  Future<void> insertForecastWeather(List<Map<String, dynamic>> json) async {
    late List<ForecastDayModel> insertData = [];

    for (var row in json) {
      try {
        ForecastDayModel day = ForecastDayModel.fromJson(row);

        insertData.add(day);
      } catch (e) {
        /// Failed to create new model
      }
    }

    if (data != insertData) {
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

        insertForecastWeather(forecast);
      },
      'fetch forecast weather',
    );
  }
}
