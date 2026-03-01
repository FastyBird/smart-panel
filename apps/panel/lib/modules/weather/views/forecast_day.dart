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

  int get pressure => weatherModel.pressure;

  double get windSpeed => weatherModel.wind.speed;

  int get windDeg => weatherModel.wind.deg;

  double? get windGust => weatherModel.wind.gust;

  double get clouds => weatherModel.clouds;

  double? get rain => weatherModel.rain;

  double? get snow => weatherModel.snow;

  double? get temperatureMin => weatherModel.temperature.min;

  double? get temperatureMax => weatherModel.temperature.max;

  DateTime? get sunrise => weatherModel.sunrise;

  DateTime? get sunset => weatherModel.sunset;

  DateTime? get moonrise => weatherModel.moonrise;

  DateTime? get moonset => weatherModel.moonset;
}
