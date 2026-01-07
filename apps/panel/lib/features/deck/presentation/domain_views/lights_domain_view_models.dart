part of lights_domain_view;

// ============================================================================
// Private UI models for Lights Domain View
// Public models (RoleUIState, RoleControlState, RoleMixedState) are in:
// modules/deck/domain_views/lighting/lighting_models.dart
// ============================================================================

/// Role group data for displaying in tiles
class _RoleGroup {
  final LightTargetRole role;
  final List<LightTargetView> targets;
  final int onCount;
  final int totalCount;
  final bool hasBrightness;

  /// First ON device's brightness (or first device's if all off)
  final int? brightness;

  _RoleGroup({
    required this.role,
    required this.targets,
    required this.onCount,
    required this.totalCount,
    required this.hasBrightness,
    this.brightness,
  });

  bool get isOn => onCount > 0;
}

enum _LightRoleMode {
  off,
  brightness,
  color,
  temperature,
  white,
}
