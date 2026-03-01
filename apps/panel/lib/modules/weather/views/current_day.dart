import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/view.dart';

class CurrentDayView extends WeatherView<CurrentDayModel> {
  CurrentDayView({
    required super.weatherModel,
    required super.configModel,
  });

  double get temperature => weatherModel.temperature;

  DateTime get sunrise => weatherModel.sunrise;

  DateTime get sunset => weatherModel.sunset;

  double get feelsLike => weatherModel.feelsLike;

  int get weatherCode => weatherModel.weather.code;

  int get pressure => weatherModel.pressure;

  int get humidity => weatherModel.humidity;

  int get windDeg => weatherModel.wind.deg;

  double get windSpeed => weatherModel.wind.speed;

  double? get windGust => weatherModel.wind.gust;

  double? get temperatureMin => weatherModel.temperatureMin;

  double? get temperatureMax => weatherModel.temperatureMax;

  double get clouds => weatherModel.clouds;

  double? get rain => weatherModel.rain;

  double? get snow => weatherModel.snow;

  DateTime get dayTime => weatherModel.dayTime;
}
