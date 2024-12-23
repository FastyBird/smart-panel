import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:flutter/material.dart';

class WeatherRepository extends ChangeNotifier {
  late WeatherModel _weather;

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    _weather = WeatherModel(
      current: DayWeatherModel(
        day: 'Mon',
        temp: '12°C',
        condition: 'Partly Cloudy',
        icon: Icons.sunny,
      ),
      forecast: [
        DayWeatherModel(
          day: 'Mon',
          temp: '18°C',
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        DayWeatherModel(
          day: 'Tue',
          temp: '20°C',
          condition: 'Partly Cloudy',
          icon: Icons.sunny,
        ),
        DayWeatherModel(
          day: 'Wed',
          temp: '15°C',
          condition: 'Partly Cloudy',
          icon: Icons.sunny_snowing,
        ),
        DayWeatherModel(
          day: 'Thu',
          temp: '15°C',
          condition: 'Partly Cloudy',
          icon: Icons.cloudy_snowing,
        ),
        DayWeatherModel(
          day: 'Fri',
          temp: '15°C',
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        DayWeatherModel(
          day: 'Sat',
          temp: '15°C',
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        DayWeatherModel(
          day: 'Sun',
          temp: '15°C',
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
      ],
    );

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  WeatherModel get weather => _weather;
}
