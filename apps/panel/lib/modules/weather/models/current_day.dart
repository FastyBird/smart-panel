import 'package:fastybird_smart_panel/modules/weather/models/model.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather_info.dart';
import 'package:fastybird_smart_panel/modules/weather/models/wind.dart';

class CurrentDayModel extends Model {
  final double _temperature;
  final double? _temperatureMin;
  final double? _temperatureMax;
  final double _feelsLike;
  final int _pressure;
  final int _humidity;
  final WeatherInfoModel _weather;
  final WindModel _wind;
  final double _clouds;
  final double? _rain;
  final double? _snow;
  final DateTime _sunrise;
  final DateTime _sunset;
  final DateTime _dayTime;

  CurrentDayModel({
    required double temperature,
    required double? temperatureMin,
    required double? temperatureMax,
    required double feelsLike,
    required int pressure,
    required int humidity,
    required WeatherInfoModel weather,
    required WindModel wind,
    required double clouds,
    required double? rain,
    required double? snow,
    required DateTime sunrise,
    required DateTime sunset,
    required DateTime dayTime,
  })  : _temperature = temperature,
        _temperatureMin = temperatureMin,
        _temperatureMax = temperatureMax,
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
        _dayTime = dayTime;

  double get temperature => _temperature;

  double? get temperatureMin => _temperatureMin;

  double? get temperatureMax => _temperatureMax;

  double get feelsLike => _feelsLike;

  int get pressure => _pressure;

  int get humidity => _humidity;

  WeatherInfoModel get weather => _weather;

  WindModel get wind => _wind;

  double get clouds => _clouds;

  double? get rain => _rain;

  double? get snow => _snow;

  DateTime get sunrise => _sunrise;

  DateTime get sunset => _sunset;

  DateTime get dayTime => _dayTime;

  factory CurrentDayModel.fromJson(Map<String, dynamic> json) {
    return CurrentDayModel(
      temperature: json['temperature'].toDouble(),
      temperatureMin: json['temperature_min']?.toDouble(),
      temperatureMax: json['temperature_max']?.toDouble(),
      feelsLike: json['feels_like'].toDouble(),
      pressure: json['pressure'],
      humidity: json['humidity'],
      weather: WeatherInfoModel.fromJson(json['weather']),
      wind: WindModel.fromJson(json['wind']),
      clouds: json['clouds'].toDouble(),
      rain: json['rain']?.toDouble(),
      snow: json['snow']?.toDouble(),
      sunrise: DateTime.parse(json['sunrise']),
      sunset: DateTime.parse(json['sunset']),
      dayTime: DateTime.parse(json['day_time']),
    );
  }

  CurrentDayModel copyWith({
    double? temperature,
    double? temperatureMin,
    double? temperatureMax,
    double? feelsLike,
    int? pressure,
    int? humidity,
    WeatherInfoModel? weather,
    WindModel? wind,
    double? clouds,
    double? rain,
    double? snow,
    DateTime? sunrise,
    DateTime? sunset,
    DateTime? dayTime,
  }) {
    return CurrentDayModel(
      temperature: temperature ?? _temperature,
      temperatureMin: temperatureMin ?? _temperatureMin,
      temperatureMax: temperatureMax ?? _temperatureMax,
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
      dayTime: dayTime ?? _dayTime,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CurrentDayModel &&
          other._temperature == _temperature &&
          other._temperatureMin == _temperatureMin &&
          other._temperatureMax == _temperatureMax &&
          other._feelsLike == _feelsLike &&
          other._pressure == _pressure &&
          other._humidity == _humidity &&
          other._weather == _weather &&
          other._wind == _wind &&
          other._clouds == _clouds &&
          other._rain == _rain &&
          other._snow == _snow &&
          other._sunrise == _sunrise &&
          other._sunset == _sunset &&
          other._dayTime == _dayTime);

  @override
  int get hashCode => Object.hashAll([
        _temperature,
        _temperatureMin,
        _temperatureMax,
        _feelsLike,
        _pressure,
        _humidity,
        _weather,
        _wind,
        _clouds,
        _rain,
        _snow,
        _sunrise,
        _sunset,
        _dayTime,
      ]);
}
