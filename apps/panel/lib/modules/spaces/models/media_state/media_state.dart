enum MediaMode {
  off,
  background,
  focused,
  party,
}

MediaMode? parseMediaMode(String? mode) {
  switch (mode) {
    case 'off':
      return MediaMode.off;
    case 'background':
      return MediaMode.background;
    case 'focused':
      return MediaMode.focused;
    case 'party':
      return MediaMode.party;
    default:
      return null;
  }
}

String mediaModeToString(MediaMode mode) {
  switch (mode) {
    case MediaMode.off:
      return 'off';
    case MediaMode.background:
      return 'background';
    case MediaMode.focused:
      return 'focused';
    case MediaMode.party:
      return 'party';
  }
}

enum MediaModeConfidence { exact, approximate, none }

MediaModeConfidence parseMediaModeConfidence(String? confidence) {
  switch (confidence) {
    case 'exact':
      return MediaModeConfidence.exact;
    case 'approximate':
      return MediaModeConfidence.approximate;
    default:
      return MediaModeConfidence.none;
  }
}

enum MediaRole { primary, secondary, background, gaming, hidden }

MediaRole? parseMediaRole(String? role) {
  switch (role) {
    case 'primary':
      return MediaRole.primary;
    case 'secondary':
      return MediaRole.secondary;
    case 'background':
      return MediaRole.background;
    case 'gaming':
      return MediaRole.gaming;
    case 'hidden':
      return MediaRole.hidden;
    default:
      return null;
  }
}

String mediaRoleToString(MediaRole role) {
  switch (role) {
    case MediaRole.primary:
      return 'primary';
    case MediaRole.secondary:
      return 'secondary';
    case MediaRole.background:
      return 'background';
    case MediaRole.gaming:
      return 'gaming';
    case MediaRole.hidden:
      return 'hidden';
  }
}

class MediaRoleStateModel {
  final MediaRole role;
  final bool isOn;
  final bool isOnMixed;
  final bool isVolumeMixed;
  final bool isMuted;
  final bool isMutedMixed;
  final int devicesCount;
  final int devicesOn;
  final int? volume;

  MediaRoleStateModel({
    required this.role,
    required this.isOn,
    required this.isOnMixed,
    required this.isVolumeMixed,
    required this.isMuted,
    required this.isMutedMixed,
    required this.devicesCount,
    required this.devicesOn,
    this.volume,
  });

  factory MediaRoleStateModel.fromJson(
    Map<String, dynamic> json,
  ) {
    return MediaRoleStateModel(
      role: parseMediaRole(json['role'] as String?) ?? MediaRole.hidden,
      isOn: json['is_on'] as bool? ?? false,
      isOnMixed: json['is_on_mixed'] as bool? ?? false,
      isVolumeMixed: json['is_volume_mixed'] as bool? ?? false,
      isMuted: json['is_muted'] as bool? ?? false,
      isMutedMixed: json['is_muted_mixed'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesOn: json['devices_on'] as int? ?? 0,
      volume: (json['volume'] as num?)?.toInt(),
    );
  }
}

class OtherMediaStateModel {
  final bool isOn;
  final bool isOnMixed;
  final int? volume;
  final bool isVolumeMixed;
  final bool isMuted;
  final bool isMutedMixed;
  final int devicesCount;
  final int devicesOn;

  OtherMediaStateModel({
    required this.isOn,
    required this.isOnMixed,
    required this.volume,
    required this.isVolumeMixed,
    required this.isMuted,
    required this.isMutedMixed,
    required this.devicesCount,
    required this.devicesOn,
  });

  factory OtherMediaStateModel.fromJson(Map<String, dynamic> json) {
    return OtherMediaStateModel(
      isOn: json['is_on'] as bool? ?? false,
      isOnMixed: json['is_on_mixed'] as bool? ?? false,
      volume: (json['volume'] as num?)?.toInt(),
      isVolumeMixed: json['is_volume_mixed'] as bool? ?? false,
      isMuted: json['is_muted'] as bool? ?? false,
      isMutedMixed: json['is_muted_mixed'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesOn: json['devices_on'] as int? ?? 0,
    );
  }
}

class MediaStateModel {
  final String spaceId;
  final bool hasMedia;
  final bool anyOn;
  final bool allOff;
  final int? averageVolume;
  final bool anyMuted;
  final int devicesCount;
  final Map<MediaRole, int> devicesByRole;
  final MediaModeConfidence modeConfidence;
  final Map<MediaRole, MediaRoleStateModel> roles;
  final OtherMediaStateModel other;
  final MediaMode? lastAppliedMode;
  final int? lastAppliedVolume;
  final bool? lastAppliedMuted;
  final DateTime? lastAppliedAt;
  final MediaMode? detectedMode;
  final int? modeMatchPercentage;

  MediaStateModel({
    required this.spaceId,
    required this.hasMedia,
    required this.anyOn,
    required this.allOff,
    required this.anyMuted,
    required this.devicesCount,
    required this.devicesByRole,
    required this.modeConfidence,
    required this.roles,
    required this.other,
    this.averageVolume,
    this.lastAppliedMode,
    this.lastAppliedVolume,
    this.lastAppliedMuted,
    this.lastAppliedAt,
    this.detectedMode,
    this.modeMatchPercentage,
  });

  bool get isMuted => anyMuted;

  bool get isOn => anyOn && !allOff;

  int get devicesOn =>
      roles.values.fold(other.devicesOn, (sum, r) => sum + r.devicesOn);

  factory MediaStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    final devicesByRoleRaw =
        (json['devices_by_role'] as Map?)?.cast<String, int>() ?? {};
    final rolesRaw =
        (json['roles'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final otherJson =
        (json['other'] as Map?)?.cast<String, dynamic>();

    return MediaStateModel(
      spaceId: spaceId,
      hasMedia: json['has_media'] as bool? ?? false,
      anyOn: json['any_on'] as bool? ?? false,
      allOff: json['all_off'] as bool? ?? false,
      averageVolume: (json['average_volume'] as num?)?.toInt(),
      anyMuted: json['any_muted'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesByRole: devicesByRoleRaw.map(
        (key, value) => MapEntry(parseMediaRole(key) ?? MediaRole.hidden, value),
      ),
      modeConfidence:
          parseMediaModeConfidence(json['mode_confidence'] as String?),
      roles: rolesRaw.map(
        (key, value) => MapEntry(
          parseMediaRole(key) ?? MediaRole.hidden,
          MediaRoleStateModel.fromJson(
            (value as Map).cast<String, dynamic>(),
          ),
        ),
      ),
      other: otherJson != null
          ? OtherMediaStateModel.fromJson(otherJson)
          : OtherMediaStateModel(
              isOn: false,
              isOnMixed: false,
              volume: null,
              isVolumeMixed: false,
              isMuted: false,
              isMutedMixed: false,
              devicesCount: 0,
              devicesOn: 0,
            ),
      lastAppliedMode: parseMediaMode(json['last_applied_mode'] as String?),
      lastAppliedVolume: (json['last_applied_volume'] as num?)?.toInt(),
      lastAppliedMuted: json['last_applied_muted'] as bool?,
      lastAppliedAt: json['last_applied_at'] != null
          ? DateTime.parse(json['last_applied_at'] as String)
          : null,
      detectedMode: parseMediaMode(json['detected_mode'] as String?),
      modeMatchPercentage: (json['mode_match_percentage'] as num?)?.toInt(),
    );
  }

  factory MediaStateModel.empty(String spaceId) {
    return MediaStateModel(
      spaceId: spaceId,
      hasMedia: false,
      anyOn: false,
      allOff: true,
      anyMuted: false,
      devicesCount: 0,
      devicesByRole: const {},
      modeConfidence: MediaModeConfidence.none,
      roles: const {},
      other: OtherMediaStateModel(
        isOn: false,
        isOnMixed: false,
        volume: null,
        isVolumeMixed: false,
        isMuted: false,
        isMutedMixed: false,
        devicesCount: 0,
        devicesOn: 0,
      ),
    );
  }
}
