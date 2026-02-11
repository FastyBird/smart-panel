/// A single data point in an energy timeseries.
class EnergyTimeseriesPoint {
  /// Bucket timestamp.
  final DateTime timestamp;

  /// Consumption delta for this bucket in kWh.
  final double consumption;

  /// Production delta for this bucket in kWh (0 if no PV).
  final double production;

  /// Grid import delta for this bucket in kWh (0 if no grid metrics).
  final double gridImport;

  /// Grid export delta for this bucket in kWh (0 if no grid metrics).
  final double gridExport;

  const EnergyTimeseriesPoint({
    required this.timestamp,
    required this.consumption,
    this.production = 0,
    this.gridImport = 0,
    this.gridExport = 0,
  });

  factory EnergyTimeseriesPoint.fromJson(Map<String, dynamic> json) {
    return EnergyTimeseriesPoint(
      timestamp: DateTime.parse(json['timestamp'] as String),
      consumption: _parseDouble(json['consumption']),
      production: _parseDouble(json['production']),
      gridImport: _parseDouble(json['grid_import'] ?? json['grid_import_delta_kwh']),
      gridExport: _parseDouble(json['grid_export'] ?? json['grid_export_delta_kwh']),
    );
  }

  static double _parseDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}

/// Energy timeseries for a space over a given range.
///
/// Returned by `GET /api/energy/spaces/:spaceId/timeseries?range=...&interval=...`.
class EnergyTimeseries {
  /// The range this timeseries covers.
  final String range;

  /// The bucket interval (e.g. '1h', '1d').
  final String interval;

  /// Ordered list of data points.
  final List<EnergyTimeseriesPoint> points;

  const EnergyTimeseries({
    required this.range,
    required this.interval,
    required this.points,
  });

  bool get isEmpty => points.isEmpty;
  bool get isNotEmpty => points.isNotEmpty;

  /// Whether any point has production data.
  bool get hasProduction => points.any((p) => p.production > 0);

  factory EnergyTimeseries.fromJson(Map<String, dynamic> json) {
    final pointsList = json['series'] as List<dynamic>? ?? [];
    return EnergyTimeseries(
      range: json['range'] as String? ?? 'today',
      interval: json['interval'] as String? ?? '1h',
      points: pointsList
          .map((item) => EnergyTimeseriesPoint.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}
