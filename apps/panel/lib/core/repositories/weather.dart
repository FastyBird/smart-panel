import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
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
        day: DayType.monday,
        temp: 12.0,
        humidity: 44,
        condition: 'Partly Cloudy',
        icon: Icons.sunny,
      ),
      forecast: [
        ForecastWeatherModel(
          day: DayType.monday,
          temp: ForecastTemperature(
            morn: 18.0,
            day: 18.0,
            night: 18.0,
            eve: 18.0,
            min: 18.0,
            max: 18.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        ForecastWeatherModel(
          day: DayType.tuesday,
          temp: ForecastTemperature(
            morn: 20.0,
            day: 20.0,
            night: 20.0,
            eve: 20.0,
            min: 20.0,
            max: 20.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.sunny,
        ),
        ForecastWeatherModel(
          day: DayType.wednesday,
          temp: ForecastTemperature(
            morn: 15.0,
            day: 15.0,
            night: 15.0,
            eve: 15.0,
            min: 15.0,
            max: 15.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.sunny_snowing,
        ),
        ForecastWeatherModel(
          day: DayType.thursday,
          temp: ForecastTemperature(
            morn: 15.0,
            day: 15.0,
            night: 15.0,
            eve: 15.0,
            min: 15.0,
            max: 15.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.cloudy_snowing,
        ),
        ForecastWeatherModel(
          day: DayType.friday,
          temp: ForecastTemperature(
            morn: 15.0,
            day: 15.0,
            night: 15.0,
            eve: 15.0,
            min: 15.0,
            max: 15.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        ForecastWeatherModel(
          day: DayType.saturday,
          temp: ForecastTemperature(
            morn: 15.0,
            day: 15.0,
            night: 15.0,
            eve: 15.0,
            min: 15.0,
            max: 15.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
          condition: 'Partly Cloudy',
          icon: Icons.cloud,
        ),
        ForecastWeatherModel(
          day: DayType.sunday,
          temp: ForecastTemperature(
            morn: 15.0,
            day: 15.0,
            night: 15.0,
            eve: 15.0,
            min: 15.0,
            max: 15.0,
          ),
          humidity: 44,
          pop: 10,
          rain: 0.15,
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
