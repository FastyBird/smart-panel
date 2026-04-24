/// Predefined covers modes that can be applied to a space.
///
/// Each mode represents a different covers configuration:
/// - [open]: All covers fully open (100%)
/// - [closed]: All covers fully closed (0%)
/// - [privacy]: Optimized for privacy while allowing some light
/// - [daylight]: Optimized for natural daylight
enum CoversMode {
  open,
  closed,
  privacy,
  daylight,
}

/// Parse CoversMode from string
CoversMode? parseCoversMode(String? mode) {
  if (mode == null) return null;
  switch (mode) {
    case 'open':
      return CoversMode.open;
    case 'closed':
      return CoversMode.closed;
    case 'privacy':
      return CoversMode.privacy;
    case 'daylight':
      return CoversMode.daylight;
    default:
      return null;
  }
}

/// Confidence level of mode detection.
enum CoversModeConfidence {
  exact,
  approximate,
  none,
}

/// Parse CoversModeConfidence from string
CoversModeConfidence parseCoversModeConfidence(String? confidence) {
  switch (confidence) {
    case 'exact':
      return CoversModeConfidence.exact;
    case 'approximate':
      return CoversModeConfidence.approximate;
    default:
      return CoversModeConfidence.none;
  }
}

/// Role assigned to covers for grouped control.
///
/// Roles allow controlling specific categories of window coverings:
/// - [primary]: Main/default covers in the space
/// - [blackout]: Blackout blinds or curtains for complete darkness
/// - [sheer]: Sheer/translucent curtains for diffused light
/// - [outdoor]: Outdoor shutters or awnings
/// - [hidden]: Covers excluded from group control
enum CoversStateRole {
  primary,
  blackout,
  sheer,
  outdoor,
  hidden,
}

/// Parse CoversStateRole from string
CoversStateRole? parseCoversStateRole(String? role) {
  if (role == null) return null;
  switch (role) {
    case 'primary':
      return CoversStateRole.primary;
    case 'blackout':
      return CoversStateRole.blackout;
    case 'sheer':
      return CoversStateRole.sheer;
    case 'outdoor':
      return CoversStateRole.outdoor;
    case 'hidden':
      return CoversStateRole.hidden;
    default:
      return null;
  }
}

/// Aggregated state for a single covers role.
///
/// Contains state information for all covers with a specific role:
/// - Position (uniform value or null if mixed)
/// - Tilt (for covers with tilt support)
/// - Open/closed status
/// - Device counts
class RoleCoversState {
  final CoversStateRole role;
  final int? position;
  final bool isPositionMixed;
  final int? tilt;
  final bool isTiltMixed;
  final bool hasTilt;
  final bool isOpen;
  final bool isClosed;
  final int devicesCount;
  final int devicesOpen;

  const RoleCoversState({
    required this.role,
    this.position,
    required this.isPositionMixed,
    this.tilt,
    required this.isTiltMixed,
    required this.hasTilt,
    required this.isOpen,
    required this.isClosed,
    required this.devicesCount,
    required this.devicesOpen,
  });

  factory RoleCoversState.fromJson(Map<String, dynamic> json, CoversStateRole role) {
    return RoleCoversState(
      role: role,
      position: json['position'] as int?,
      isPositionMixed: json['is_position_mixed'] as bool? ?? false,
      tilt: json['tilt'] as int?,
      isTiltMixed: json['is_tilt_mixed'] as bool? ?? false,
      hasTilt: json['has_tilt'] as bool? ?? false,
      isOpen: json['is_open'] as bool? ?? false,
      isClosed: json['is_closed'] as bool? ?? true,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesOpen: json['devices_open'] as int? ?? 0,
    );
  }
}

/// Aggregated covers state for a space.
///
/// Contains all aggregated information about window coverings in the space including:
/// - Whether the space has any covers
/// - Mode detection (detected mode, confidence, match percentage)
/// - Average position across all covers (with mixed flag)
/// - Average tilt across all covers with tilt support (with mixed flag)
/// - Open/closed status
/// - Per-role aggregated state
/// - Device counts by role
/// - Last applied mode (if any)
class CoversStateModel {
  final String spaceId;
  final bool hasCovers;
  final CoversMode? detectedMode;
  final CoversModeConfidence modeConfidence;
  final int? modeMatchPercentage;
  final bool isModeFromIntent;
  final int? averagePosition;
  final bool isPositionMixed;
  final int? averageTilt;
  final bool isTiltMixed;
  final bool hasTilt;
  final bool anyOpen;
  final bool allClosed;
  final int devicesCount;
  final Map<CoversStateRole, RoleCoversState> roles;
  final Map<CoversStateRole, int> coversByRole;
  final CoversMode? lastAppliedMode;
  final DateTime? lastAppliedAt;

  CoversStateModel({
    required this.spaceId,
    required this.hasCovers,
    this.detectedMode,
    required this.modeConfidence,
    this.modeMatchPercentage,
    required this.isModeFromIntent,
    this.averagePosition,
    required this.isPositionMixed,
    this.averageTilt,
    required this.isTiltMixed,
    required this.hasTilt,
    required this.anyOpen,
    required this.allClosed,
    required this.devicesCount,
    required this.roles,
    required this.coversByRole,
    this.lastAppliedMode,
    this.lastAppliedAt,
  });

  /// Check if all covers are open (position = 100)
  bool get allOpen => hasCovers && !allClosed && averagePosition == 100;

  /// Get count of covers with a specific role
  int getCountForRole(CoversStateRole role) => coversByRole[role] ?? 0;

  /// Get state for a specific role
  RoleCoversState? getRoleState(CoversStateRole role) => roles[role];

  factory CoversStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    // Parse covers by role map
    Map<CoversStateRole, int> coversByRoleMap = {};
    final coversByRoleJson = json['covers_by_role'] as Map<String, dynamic>? ?? {};

    for (final entry in coversByRoleJson.entries) {
      final role = parseCoversStateRole(entry.key);
      if (role != null && entry.value is int) {
        coversByRoleMap[role] = entry.value as int;
      }
    }

    // Parse per-role state
    Map<CoversStateRole, RoleCoversState> rolesMap = {};
    final rolesJson = json['roles'] as Map<String, dynamic>? ?? {};

    for (final entry in rolesJson.entries) {
      final role = parseCoversStateRole(entry.key);
      if (role != null && entry.value is Map<String, dynamic>) {
        rolesMap[role] = RoleCoversState.fromJson(entry.value, role);
      }
    }

    return CoversStateModel(
      spaceId: spaceId,
      hasCovers: json['has_covers'] as bool? ?? false,
      detectedMode: parseCoversMode(json['detected_mode'] as String?),
      modeConfidence: parseCoversModeConfidence(json['mode_confidence'] as String?),
      modeMatchPercentage: json['mode_match_percentage'] as int?,
      isModeFromIntent: json['is_mode_from_intent'] as bool? ?? false,
      averagePosition: json['average_position'] as int?,
      isPositionMixed: json['is_position_mixed'] as bool? ?? false,
      averageTilt: json['average_tilt'] as int?,
      isTiltMixed: json['is_tilt_mixed'] as bool? ?? false,
      hasTilt: json['has_tilt'] as bool? ?? false,
      anyOpen: json['any_open'] as bool? ?? false,
      allClosed: json['all_closed'] as bool? ?? true,
      devicesCount: json['devices_count'] as int? ?? 0,
      roles: rolesMap,
      coversByRole: coversByRoleMap,
      lastAppliedMode: parseCoversMode(json['last_applied_mode'] as String?),
      lastAppliedAt: json['last_applied_at'] != null
          ? DateTime.parse(json['last_applied_at'] as String)
          : null,
    );
  }

  /// Create an empty state (no covers)
  factory CoversStateModel.empty(String spaceId) {
    return CoversStateModel(
      spaceId: spaceId,
      hasCovers: false,
      modeConfidence: CoversModeConfidence.none,
      isModeFromIntent: false,
      isPositionMixed: false,
      isTiltMixed: false,
      hasTilt: false,
      anyOpen: false,
      allClosed: true,
      devicesCount: 0,
      roles: {},
      coversByRole: {},
    );
  }
}
