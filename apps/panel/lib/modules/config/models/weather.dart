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
}
