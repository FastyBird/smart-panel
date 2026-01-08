/// Item for batch property command
class PropertyCommandItem {
  final String deviceId;
  final String channelId;
  final String propertyId;
  final dynamic value;

  const PropertyCommandItem({
    required this.deviceId,
    required this.channelId,
    required this.propertyId,
    required this.value,
  });

  Map<String, dynamic> toJson() => {
        'device': deviceId,
        'channel': channelId,
        'property': propertyId,
        'value': value,
      };
}

/// Context for property command - provides metadata about where/how command was initiated
class PropertyCommandContext {
  /// Origin of the command (where it was initiated from)
  /// Valid values: 'panel.system.room', 'panel.system.master', 'panel.system.entry',
  /// 'panel.dashboard.tiles', 'panel.dashboard.cards', 'panel.device',
  /// 'panel.scenes', 'admin', 'api'
  final String? origin;

  /// Display ID that initiated the command
  final String? displayId;

  /// Space ID (room or zone) context - authoritative scope for filtering
  final String? spaceId;

  /// Domain hint (e.g., lighting role key: 'main', 'ambient', 'task', 'accent', 'night')
  final String? roleKey;

  /// Additional context data for future use
  final Map<String, dynamic>? extra;

  const PropertyCommandContext({
    this.origin,
    this.displayId,
    this.spaceId,
    this.roleKey,
    this.extra,
  });

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (origin != null) json['origin'] = origin;
    if (displayId != null) json['display_id'] = displayId;
    if (spaceId != null) json['space_id'] = spaceId;
    if (roleKey != null) json['role_key'] = roleKey;
    if (extra != null) json['extra'] = extra;
    return json;
  }
}
