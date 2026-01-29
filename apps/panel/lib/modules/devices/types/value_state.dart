import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

enum ValueTrend {
  rising,
  falling,
  stable;

  static ValueTrend? fromJson(String? json) {
    if (json == null) return null;
    switch (json) {
      case 'rising':
        return ValueTrend.rising;
      case 'falling':
        return ValueTrend.falling;
      case 'stable':
        return ValueTrend.stable;
      default:
        return null;
    }
  }
}

class PropertyValueState {
  final ValueType? value;
  final DateTime? lastUpdated;
  final ValueTrend? trend;

  const PropertyValueState({
    this.value,
    this.lastUpdated,
    this.trend,
  });

  factory PropertyValueState.fromJson(Map<String, dynamic> json) {
    ValueType? value;
    if (json['value'] != null) {
      value = ValueType.fromJson(json['value']);
    }

    DateTime? lastUpdated;
    if (json['last_updated'] != null) {
      lastUpdated = DateTime.tryParse(json['last_updated'] as String);
    }

    final trend = ValueTrend.fromJson(json['trend'] as String?);

    return PropertyValueState(
      value: value,
      lastUpdated: lastUpdated,
      trend: trend,
    );
  }
}
