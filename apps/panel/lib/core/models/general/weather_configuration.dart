import 'package:fastybird_smart_panel/core/types/weather.dart';

class WeatherConfigurationModel {
  final String? _location;
  final WeatherLocationTypeType _locationType;
  final WeatherUnitType _unit;

  WeatherConfigurationModel({
    String? location,
    WeatherLocationTypeType locationType = WeatherLocationTypeType.cityName,
    WeatherUnitType unit = WeatherUnitType.celsius,
  })  : _location = location,
        _locationType = locationType,
        _unit = unit;

  String? get location => _location;

  WeatherLocationTypeType get locationType => _locationType;

  WeatherUnitType get unit => _unit;

  WeatherConfigurationModel copyWith({
    String? location,
    WeatherLocationTypeType? locationType,
    WeatherUnitType? unit,
  }) {
    return WeatherConfigurationModel(
      location: location ?? _location,
      locationType: locationType ?? _locationType,
      unit: unit ?? _unit,
    );
  }
}
