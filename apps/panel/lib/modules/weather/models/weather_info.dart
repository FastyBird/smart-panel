import 'package:fastybird_smart_panel/modules/weather/models/model.dart';

class WeatherInfoModel extends Model {
  final int _code;
  final String _main;
  final String _description;
  final String _icon;

  WeatherInfoModel({
    required int code,
    required String main,
    required String description,
    required String icon,
  })  : _code = code,
        _main = main,
        _description = description,
        _icon = icon;

  int get code => _code;

  String get main => _main;

  String get description => _description;

  String get icon => _icon;

  factory WeatherInfoModel.fromJson(Map<String, dynamic> json) {
    return WeatherInfoModel(
      code: json['code'],
      main: json['main'],
      description: json['description'],
      icon: json['icon'],
    );
  }

  WeatherInfoModel copyWith({
    int? code,
    String? main,
    String? description,
    String? icon,
  }) {
    return WeatherInfoModel(
      code: code ?? _code,
      main: main ?? _main,
      description: description ?? _description,
      icon: icon ?? _icon,
    );
  }
}
