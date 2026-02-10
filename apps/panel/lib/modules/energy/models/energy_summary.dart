/// Energy summary for a space over a given range.
///
/// Contains total consumption, optional production, and optional net values.
/// Returned by `GET /api/energy/spaces/:spaceId/summary?range=...`.
class EnergySummary {
  /// Total energy consumed in kWh.
  final double consumption;

  /// Total energy produced in kWh (null if no PV generation).
  final double? production;

  /// Net energy in kWh: consumption - production (null if no production).
  final double? net;

  /// Range this summary covers.
  final String range;

  const EnergySummary({
    required this.consumption,
    this.production,
    this.net,
    required this.range,
  });

  /// Whether production data is available.
  bool get hasProduction => production != null && production! > 0;

  factory EnergySummary.fromJson(Map<String, dynamic> json) {
    return EnergySummary(
      consumption: _parseDouble(json['consumption']),
      production: json['production'] != null ? _parseDouble(json['production']) : null,
      net: json['net'] != null ? _parseDouble(json['net']) : null,
      range: json['range'] as String? ?? 'today',
    );
  }

  static double _parseDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}
