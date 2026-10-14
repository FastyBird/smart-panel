/// An input diagnostic is evidence about the current binding, never a historical
/// measurement. Older servers may omit this additive diagnostic entirely.
class VirtualThermostatInput {
  final String binding;
  final String role;
  final String sourceKind;
  final String status;
  final String quality;
  final DateTime? sampledAt;
  final DateTime? expiresAt;
  final double? ageSeconds;
  final double? maximumAgeSeconds;
  final List<String> reasons;

  VirtualThermostatInput.fromJson(Map json)
    : binding = json['binding']?.toString() ?? '',
      role = json['role']?.toString() ?? 'unknown',
      sourceKind =
          const ['physical', 'derived', 'unknown'].contains(json['source_kind'])
          ? json['source_kind'] as String
          : 'unknown',
      status =
          const [
            'fresh',
            'stale',
            'missing',
            'incompatible',
            'unavailable',
          ].contains(json['status'])
          ? json['status'] as String
          : 'unavailable',
      quality =
          const ['good', 'degraded', 'unavailable'].contains(json['quality'])
          ? json['quality'] as String
          : 'unavailable',
      sampledAt = DateTime.tryParse(json['sampled_at']?.toString() ?? ''),
      expiresAt = DateTime.tryParse(json['expires_at']?.toString() ?? ''),
      ageSeconds = _number(json['age_seconds']),
      maximumAgeSeconds = _number(json['maximum_age_seconds']),
      reasons = json['reasons'] is List
          ? (json['reasons'] as List).whereType<String>().toList()
          : const [];

  static double? _number(Object? value) =>
      value is num && value.isFinite && value >= 0 ? value.toDouble() : null;

  double? age(Duration elapsed) =>
      ageSeconds == null ? null : ageSeconds! + elapsed.inMilliseconds / 1000;

  String currentStatus(Duration elapsed, DateTime now) {
    if (status != 'fresh') return status;
    if (quality == 'unavailable' ||
        ageSeconds == null ||
        maximumAgeSeconds == null) {
      return 'unavailable';
    }
    if (age(elapsed)! > maximumAgeSeconds! ||
        (expiresAt != null && !now.isBefore(expiresAt!))) {
      return 'stale';
    }
    return 'fresh';
  }
}
