import 'dart:convert';

import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/repository.dart';

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

  Future<void> insertCurrentWeather(Map<String, dynamic> json) async {
    data = CurrentDayModel.fromJson(json);
  }

  Future<void> fetchWeather() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getWeatherModuleCurrent();

        final data = response.data.data;

        insertCurrentWeather(jsonDecode(jsonEncode(data)));
      },
      'fetch current weather',
    );
  }
}
