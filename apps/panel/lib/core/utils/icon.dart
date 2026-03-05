import 'package:flutter/widgets.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Normalizes an icon name from the Iconify kebab-case format used by the
/// admin app (e.g. `"mdi:view-dashboard"`) to the camelCase format expected
/// by the `material_design_icons_flutter` package (e.g. `"viewDashboard"`).
String _normalizeMdiName(String name) {
  var normalized = name;

  // Strip the "mdi:" prefix used by the Iconify library in the admin app.
  if (normalized.startsWith('mdi:')) {
    normalized = normalized.substring(4);
  }

  // Convert kebab-case to camelCase for MdiIcons.fromString() lookup.
  if (normalized.contains('-')) {
    normalized = normalized.replaceAllMapped(
      RegExp(r'-([a-z0-9])'),
      (match) => match.group(1)!.toUpperCase(),
    );
  }

  return normalized;
}

/// Resolves an icon string (as stored in the backend) to Flutter [IconData].
///
/// Handles the following formats:
/// - `"mdi:view-dashboard"` (Iconify MDI format from admin app, kebab-case)
/// - `"view-dashboard"` (plain kebab-case MDI icon name)
/// - `"viewDashboard"` (camelCase, as used by material_design_icons_flutter)
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
