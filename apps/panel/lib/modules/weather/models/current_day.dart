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
}
