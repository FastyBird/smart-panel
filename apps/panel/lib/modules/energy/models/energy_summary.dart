/// Energy summary for a space over a given range.
///
/// Contains total consumption, optional production, optional grid import/export,
/// and net values. Returned by `GET /api/energy/spaces/:spaceId/summary?range=...`.
class EnergySummary {
  /// Total energy consumed in kWh.
  final double consumption;

  /// Total energy produced in kWh (null if no PV generation).
  final double? production;

  /// Net energy in kWh: consumption - production (null if no production).
  final double? net;

  /// Total energy imported from the public grid in kWh (0 if no grid metrics).
  final double gridImport;

  /// Total energy exported to the public grid in kWh (0 if no grid metrics).
  final double gridExport;

  /// Net grid energy in kWh: grid_import - grid_export. Positive = net import.
  final double netGrid;

  /// Whether grid import/export metrics are available.
  final bool hasGridMetrics;

  /// Range this summary covers.
  final String range;

  const EnergySummary({
    required this.consumption,
    this.production,
    this.net,
    this.gridImport = 0,
    this.gridExport = 0,
    this.netGrid = 0,
    this.hasGridMetrics = false,
    required this.range,
  });

  /// Whether production data is available.
  bool get hasProduction => production != null && production! > 0;

  factory EnergySummary.fromJson(Map<String, dynamic> json) {
    final rawConsumption = json['total_consumption_kwh'] ?? json['consumption'];
    final rawProduction = json['total_production_kwh'] ?? json['production'];
    final rawNet = json['net_kwh'] ?? json['net'];

    return EnergySummary(
      consumption: _parseDouble(rawConsumption),
      production: rawProduction != null ? _parseDouble(rawProduction) : null,
      net: rawNet != null ? _parseDouble(rawNet) : null,
      gridImport: _parseDouble(json['total_grid_import_kwh'] ?? json['grid_import']),
      gridExport: _parseDouble(json['total_grid_export_kwh'] ?? json['grid_export']),
      netGrid: _parseDouble(json['net_grid_kwh'] ?? json['net_grid']),
      hasGridMetrics: json['has_grid_metrics'] as bool? ?? false,
      range: json['range'] as String? ?? 'today',
    );
  }

  static double _parseDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}
