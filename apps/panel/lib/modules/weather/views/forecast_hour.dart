import 'package:fastybird_smart_panel/modules/weather/models/forecast_hour.dart';
import 'package:fastybird_smart_panel/modules/weather/views/view.dart';

class ForecastHourView extends WeatherView<ForecastHourModel> {
  ForecastHourView({
    required super.weatherModel,
    required super.configModel,
  });

  double get temperature => weatherModel.temperature;

  double get feelsLike => weatherModel.feelsLike;

  int get pressure => weatherModel.pressure;

  int get humidity => weatherModel.humidity;

  int get weatherCode => weatherModel.weather.code;

  String get weatherMain => weatherModel.weather.main;

  double get windSpeed => weatherModel.wind.speed;

  int get windDeg => weatherModel.wind.deg;

  double? get windGust => weatherModel.wind.gust;

  double get clouds => weatherModel.clouds;

  double? get rain => weatherModel.rain;

  double? get snow => weatherModel.snow;

  DateTime get dateTime => weatherModel.dateTime;
}
