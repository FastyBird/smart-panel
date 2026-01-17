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

/// Aggregated covers state for a space.
///
/// Contains all aggregated information about window coverings in the space including:
/// - Whether the space has any covers
/// - Average position across all covers
/// - Open/closed status
/// - Device counts by role
class CoversStateModel {
  final String spaceId;
  final bool hasCovers;
  final int? averagePosition;
  final bool anyOpen;
  final bool allClosed;
  final int devicesCount;
  final Map<CoversStateRole, int> coversByRole;

  CoversStateModel({
    required this.spaceId,
    required this.hasCovers,
    this.averagePosition,
    required this.anyOpen,
    required this.allClosed,
    required this.devicesCount,
    required this.coversByRole,
  });

  /// Check if all covers are open (position = 100)
  bool get allOpen => hasCovers && !allClosed && averagePosition == 100;

  /// Get count of covers with a specific role
  int getCountForRole(CoversStateRole role) => coversByRole[role] ?? 0;

  factory CoversStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    // Parse covers by role map
    Map<CoversStateRole, int> rolesMap = {};
    final rolesJson = json['covers_by_role'] as Map<String, dynamic>? ?? {};

    for (final entry in rolesJson.entries) {
      final role = parseCoversStateRole(entry.key);
      if (role != null && entry.value is int) {
        rolesMap[role] = entry.value as int;
      }
    }

    return CoversStateModel(
      spaceId: spaceId,
      hasCovers: json['has_covers'] as bool? ?? false,
      averagePosition: json['average_position'] as int?,
      anyOpen: json['any_open'] as bool? ?? false,
      allClosed: json['all_closed'] as bool? ?? true,
      devicesCount: json['devices_count'] as int? ?? 0,
      coversByRole: rolesMap,
    );
  }

  /// Create an empty state (no covers)
  factory CoversStateModel.empty(String spaceId) {
    return CoversStateModel(
      spaceId: spaceId,
      hasCovers: false,
      anyOpen: false,
      allClosed: true,
      devicesCount: 0,
      coversByRole: {},
    );
  }
}
