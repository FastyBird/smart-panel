import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

abstract class WeatherView<M extends Model> {
  final M _weatherModel;
  final WeatherConfigModel _configModel;

  WeatherView({
    required M weatherModel,
    required WeatherConfigModel configModel,
  })  : _weatherModel = weatherModel,
        _configModel = configModel;

  M get weatherModel => _weatherModel;

  WeatherConfigModel get configModel => _configModel;

  WeatherUnit get unit => _configModel.unit;
}
