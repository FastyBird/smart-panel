import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';

class WeatherConfigModel extends Model {
  final WeatherLocationType _locationType;
  final WeatherUnit _unit;
  final String? _openWeatherApiKey;

  WeatherConfigModel({
    WeatherLocationType locationType = WeatherLocationType.cityName,
    WeatherUnit unit = WeatherUnit.celsius,
    String? openWeatherApiKey,
  })  : _locationType = locationType,
        _unit = unit,
        _openWeatherApiKey = openWeatherApiKey;

  WeatherLocationType get locationType => _locationType;

  WeatherUnit get unit => _unit;

  String? get openWeatherApiKey => _openWeatherApiKey;

  factory WeatherConfigModel.fromJson(Map<String, dynamic> json) {
    WeatherLocationType? locationType =
        WeatherLocationType.fromValue(json['location_type']);

    WeatherUnit? unit = WeatherUnit.fromValue(json['unit']);

    return WeatherConfigModel(
      locationType: locationType ?? WeatherLocationType.cityName,
      unit: unit ?? WeatherUnit.celsius,
      openWeatherApiKey: json['open_weather_api_key'],
    );
  }

  WeatherConfigModel copyWith({
    String? location,
    WeatherLocationType? locationType,
    WeatherUnit? unit,
    String? openWeatherApiKey,
  }) {
    return WeatherConfigModel(
      locationType: locationType ?? _locationType,
      unit: unit ?? _unit,
      openWeatherApiKey: openWeatherApiKey ?? _openWeatherApiKey,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherConfigModel &&
          other._locationType.value == _locationType.value &&
          other._unit.value == _unit.value);

  @override
  int get hashCode => Object.hashAll([
        _locationType.value,
        _unit.value,
      ]);
}
