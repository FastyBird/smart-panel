import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

class ForecastTemperatureModel extends Model {
  final double? _morn;
  final double? _day;
  final double? _eve;
  final double? _night;
  final double? _min;
  final double? _max;

  ForecastTemperatureModel({
    required double? morn,
    required double? day,
    required double? eve,
    required double? night,
    required double? min,
    required double? max,
  })  : _morn = morn,
        _day = day,
        _eve = eve,
        _night = night,
        _min = min,
        _max = max;

  double? get morn => _morn;

  double? get day => _day;

  double? get eve => _eve;

  double? get night => _night;

  double? get min => _min;

  double? get max => _max;

  ForecastTemperatureModel copyWith({
    double? morn,
    double? day,
    double? eve,
    double? night,
    double? min,
    double? max,
  }) {
    return ForecastTemperatureModel(
      morn: morn ?? _morn,
      day: day ?? _day,
      eve: eve ?? _eve,
      night: night ?? _night,
      min: min ?? _min,
      max: max ?? _max,
    );
  }
}
