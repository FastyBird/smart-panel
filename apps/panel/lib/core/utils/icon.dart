import 'package:flutter/widgets.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Normalizes an icon name by stripping the "mdi:" prefix used by
/// the Iconify library in the admin app.
String _normalizeMdiName(String name) {
  if (name.startsWith('mdi:')) {
    return name.substring(4);
  }
  return name;
}

/// Resolves an icon string (as stored in the backend) to Flutter [IconData].
///
/// Handles the following formats:
/// - `"mdi:icon-name"` (Iconify MDI format from admin app)
/// - `"icon-name"` (plain MDI icon name)
///
/// Returns [fallback] when the icon string is null, empty, or not found
/// in the MDI icon set.
IconData resolveIcon(String? iconName, {IconData? fallback}) {
  final defaultIcon = fallback ?? MdiIcons.helpCircleOutline;

  if (iconName == null || iconName.isEmpty) {
    return defaultIcon;
  }

  return MdiIcons.fromString(_normalizeMdiName(iconName)) ?? defaultIcon;
}

/// Resolves an icon string to Flutter [IconData], returning null when the
/// icon string is null, empty, or not found.
///
/// Use this variant for optional icon fields in models.
IconData? resolveIconNullable(String? iconName) {
  if (iconName == null || iconName.isEmpty) {
    return null;
  }

  return MdiIcons.fromString(_normalizeMdiName(iconName));
}
