import 'package:fastybird_smart_panel/core/types/weather.dart';

class WeatherConfigurationModel {
  final String? _location;
  final UnitType _unit;

  WeatherConfigurationModel({
    String? location,
    UnitType unit = UnitType.celsius,
  })  : _location = location,
        _unit = unit;

  String? get location => _location;

  UnitType get unit => _unit;

  WeatherConfigurationModel copyWith({
    String? location,
    UnitType? unit,
  }) {
    return WeatherConfigurationModel(
      location: location ?? _location,
      unit: unit ?? _unit,
    );
  }
}
