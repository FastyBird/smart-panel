import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:flutter/cupertino.dart';

class DayWeatherModel {
  final DayType day;
  final double temp;
  final int humidity;
  final String condition;
  final IconData icon;

  DayWeatherModel({
    required this.day,
    required this.temp,
    required this.humidity,
    required this.condition,
    required this.icon,
  });
}

class ForecastWeatherModel {
  final DayType day;
  final ForecastTemperature temp;
  final int humidity;
  final int pop;
  final double? rain;
  final double? snow;
  final String condition;
  final IconData icon;

  ForecastWeatherModel({
    required this.day,
    required this.temp,
    required this.humidity,
    required this.pop,
    this.rain,
    this.snow,
    required this.condition,
    required this.icon,
  });
}

class ForecastTemperature {
  final double morn;
  final double day;
  final double night;
  final double eve;
  final double min;
  final double max;

  ForecastTemperature({
    required this.morn,
    required this.day,
    required this.night,
    required this.eve,
    required this.min,
    required this.max,
  });
}

class WeatherModel {
  final DayWeatherModel current;
  final List<ForecastWeatherModel> forecast;

  WeatherModel({
    required this.current,
    required this.forecast,
  });
}
