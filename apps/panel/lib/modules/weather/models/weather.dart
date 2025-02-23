import 'package:fastybird_smart_panel/modules/weather/models/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

class WeatherModel extends Model {
  final CurrentDayModel _currentDay;
  final List<ForecastDayModel> _forecast;

  WeatherModel({
    required CurrentDayModel currentDay,
    required List<ForecastDayModel> forecast,
  })  : _currentDay = currentDay,
        _forecast = forecast;

  CurrentDayModel get currentDay => _currentDay;

  List<ForecastDayModel> get forecast => _forecast;
}
