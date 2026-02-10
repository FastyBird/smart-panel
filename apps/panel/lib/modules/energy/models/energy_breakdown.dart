/// A single device entry in the energy breakdown.
class EnergyBreakdownDevice {
  /// Device ID.
  final String deviceId;

  /// Human-readable device name.
  final String deviceName;

  /// Total consumption in kWh for the range.
  final double consumption;

  /// Room/space name (may be null).
  final String? roomName;

  const EnergyBreakdownDevice({
    required this.deviceId,
    required this.deviceName,
    required this.consumption,
    this.roomName,
  });

  factory EnergyBreakdownDevice.fromJson(Map<String, dynamic> json) {
    return EnergyBreakdownDevice(
      deviceId: json['device_id'] as String? ?? json['deviceId'] as String? ?? '',
      deviceName: json['device_name'] as String? ?? json['deviceName'] as String? ?? 'Unknown',
      consumption: _parseDouble(json['consumption']),
      roomName: json['room_name'] as String? ?? json['roomName'] as String?,
    );
  }

  static double _parseDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}

/// Energy breakdown by device for a space.
///
/// Returned by `GET /api/energy/spaces/:spaceId/breakdown?range=...&limit=...`.
class EnergyBreakdown {
  /// The range this breakdown covers.
  final String range;

  /// Top consuming devices, sorted by consumption descending.
  final List<EnergyBreakdownDevice> devices;

  const EnergyBreakdown({
    required this.range,
    required this.devices,
  });

  bool get isEmpty => devices.isEmpty;
  bool get isNotEmpty => devices.isNotEmpty;

  factory EnergyBreakdown.fromJson(Map<String, dynamic> json) {
    final devicesList = json['devices'] as List<dynamic>? ?? [];
    return EnergyBreakdown(
      range: json['range'] as String? ?? 'today',
      devices: devicesList
          .map((item) => EnergyBreakdownDevice.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}
