import 'package:fastybird_smart_panel/modules/weather/models/model.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';

class ForecastHourModel extends Model {
  final double _temperature;
  final double _feelsLike;
  final int _pressure;
  final int _humidity;
  final WeatherInfoModel _weather;
  final WindModel _wind;
  final double _clouds;
  final double? _rain;
  final double? _snow;
  final DateTime _dateTime;

  ForecastHourModel({
    required double temperature,
    required double feelsLike,
    required int pressure,
    required int humidity,
    required WeatherInfoModel weather,
    required WindModel wind,
    required double clouds,
    required double? rain,
    required double? snow,
    required DateTime dateTime,
  })  : _temperature = temperature,
        _feelsLike = feelsLike,
        _pressure = pressure,
        _humidity = humidity,
        _weather = weather,
        _wind = wind,
        _clouds = clouds,
        _rain = rain,
        _snow = snow,
        _dateTime = dateTime;

  double get temperature => _temperature;

  double get feelsLike => _feelsLike;

  int get pressure => _pressure;

  int get humidity => _humidity;

  WeatherInfoModel get weather => _weather;

  WindModel get wind => _wind;

  double get clouds => _clouds;

  double? get rain => _rain;

  double? get snow => _snow;

  DateTime get dateTime => _dateTime;

  factory ForecastHourModel.fromJson(Map<String, dynamic> json) {
    return ForecastHourModel(
      temperature: (json['temperature'] as num).toDouble(),
      feelsLike: (json['feels_like'] as num).toDouble(),
      pressure: (json['pressure'] as num).toInt(),
      humidity: (json['humidity'] as num).toInt(),
      weather: WeatherInfoModel.fromJson(json['weather']),
      wind: WindModel.fromJson(json['wind']),
      clouds: (json['clouds'] as num).toDouble(),
      rain: json['rain'] != null ? (json['rain'] as num).toDouble() : null,
      snow: json['snow'] != null ? (json['snow'] as num).toDouble() : null,
      dateTime: DateTime.parse(json['date_time']),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ForecastHourModel &&
          other._temperature == _temperature &&
          other._feelsLike == _feelsLike &&
          other._pressure == _pressure &&
          other._humidity == _humidity &&
          other._weather == _weather &&
          other._wind == _wind &&
          other._clouds == _clouds &&
          other._rain == _rain &&
          other._snow == _snow &&
          other._dateTime == _dateTime);

  @override
  int get hashCode => Object.hashAll([
        _temperature,
        _feelsLike,
        _pressure,
        _humidity,
        _weather,
        _wind,
        _clouds,
        _rain,
        _snow,
        _dateTime,
      ]);
}
