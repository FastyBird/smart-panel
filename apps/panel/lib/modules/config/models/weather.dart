import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';

class WeatherConfigModel extends Model {
  final String? _location;
  final WeatherLocationType _locationType;
  final WeatherUnit _unit;

  WeatherConfigModel({
    String? location,
    WeatherLocationType locationType = WeatherLocationType.cityName,
    WeatherUnit unit = WeatherUnit.celsius,
  })  : _location = location,
        _locationType = locationType,
        _unit = unit;

  String? get location => _location;

  WeatherLocationType get locationType => _locationType;

  WeatherUnit get unit => _unit;

  factory WeatherConfigModel.fromJson(Map<String, dynamic> json) {
    WeatherLocationType? locationType =
        WeatherLocationType.fromValue(json['location_type']);

    WeatherUnit? unit = WeatherUnit.fromValue(json['unit']);

    return WeatherConfigModel(
      location: json['location'],
      locationType: locationType ?? WeatherLocationType.cityName,
      unit: unit ?? WeatherUnit.celsius,
    );
  }

  WeatherConfigModel copyWith({
    String? location,
    WeatherLocationType? locationType,
    WeatherUnit? unit,
  }) {
    return WeatherConfigModel(
      location: location ?? _location,
      locationType: locationType ?? _locationType,
      unit: unit ?? _unit,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherConfigModel &&
          other._location == _location &&
          other._locationType.value == _locationType.value &&
          other._unit.value == _unit.value);

  @override
  int get hashCode => Object.hashAll([
        _location,
        _locationType.value,
        _unit.value,
      ]);
}
