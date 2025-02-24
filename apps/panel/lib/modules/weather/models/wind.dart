import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

class WindModel extends Model {
  final double _speed;
  final int _deg;
  final double? _gust;

  WindModel({
    required double speed,
    required int deg,
    required double? gust,
  })  : _speed = speed,
        _deg = deg,
        _gust = gust;

  double get speed => _speed;

  int get deg => _deg;

  double? get gust => _gust;

  WindModel copyWith({
    double? speed,
    int? deg,
    double? gust,
  }) {
    return WindModel(
      speed: speed ?? _speed,
      deg: deg ?? _deg,
      gust: gust ?? _gust,
    );
  }
}
