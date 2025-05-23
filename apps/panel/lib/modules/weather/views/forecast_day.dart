import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/view.dart';

class ForecastDayView extends WeatherView<ForecastDayModel> {
  ForecastDayView({
    required super.weatherModel,
    required super.configModel,
  });

  double? get temperatureMorn => weatherModel.temperature.morn;

  double? get temperatureDay => weatherModel.temperature.day;

  double? get temperatureEve => weatherModel.temperature.eve;

  double? get temperatureNight => weatherModel.temperature.night;

  DateTime get dayTime => weatherModel.dayTime;

  String get weatherMain => weatherModel.weather.main;

  int get weatherCode => weatherModel.weather.code;

  int get humidity => weatherModel.humidity;
}
