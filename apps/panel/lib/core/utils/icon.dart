import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
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

/// Resolves a space icon: tries a custom MDI icon name first, then falls
/// back to a category-based default icon.
IconData resolveSpaceIcon(String? iconName, SpacesModuleDataSpaceCategory? category) {
  final customIcon = resolveIconNullable(iconName);
  if (customIcon != null) {
    return customIcon;
  }

  switch (category) {
    case SpacesModuleDataSpaceCategory.livingRoom:
      return MdiIcons.sofa;
    case SpacesModuleDataSpaceCategory.bedroom:
      return MdiIcons.bedKingOutline;
    case SpacesModuleDataSpaceCategory.bathroom:
      return MdiIcons.showerHead;
    case SpacesModuleDataSpaceCategory.kitchen:
      return MdiIcons.stove;
    case SpacesModuleDataSpaceCategory.office:
      return MdiIcons.deskLamp;
    case SpacesModuleDataSpaceCategory.garage:
      return MdiIcons.garage;
    case SpacesModuleDataSpaceCategory.outdoorGarden:
      return MdiIcons.flower;
    case SpacesModuleDataSpaceCategory.hallway:
    case SpacesModuleDataSpaceCategory.entryway:
      return MdiIcons.doorOpen;
    case SpacesModuleDataSpaceCategory.laundry:
      return MdiIcons.washingMachine;
    case SpacesModuleDataSpaceCategory.floorBasement:
      return MdiIcons.stairs;
    case SpacesModuleDataSpaceCategory.floorAttic:
      return MdiIcons.homeRoof;
    case SpacesModuleDataSpaceCategory.nursery:
      return MdiIcons.toyBrickOutline;
    case SpacesModuleDataSpaceCategory.diningRoom:
      return MdiIcons.tableFurniture;
    case SpacesModuleDataSpaceCategory.outdoorBalcony:
      return MdiIcons.balcony;
    case SpacesModuleDataSpaceCategory.outdoorTerrace:
      return MdiIcons.tableChair;
    case SpacesModuleDataSpaceCategory.guestRoom:
      return MdiIcons.bedOutline;
    case SpacesModuleDataSpaceCategory.gym:
      return MdiIcons.dumbbell;
    case SpacesModuleDataSpaceCategory.mediaRoom:
      return MdiIcons.television;
    case SpacesModuleDataSpaceCategory.workshop:
      return MdiIcons.hammerWrench;
    default:
      return MdiIcons.homeOutline;
  }
}
