import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Finds the light channel matching the target channel ID.
/// Returns null if the device has no light channels or the channel is not found.
///
/// This helper eliminates the duplicated channel lookup pattern:
/// ```dart
/// final channel = device.lightChannels.firstWhere(
///   (c) => c.id == target.channelId,
///   orElse: () => device.lightChannels.first,
/// );
/// if (channel.id != target.channelId) continue;
/// ```
LightChannelView? findLightChannel(
  LightingDeviceView device,
  String targetChannelId,
) {
  if (device.lightChannels.isEmpty) return null;

  final channel = device.lightChannels.firstWhere(
    (c) => c.id == targetChannelId,
    orElse: () => device.lightChannels.first,
  );

  // Return null if fallback was used (target channel not found)
  if (channel.id != targetChannelId) return null;

  return channel;
}

/// Strips room name from device name (case insensitive).
/// Capitalizes first letter if it becomes lowercase after stripping.
String stripRoomNameFromDevice(String deviceName, String? roomName) {
  if (roomName == null || roomName.isEmpty) return deviceName;

  final lowerDevice = deviceName.toLowerCase();
  final lowerRoom = roomName.toLowerCase();

  if (lowerDevice.startsWith(lowerRoom)) {
    String stripped = deviceName.substring(roomName.length).trim();
    if (stripped.isEmpty) return deviceName;

    // Capitalize first letter if it's lowercase
    if (stripped[0].toLowerCase() == stripped[0] &&
        stripped[0].toUpperCase() != stripped[0]) {
      stripped = stripped[0].toUpperCase() + stripped.substring(1);
    }
    return stripped;
  }
  return deviceName;
}

/// Get localized name for a light role.
String getLightRoleName(BuildContext context, LightTargetRole role) {
  final localizations = AppLocalizations.of(context)!;

  switch (role) {
    case LightTargetRole.main:
      return localizations.light_role_main;
    case LightTargetRole.ambient:
      return localizations.light_role_ambient;
    case LightTargetRole.task:
      return localizations.light_role_task;
    case LightTargetRole.accent:
      return localizations.light_role_accent;
    case LightTargetRole.night:
      return localizations.light_role_night;
    case LightTargetRole.other:
      return localizations.light_role_other;
    case LightTargetRole.hidden:
      return localizations.light_role_hidden;
  }
}

/// Get icon for a light role.
IconData getLightRoleIcon(LightTargetRole role) {
  switch (role) {
    case LightTargetRole.main:
      return MdiIcons.ceilingLight;
    case LightTargetRole.task:
      return MdiIcons.deskLamp;
    case LightTargetRole.ambient:
      return MdiIcons.wallSconce;
    case LightTargetRole.accent:
      return MdiIcons.floorLamp;
    case LightTargetRole.night:
      return MdiIcons.weatherNight;
    case LightTargetRole.other:
      return MdiIcons.lightbulbOutline;
    case LightTargetRole.hidden:
      return MdiIcons.eyeOff;
  }
}
