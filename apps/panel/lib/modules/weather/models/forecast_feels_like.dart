import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

class ForecastFeelsLikeModel extends Model {
  final double? _morn;
  final double? _day;
  final double? _eve;
  final double? _night;

  ForecastFeelsLikeModel({
    required double? morn,
    required double? day,
    required double? eve,
    required double? night,
  })  : _morn = morn,
        _day = day,
        _eve = eve,
        _night = night;

  double? get morn => _morn;

  double? get day => _day;

  double? get eve => _eve;

  double? get night => _night;

  factory ForecastFeelsLikeModel.fromJson(Map<String, dynamic> json) {
    return ForecastFeelsLikeModel(
      morn: json['morn']?.toDouble(),
      day: json['day']?.toDouble(),
      eve: json['eve']?.toDouble(),
      night: json['night']?.toDouble(),
    );
  }

  ForecastFeelsLikeModel copyWith({
    double? morn,
    double? day,
    double? eve,
    double? night,
  }) {
    return ForecastFeelsLikeModel(
      morn: morn ?? _morn,
      day: day ?? _day,
      eve: eve ?? _eve,
      night: night ?? _night,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ForecastFeelsLikeModel &&
          other._morn == _morn &&
          other._day == _day &&
          other._eve == _eve &&
          other._night == _night);

  @override
  int get hashCode => Object.hashAll([
        _morn,
        _day,
        _eve,
        _night,
      ]);
}
