import 'package:fastybird_smart_panel/modules/weather/models/forecast_feels_like.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_temperature.dart';
import 'package:fastybird_smart_panel/modules/weather/models/model.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';

class ForecastDayModel extends Model {
  final ForecastTemperatureModel _temperature;
  final ForecastFeelsLikeModel _feelsLike;
  final int _pressure;
  final int _humidity;
  final WeatherInfoModel _weather;
  final WindModel _wind;
  final double _clouds;
  final double? _rain;
  final double? _snow;
  final DateTime? _sunrise;
  final DateTime? _sunset;
  final DateTime? _moonrise;
  final DateTime? _moonset;
  final DateTime _dayTime;

  ForecastDayModel({
    required ForecastTemperatureModel temperature,
    required ForecastFeelsLikeModel feelsLike,
    required int pressure,
    required int humidity,
    required WeatherInfoModel weather,
    required WindModel wind,
    required double clouds,
    required double? rain,
    required double? snow,
    required DateTime? sunrise,
    required DateTime? sunset,
    required DateTime? moonrise,
    required DateTime? moonset,
    required DateTime dayTime,
  })  : _temperature = temperature,
        _feelsLike = feelsLike,
        _pressure = pressure,
        _humidity = humidity,
        _weather = weather,
        _wind = wind,
        _clouds = clouds,
        _rain = rain,
        _snow = snow,
        _sunrise = sunrise,
        _sunset = sunset,
        _moonrise = moonrise,
        _moonset = moonset,
        _dayTime = dayTime;

  ForecastTemperatureModel get temperature => _temperature;

  ForecastFeelsLikeModel get feelsLike => _feelsLike;

  int get pressure => _pressure;

  int get humidity => _humidity;

  WeatherInfoModel get weather => _weather;

  WindModel get wind => _wind;

  double get clouds => _clouds;

  double? get rain => _rain;

  double? get snow => _snow;

  DateTime? get sunrise => _sunrise;

  DateTime? get sunset => _sunset;

  DateTime? get moonrise => _moonrise;

  DateTime? get moonset => _moonset;

  DateTime get dayTime => _dayTime;

  factory ForecastDayModel.fromJson(Map<String, dynamic> json) {
    return ForecastDayModel(
      temperature: ForecastTemperatureModel.fromJson(json['temperature']),
      feelsLike: ForecastFeelsLikeModel.fromJson(json['feels_like']),
      pressure: json['pressure'],
      humidity: json['humidity'],
      weather: WeatherInfoModel.fromJson(json['weather']),
      wind: WindModel.fromJson(json['wind']),
      clouds: json['clouds'].toDouble(),
      rain: json['rain']?.toDouble(),
      snow: json['snow']?.toDouble(),
      sunrise: json['sunrise'] != null ? DateTime.parse(json['sunrise']) : null,
      sunset: json['sunset'] != null ? DateTime.parse(json['sunset']) : null,
      moonrise:
          json['moonrise'] != null ? DateTime.parse(json['moonrise']) : null,
      moonset: json['moonset'] != null ? DateTime.parse(json['moonset']) : null,
      dayTime: DateTime.parse(json['day_time']),
    );
  }

  ForecastDayModel copyWith({
    ForecastTemperatureModel? temperature,
    ForecastFeelsLikeModel? feelsLike,
    int? pressure,
    int? humidity,
    WeatherInfoModel? weather,
    WindModel? wind,
    double? clouds,
    double? rain,
    double? snow,
    DateTime? sunrise,
    DateTime? sunset,
    DateTime? moonrise,
    DateTime? moonset,
    DateTime? dayTime,
  }) {
    return ForecastDayModel(
      temperature: temperature ?? _temperature,
      feelsLike: feelsLike ?? _feelsLike,
      pressure: pressure ?? _pressure,
      humidity: humidity ?? _humidity,
      weather: weather ?? _weather,
      wind: wind ?? _wind,
      clouds: clouds ?? _clouds,
      rain: rain ?? _rain,
      snow: snow ?? _snow,
      sunrise: sunrise ?? _sunrise,
      sunset: sunset ?? _sunset,
      moonrise: moonrise ?? _moonrise,
      moonset: moonset ?? _moonset,
      dayTime: dayTime ?? _dayTime,
    );
  }
}
