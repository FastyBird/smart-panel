import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Input for building room overview model.
class RoomOverviewBuildInput {
  /// Display configuration.
  final DisplayModel display;

  /// Room (space) data.
  final SpaceView? room;

  /// Device categories for devices in this room.
  final List<DevicesModuleDeviceCategory> deviceCategories;

  /// Scenes for this room.
  final List<SceneView> scenes;

  /// Current time (for time-based suggestions).
  final DateTime now;

  /// Number of lights currently ON (if available).
  final int? lightsOnCount;

  /// Number of columns in display layout (for tiles-per-row calculation).
  final int displayCols;

  /// Number of devices with energy-related channels.
  final int energyDeviceCount;

  /// Number of sensor readings reported by the backend.
  final int sensorReadingsCount;

  const RoomOverviewBuildInput({
    required this.display,
    required this.room,
    required this.deviceCategories,
    required this.scenes,
    required this.now,
    this.lightsOnCount,
    this.displayCols = 4,
    this.energyDeviceCount = 0,
    this.sensorReadingsCount = 0,
  });
}

/// A chip displayed in the header showing domain status.
class HeaderStatusChip {
  final DomainType domain;
  final IconData icon;
  final String text;
  final String targetViewKey;

  const HeaderStatusChip({
    required this.domain,
    required this.icon,
    required this.text,
    required this.targetViewKey,
  });
}

/// A tile displayed in the room overview.
class DomainTile {
  final DomainType domain;
  final IconData icon;
  final String label;
  final int count;
  final String targetViewKey;

  const DomainTile({
    required this.domain,
    required this.icon,
    required this.label,
    required this.count,
    required this.targetViewKey,
  });
}

/// A quick scene button.
class QuickScene {
  final String sceneId;
  final String name;
  final ScenesModuleDataSceneCategory category;
  final IconData icon;

  const QuickScene({
    required this.sceneId,
    required this.name,
    required this.category,
    required this.icon,
  });
}

/// A suggested action.
class SuggestedAction {
  final String id;
  final String label;
  final IconData icon;

  /// Scene ID to trigger, or null for direct commands.
  final String? sceneId;

  /// Action type for non-scene actions.
  final SuggestedActionType actionType;

  const SuggestedAction({
    required this.id,
    required this.label,
    required this.icon,
    this.sceneId,
    this.actionType = SuggestedActionType.scene,
  });
}

enum SuggestedActionType {
  scene,
  turnOffLights,
}

/// Layout hints for UI rendering.
class LayoutHints {
  final int tilesPerRow;
  final int colSpan;

  const LayoutHints({
    required this.tilesPerRow,
    required this.colSpan,
  });
}

/// The complete room overview model for UI rendering.
class RoomOverviewModel {
  /// Room icon.
  final IconData icon;

  /// Room name/title.
  final String title;

  /// Header status chips (only for present domains).
  final List<HeaderStatusChip> statusChips;

  /// Domain tiles (only for present domains).
  final List<DomainTile> tiles;

  /// Quick scenes (max 4).
  final List<QuickScene> quickScenes;

  /// Suggested actions (max 3).
  final List<SuggestedAction> suggestedActions;

  /// Layout hints for UI.
  final LayoutHints layoutHints;

  /// Domain counts.
  final DomainCounts domainCounts;

  /// Whether the room has any devices in any domain.
  bool get hasAnyDomain => domainCounts.hasAnyDomain;

  /// Whether the room has any scenes.
  bool get hasScenes => quickScenes.isNotEmpty;

  const RoomOverviewModel({
    required this.icon,
    required this.title,
    required this.statusChips,
    required this.tiles,
    required this.quickScenes,
    required this.suggestedActions,
    required this.layoutHints,
    required this.domainCounts,
  });
}

/// Builds the room overview model from input data.
///
/// This is a pure function - same input always produces same output.
RoomOverviewModel buildRoomOverviewModel(RoomOverviewBuildInput input) {
  final room = input.room;
  final deviceCategories = input.deviceCategories;
  final scenes = input.scenes;
  final roomId = input.display.roomId ?? '';

  // Build domain counts
  final domainCounts = buildDomainCounts(
    deviceCategories,
    energyDeviceCount: input.energyDeviceCount,
    sensorReadingsCount: input.sensorReadingsCount,
  );

  // Build header status chips
  final statusChips = _buildStatusChips(domainCounts, roomId);

  // Build domain tiles
  final tiles = _buildTiles(domainCounts, roomId);

  // Build quick scenes (max 4, ordered by priority)
  final quickScenes = _buildQuickScenes(scenes);

  // Build suggested actions
  final suggestedActions = _buildSuggestedActions(
    input: input,
    domainCounts: domainCounts,
    quickScenes: quickScenes,
  );

  // Calculate layout hints
  final layoutHints = _calculateLayoutHints(
    numberOfTiles: tiles.length,
    displayCols: input.displayCols,
  );

  return RoomOverviewModel(
    icon: _mapSpaceIcon(room?.icon),
    title: room?.name ?? 'Room',
    statusChips: statusChips,
    tiles: tiles,
    quickScenes: quickScenes,
    suggestedActions: suggestedActions,
    layoutHints: layoutHints,
    domainCounts: domainCounts,
  );
}

List<HeaderStatusChip> _buildStatusChips(DomainCounts counts, String roomId) {
  // Exclude energy — it has its own header badge and is not a device-count domain
  return counts.presentDomains
      .where((domain) => domain != DomainType.energy)
      .map((domain) {
    return HeaderStatusChip(
      domain: domain,
      icon: domain.icon,
      text: '${counts.getCount(domain)}',
      targetViewKey: 'domain:$roomId:${domain.name}',
    );
  }).toList();
}

List<DomainTile> _buildTiles(DomainCounts counts, String roomId) {
  // Exclude energy — it has its own header badge and is not a device-count domain
  return counts.presentDomains
      .where((domain) => domain != DomainType.energy)
      .map((domain) {
    return DomainTile(
      domain: domain,
      icon: domain.icon,
      label: domain.label,
      count: counts.getCount(domain),
      targetViewKey: 'domain:$roomId:${domain.name}',
    );
  }).toList();
}

/// Scene category priority for room quick scenes (lower = higher priority).
int _getSceneCategoryPriority(ScenesModuleDataSceneCategory category) {
  switch (category) {
    case ScenesModuleDataSceneCategory.movie:
      return 0;
    case ScenesModuleDataSceneCategory.relax:
      return 1;
    case ScenesModuleDataSceneCategory.night:
      return 2;
    case ScenesModuleDataSceneCategory.work:
      return 3;
    case ScenesModuleDataSceneCategory.party:
      return 4;
    case ScenesModuleDataSceneCategory.morning:
      return 5;
    case ScenesModuleDataSceneCategory.lighting:
      return 6;
    case ScenesModuleDataSceneCategory.climate:
      return 7;
    case ScenesModuleDataSceneCategory.media:
      return 8;
    case ScenesModuleDataSceneCategory.generic:
    case ScenesModuleDataSceneCategory.custom:
    case ScenesModuleDataSceneCategory.away:
    case ScenesModuleDataSceneCategory.home:
    case ScenesModuleDataSceneCategory.security:
    case ScenesModuleDataSceneCategory.energy:
    case ScenesModuleDataSceneCategory.$unknown:
      return 99;
  }
}

List<QuickScene> _buildQuickScenes(List<SceneView> scenes) {
  // Filter for triggerable scenes only
  final triggerableScenes = scenes
      .where((s) => s.enabled && s.triggerable)
      .toList();

  // Sort by category priority, then by order
  triggerableScenes.sort((a, b) {
    final priorityCompare =
        _getSceneCategoryPriority(a.category).compareTo(_getSceneCategoryPriority(b.category));
    if (priorityCompare != 0) return priorityCompare;
    return a.order.compareTo(b.order);
  });

  // Take first 4
  return triggerableScenes.take(4).map((scene) {
    return QuickScene(
      sceneId: scene.id,
      name: scene.name,
      category: scene.category,
      icon: scene.iconData,
    );
  }).toList();
}

List<SuggestedAction> _buildSuggestedActions({
  required RoomOverviewBuildInput input,
  required DomainCounts domainCounts,
  required List<QuickScene> quickScenes,
}) {
  final suggestions = <SuggestedAction>[];
  final now = input.now;
  final lightsOnCount = input.lightsOnCount;

  // Helper to check if a scene category is in quick scenes
  bool hasQuickSceneWithCategory(ScenesModuleDataSceneCategory category) {
    return quickScenes.any((s) => s.category == category);
  }

  // Helper to find first triggerable scene by category
  SceneView? findSceneByCategory(ScenesModuleDataSceneCategory category) {
    return input.scenes
        .where((s) => s.category == category && s.enabled && s.triggerable)
        .firstOrNull;
  }

  // 1. Turn off lights suggestion (if lights present and some are ON)
  if (domainCounts.hasDomain(DomainType.lights) &&
      lightsOnCount != null &&
      lightsOnCount > 0) {
    suggestions.add(SuggestedAction(
      id: 'turn-off-lights',
      label: 'Turn off lights',
      icon: MdiIcons.lightbulbOutline,
      actionType: SuggestedActionType.turnOffLights,
    ));
  }

  // 2. Movie mode suggestion (if media + lights present and MOVIE scene exists)
  if (domainCounts.hasDomain(DomainType.lights) &&
      domainCounts.hasDomain(DomainType.media)) {
    final movieScene = findSceneByCategory(ScenesModuleDataSceneCategory.movie);
    if (movieScene != null && !hasQuickSceneWithCategory(ScenesModuleDataSceneCategory.movie)) {
      suggestions.add(SuggestedAction(
        id: 'movie-mode',
        label: 'Movie mode',
        icon: MdiIcons.movieOutline,
        sceneId: movieScene.id,
      ));
    }
  }

  // 3. Night mode suggestion (if 21:00-06:00 and NIGHT scene exists)
  final hour = now.hour;
  final isNightHours = hour >= 21 || hour < 6;
  if (isNightHours) {
    final nightScene = findSceneByCategory(ScenesModuleDataSceneCategory.night);
    if (nightScene != null && !hasQuickSceneWithCategory(ScenesModuleDataSceneCategory.night)) {
      suggestions.add(SuggestedAction(
        id: 'night-mode',
        label: 'Night mode',
        icon: MdiIcons.weatherNight,
        sceneId: nightScene.id,
      ));
    }
  }

  // Return max 3 suggestions
  return suggestions.take(3).toList();
}

LayoutHints _calculateLayoutHints({
  required int numberOfTiles,
  required int displayCols,
}) {
  int tilesPerRow;

  if (displayCols <= 3) {
    tilesPerRow = 1;
  } else if (displayCols <= 5) {
    tilesPerRow = 2;
  } else {
    // cols >= 6
    tilesPerRow = numberOfTiles <= 4 ? 2 : 3;
  }

  final colSpan = displayCols ~/ tilesPerRow;

  return LayoutHints(
    tilesPerRow: tilesPerRow,
    colSpan: colSpan,
  );
}

/// Maps a space icon string identifier to IconData.
IconData _mapSpaceIcon(String? iconId) {
  if (iconId == null || iconId.isEmpty) {
    return MdiIcons.homeOutline;
  }

  // Common room type icons
  switch (iconId) {
    case 'living-room':
    case 'living_room':
      return MdiIcons.sofa;
    case 'bedroom':
      return MdiIcons.bedEmpty;
    case 'kitchen':
      return MdiIcons.stove;
    case 'bathroom':
      return MdiIcons.shower;
    case 'office':
      return MdiIcons.desktopClassic;
    case 'garage':
      return MdiIcons.garage;
    case 'garden':
      return MdiIcons.flower;
    case 'basement':
      return MdiIcons.homeFloor0;
    case 'attic':
      return MdiIcons.homeRoof;
    case 'dining-room':
    case 'dining_room':
      return MdiIcons.tableChair;
    case 'hallway':
      return MdiIcons.doorOpen;
    case 'laundry':
      return MdiIcons.washingMachine;
    case 'nursery':
      return MdiIcons.babyFaceOutline;
    case 'gym':
      return MdiIcons.dumbbell;
    case 'pool':
      return MdiIcons.pool;
    case 'balcony':
      return MdiIcons.balcony;
    case 'terrace':
      return MdiIcons.umbrella;
    default:
      return MdiIcons.homeOutline;
  }
}
