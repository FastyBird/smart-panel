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

  /// Normalizes a temperature value from this view's source unit to Celsius.
  ///
  /// Weather data unit depends on the backend's OpenWeatherMap configuration:
  /// metric → Celsius, imperial → Fahrenheit. All display-layer conversion
  /// expects Celsius input, so call this before [UnitConverter.convertTemperature].
  double toCelsius(double value) {
    if (_unit == WeatherUnit.fahrenheit) {
      return (value - 32) * 5 / 9;
    }
    return value;
  }

  /// Normalizes a wind speed value from this view's source unit to m/s.
  ///
  /// Imperial mode (fahrenheit) provides wind speed in mph.
  double toMetersPerSecond(double value) {
    if (_unit == WeatherUnit.fahrenheit) {
      return value * 0.44704;
    }
    return value;
  }
}
