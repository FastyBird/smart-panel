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

enum PropertyProducerQuality { good, degraded, unavailable }

class PropertyProducerState {
  final PropertyProducerQuality quality;
  final List<String> reasons;
  final DateTime? sampledAt;
  final DateTime? evaluatedAt;
  final DateTime? expiresAt;
  final int revision;

  const PropertyProducerState({
    required this.quality,
    required this.reasons,
    this.sampledAt,
    this.evaluatedAt,
    this.expiresAt,
    required this.revision,
  });

  factory PropertyProducerState.fromJson(Map<String, dynamic> json) {
    DateTime? timestamp(dynamic value) =>
        value is String ? DateTime.tryParse(value) : null;
    final quality = switch (json['quality']) {
      'good' => PropertyProducerQuality.good,
      'degraded' => PropertyProducerQuality.degraded,
      _ => PropertyProducerQuality.unavailable,
    };
    return PropertyProducerState(
      quality: quality,
      reasons: List<String>.unmodifiable(
        json['reasons'] is List
            ? (json['reasons'] as List).whereType<String>()
            : const <String>[],
      ),
      sampledAt: timestamp(json['sampled_at']),
      evaluatedAt: timestamp(json['evaluated_at']),
      expiresAt: timestamp(json['expires_at']),
      revision: json['revision'] is int ? json['revision'] as int : 0,
    );
  }
}

class PropertyValueState {
  final ValueType? value;
  final DateTime? lastUpdated;
  final ValueTrend? trend;
  final PropertyProducerState? producer;

  const PropertyValueState({
    this.value,
    this.lastUpdated,
    this.trend,
    this.producer,
  });

  static PropertyValueState? fromRaw(dynamic raw) {
    if (raw == null) return null;
    if (raw is Map<String, dynamic>) return PropertyValueState.fromJson(raw);
    return PropertyValueState(value: ValueType.fromJson(raw));
  }

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
      producer: json['producer'] is Map<String, dynamic>
          ? PropertyProducerState.fromJson(
              json['producer'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}
