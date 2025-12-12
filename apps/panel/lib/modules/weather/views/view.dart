import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

abstract class WeatherView<M extends Model> {
  final M _weatherModel;
  final WeatherConfigModel _configModel;
  final WeatherUnit _unit;

  WeatherView({
    required M weatherModel,
    required WeatherConfigModel configModel,
    WeatherUnit unit = WeatherUnit.celsius,
  })  : _weatherModel = weatherModel,
        _configModel = configModel,
        _unit = unit;

  M get weatherModel => _weatherModel;

  WeatherConfigModel get configModel => _configModel;

  /// Temperature unit used for weather data
  WeatherUnit get unit => _unit;
}
