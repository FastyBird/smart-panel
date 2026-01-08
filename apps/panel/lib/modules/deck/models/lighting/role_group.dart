import 'package:fastybird_smart_panel/modules/spaces/export.dart';

/// Role group data for displaying in tiles.
class RoleGroup {
  final LightTargetRole role;
  final List<LightTargetView> targets;
  final int onCount;
  final int totalCount;
  final bool hasBrightness;

  /// First ON device's brightness (or first device's if all off).
  final int? brightness;

  RoleGroup({
    required this.role,
    required this.targets,
    required this.onCount,
    required this.totalCount,
    required this.hasBrightness,
    this.brightness,
  });

  bool get isOn => onCount > 0;
}
