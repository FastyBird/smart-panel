import 'package:flutter/cupertino.dart';

class DayWeatherModel {
  final String day;
  final String temp;
  final String condition;
  final IconData icon;

  DayWeatherModel({
    required this.day,
    required this.temp,
    required this.condition,
    required this.icon,
  });
}

class WeatherModel {
  final DayWeatherModel current;
  final List<DayWeatherModel> forecast;

  WeatherModel({
    required this.current,
    required this.forecast,
  });
}
