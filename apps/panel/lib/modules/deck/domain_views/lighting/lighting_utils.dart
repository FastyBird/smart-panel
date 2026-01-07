import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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

/// Get localized name for a light role
/// TODO: Add proper localization strings (light_role_main, light_role_ambient, etc.)
String getLightRoleName(BuildContext context, LightTargetRole role) {
  switch (role) {
    case LightTargetRole.main:
      return 'Main';
    case LightTargetRole.ambient:
      return 'Ambient';
    case LightTargetRole.task:
      return 'Task';
    case LightTargetRole.accent:
      return 'Accent';
    case LightTargetRole.night:
      return 'Night';
    case LightTargetRole.other:
      return 'Other';
  }
}

/// Get icon for a light role
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
  }
}
