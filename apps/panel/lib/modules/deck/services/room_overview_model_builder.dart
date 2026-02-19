import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
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

  /// Number of devices with energy-related channels.
  final int energyDeviceCount;

  /// Number of sensor readings reported by the backend.
  final int sensorReadingsCount;

  /// Current temperature reading (if available).
  final double? temperature;

  /// Current humidity reading (if available).
  final double? humidity;

  /// Shading position percentage (if available).
  final int? shadingPosition;

  /// Number of media devices currently playing.
  final int mediaPlayingCount;

  const RoomOverviewBuildInput({
    required this.display,
    required this.room,
    required this.deviceCategories,
    required this.scenes,
    required this.now,
    this.lightsOnCount,
    this.energyDeviceCount = 0,
    this.sensorReadingsCount = 0,
    this.temperature,
    this.humidity,
    this.shadingPosition,
    this.mediaPlayingCount = 0,
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

/// Summary info for a domain card in the room overview.
///
/// This model provides the data needed to render a rich domain card,
/// inspired by the deck mock designs. Each domain shows:
/// - Primary value (e.g., temperature, "3 on", position)
/// - Optional target value (e.g., setpoint temperature)
/// - Subtitle with additional context
/// - Active state for visual accent
class DomainCardInfo {
  final DomainType domain;
  final IconData icon;
  final String title;
  final String primaryValue;
  final String? targetValue;
  final String subtitle;
  final bool isActive;
  final int count;
  final String targetViewKey;

  const DomainCardInfo({
    required this.domain,
    required this.icon,
    required this.title,
    required this.primaryValue,
    this.targetValue,
    required this.subtitle,
    this.isActive = false,
    required this.count,
    required this.targetViewKey,
  });
}

/// A sensor reading displayed in the sensor strip at the bottom.
class SensorReading {
  final IconData icon;
  final String label;
  final String value;

  const SensorReading({
    required this.icon,
    required this.label,
    required this.value,
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

/// The complete room overview model for UI rendering.
class RoomOverviewModel {
  /// Room icon.
  final IconData icon;

  /// Room name/title.
  final String title;

  /// Domain card infos with rich summary data for card rendering.
  final List<DomainCardInfo> domainCards;

  /// Quick scenes (max 4).
  final List<QuickScene> quickScenes;

  /// Suggested actions (max 3).
  final List<SuggestedAction> suggestedActions;

  /// Sensor readings for the bottom strip.
  final List<SensorReading> sensorReadings;

  /// Domain counts.
  final DomainCounts domainCounts;

  /// Whether the room has any devices in any domain.
  bool get hasAnyDomain => domainCounts.hasAnyDomain;

  /// Whether the room has any scenes.
  bool get hasScenes => quickScenes.isNotEmpty;

  /// Whether the room has sensor readings for the strip.
  bool get hasSensorReadings => sensorReadings.isNotEmpty;

  const RoomOverviewModel({
    required this.icon,
    required this.title,
    required this.domainCards,
    required this.quickScenes,
    required this.suggestedActions,
    required this.sensorReadings,
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

  // Build quick scenes (max 4, ordered by priority)
  final quickScenes = _buildQuickScenes(scenes);

  // Build suggested actions
  final suggestedActions = _buildSuggestedActions(
    input: input,
    domainCounts: domainCounts,
    quickScenes: quickScenes,
  );

  // Build domain cards with rich summary data
  final domainCards = _buildDomainCards(
    domainCounts: domainCounts,
    roomId: roomId,
    input: input,
  );

  // Build sensor readings for the strip
  final sensorReadings = _buildSensorReadings(input);

  return RoomOverviewModel(
    icon: _mapSpaceIcon(room?.icon),
    title: room?.name ?? 'Room',
    domainCards: domainCards,
    quickScenes: quickScenes,
    suggestedActions: suggestedActions,
    sensorReadings: sensorReadings,
    domainCounts: domainCounts,
  );
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

List<DomainCardInfo> _buildDomainCards({
  required DomainCounts domainCounts,
  required String roomId,
  required RoomOverviewBuildInput input,
}) {
  final cards = <DomainCardInfo>[];

  for (final domain in domainCounts.presentDomains) {
    if (domain == DomainType.energy) continue;

    final count = domainCounts.getCount(domain);
    final targetViewKey = 'domain:$roomId:${domain.name}';

    switch (domain) {
      case DomainType.climate:
        final fmt = NumberFormatUtils.defaultFormat;
        final temp = input.temperature;
        final humidity = input.humidity;
        final primaryValue = temp != null
            ? '${fmt.formatDecimal(temp, decimalPlaces: 1)}\u00B0'
            : '$count';
        final subtitleParts = <String>[];
        if (humidity != null) {
          subtitleParts.add('${fmt.formatDecimal(humidity, decimalPlaces: 0)}% humidity');
        }
        if (subtitleParts.isEmpty) {
          subtitleParts.add('$count device${count != 1 ? 's' : ''}');
        }

        cards.add(DomainCardInfo(
          domain: domain,
          icon: domain.icon,
          title: domain.label,
          primaryValue: primaryValue,
          subtitle: subtitleParts.join(' \u00B7 '),
          isActive: temp != null,
          count: count,
          targetViewKey: targetViewKey,
        ));
        break;

      case DomainType.lights:
        final lightsOn = input.lightsOnCount ?? 0;
        final isActive = lightsOn > 0;
        final primaryValue = isActive ? '$lightsOn on' : 'Off';
        final subtitle = isActive
            ? '$lightsOn of $count active'
            : '$count light${count != 1 ? 's' : ''}';

        cards.add(DomainCardInfo(
          domain: domain,
          icon: domain.icon,
          title: domain.label,
          primaryValue: primaryValue,
          subtitle: subtitle,
          isActive: isActive,
          count: count,
          targetViewKey: targetViewKey,
        ));
        break;

      case DomainType.shading:
        final position = input.shadingPosition;
        final primaryValue = position != null ? '$position%' : '$count';
        final subtitle = position != null
            ? (position == 0
                ? 'Fully closed'
                : position == 100
                    ? 'Fully open'
                    : 'Partially open')
            : '$count device${count != 1 ? 's' : ''}';

        cards.add(DomainCardInfo(
          domain: domain,
          icon: domain.icon,
          title: domain.label,
          primaryValue: primaryValue,
          subtitle: subtitle,
          isActive: position != null && position > 0,
          count: count,
          targetViewKey: targetViewKey,
        ));
        break;

      case DomainType.media:
        final playing = input.mediaPlayingCount;
        final isActive = playing > 0;
        final primaryValue = isActive ? '$playing playing' : 'Off';
        final subtitle = '$count device${count != 1 ? 's' : ''}';

        cards.add(DomainCardInfo(
          domain: domain,
          icon: isActive ? MdiIcons.playCircle : domain.icon,
          title: domain.label,
          primaryValue: primaryValue,
          subtitle: subtitle,
          isActive: isActive,
          count: count,
          targetViewKey: targetViewKey,
        ));
        break;

      case DomainType.sensors:
        final readingsCount = domainCounts.sensorReadings;
        cards.add(DomainCardInfo(
          domain: domain,
          icon: domain.icon,
          title: domain.label,
          primaryValue: '$readingsCount',
          subtitle: '$readingsCount reading${readingsCount != 1 ? 's' : ''}',
          isActive: false,
          count: count,
          targetViewKey: targetViewKey,
        ));
        break;

      case DomainType.energy:
        break;
    }
  }

  return cards;
}

/// Builds sensor readings for the bottom strip from raw input values.
List<SensorReading> _buildSensorReadings(RoomOverviewBuildInput input) {
  final readings = <SensorReading>[];
  final fmt = NumberFormatUtils.defaultFormat;

  if (input.temperature != null) {
    readings.add(SensorReading(
      icon: MdiIcons.thermometer,
      label: 'Temp',
      value: '${fmt.formatDecimal(input.temperature!, decimalPlaces: 1)}\u00B0',
    ));
  }

  if (input.humidity != null) {
    readings.add(SensorReading(
      icon: MdiIcons.waterPercent,
      label: 'Humidity',
      value: '${fmt.formatDecimal(input.humidity!, decimalPlaces: 0)}%',
    ));
  }

  return readings;
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
