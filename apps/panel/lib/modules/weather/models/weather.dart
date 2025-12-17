import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class WeatherConfigModel extends Model {
  final String? _primaryLocationId;

  WeatherConfigModel({
    String? primaryLocationId,
  }) : _primaryLocationId = primaryLocationId;

  String? get primaryLocationId => _primaryLocationId;

  factory WeatherConfigModel.fromJson(Map<String, dynamic> json) {
    return WeatherConfigModel(
      primaryLocationId: json['primary_location_id'] as String?,
    );
  }

  WeatherConfigModel copyWith({
    String? primaryLocationId,
  }) {
    return WeatherConfigModel(
      primaryLocationId: primaryLocationId ?? _primaryLocationId,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherConfigModel &&
          other._primaryLocationId == _primaryLocationId);

  @override
  int get hashCode => _primaryLocationId.hashCode;
}
