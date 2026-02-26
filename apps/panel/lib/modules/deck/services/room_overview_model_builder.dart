import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
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

  /// Number of media devices currently on.
  final int mediaOnCount;

  /// Resolved display units for temperature formatting.
  final DisplayUnits displayUnits;

  /// Cached lighting state from the space state API.
  final LightingStateModel? lightingState;

  /// Cached climate state from the space state API.
  final ClimateStateModel? climateState;

  /// Cached covers state from the space state API.
  final CoversStateModel? coversState;

  /// Cached sensor state from the space state API.
  final SensorStateModel? sensorState;

  /// Cached media active state from the media activity service.
  final MediaActiveStateModel? mediaState;

  const RoomOverviewBuildInput({
    required this.display,
    required this.room,
    required this.deviceCategories,
    required this.scenes,
    required this.now,
    this.displayUnits = DisplayUnits.metric,
    this.lightsOnCount,
    this.energyDeviceCount = 0,
    this.sensorReadingsCount = 0,
    this.temperature,
    this.humidity,
    this.shadingPosition,
    this.mediaOnCount = 0,
    this.lightingState,
    this.climateState,
    this.coversState,
    this.sensorState,
    this.mediaState,
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
/// An icon + text pair for subtitle items.
class SubtitleItem {
  final IconData? icon;
  final String text;
  final bool compactHidden;

  const SubtitleItem({this.icon, required this.text, this.compactHidden = false});
}

/// Types of quick actions available on domain cards.
enum QuickActionType {
  lightsOff,
  lightsHalf,
  lightsFull,
  climateMode,
  climateMinus,
  climatePlus,
  coversClose,
  coversHalf,
  coversOpen,
}

/// A quick action button on a domain card.
class QuickActionInfo {
  final QuickActionType type;
  final IconData icon;
  final String? label;

  const QuickActionInfo({required this.type, required this.icon, this.label});
}

class DomainCardInfo {
  final DomainType domain;
  final IconData icon;
  final String title;
  final String primaryValue;
  final String? targetValue;
  final IconData? targetIcon;
  final String subtitle;
  final List<SubtitleItem> subtitleItems;
  final List<QuickActionInfo> actions;
  final bool isActive;

  const DomainCardInfo({
    required this.domain,
    required this.icon,
    required this.title,
    required this.primaryValue,
    this.targetValue,
    this.targetIcon,
    required this.subtitle,
    this.subtitleItems = const [],
    this.actions = const [],
    this.isActive = false,
  });
}

/// A sensor reading displayed in the sensor strip at the bottom.
class SensorReading {
  final IconData icon;
  final String label;
  final String value;
  final ThemeColors color;

  const SensorReading({
    required this.icon,
    required this.label,
    required this.value,
    this.color = ThemeColors.info,
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
  required RoomOverviewBuildInput input,
}) {
  final cards = <DomainCardInfo>[];

  for (final domain in domainCounts.presentDomains) {
    if (domain == DomainType.energy || domain == DomainType.sensors) continue;

    final count = domainCounts.getCount(domain);

    switch (domain) {
      case DomainType.lights:
        cards.add(_buildLightsCard(domain, count, input));
        break;

      case DomainType.climate:
        cards.add(_buildClimateCard(domain, count, input));
        break;

      case DomainType.shading:
        cards.add(_buildShadingCard(domain, count, input));
        break;

      case DomainType.media:
        cards.add(_buildMediaCard(domain, input));
        break;

      case DomainType.sensors:
        cards.add(_buildSensorsCard(domain, domainCounts, input));
        break;

      case DomainType.energy:
        break;
    }
  }

  return cards;
}

DomainCardInfo _buildLightsCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final ls = input.lightingState;
  final lightsOn = ls?.lightsOn ?? input.lightsOnCount ?? 0;
  final totalLights = ls?.totalLights ?? count;
  final isActive = lightsOn > 0;

  // Primary value — same intent logic as the mode selector in lights domain view:
  // 1. Intent active and confirmed (isModeFromIntent + detectedMode) → mode name
  // 2. Lights on but no active intent → "Custom"
  // 3. All off → "Off"
  String primaryValue;
  if (ls != null &&
      ls.isModeFromIntent &&
      ls.detectedMode != null &&
      ls.detectedMode != LightingMode.off) {
    primaryValue = _lightingModeLabel(ls.detectedMode!);
  } else if (isActive) {
    primaryValue = 'Custom';
  } else {
    primaryValue = 'Off';
  }

  final subtitle = isActive
      ? '$lightsOn of $totalLights active'
      : '$totalLights light${totalLights != 1 ? 's' : ''}';

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.label,
    primaryValue: primaryValue,
    subtitle: subtitle,
    actions: [
      QuickActionInfo(type: QuickActionType.lightsOff, icon: MdiIcons.lightbulbOff, label: 'Off'),
      QuickActionInfo(type: QuickActionType.lightsHalf, icon: MdiIcons.brightnessAuto, label: '50%'),
      QuickActionInfo(type: QuickActionType.lightsFull, icon: MdiIcons.brightness7, label: '100%'),
    ],
    isActive: isActive,
  );
}

String _lightingModeLabel(LightingMode mode) {
  switch (mode) {
    case LightingMode.work:
      return 'Work';
    case LightingMode.relax:
      return 'Relax';
    case LightingMode.night:
      return 'Night';
    case LightingMode.off:
      return 'Off';
  }
}

DomainCardInfo _buildClimateCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final cs = input.climateState;
  final fmt = NumberFormatUtils.defaultFormat;
  final tempUnit = input.displayUnits.temperature;

  // Primary: target temp when available, fallback to current temp, then count
  String primaryValue;
  if (cs?.isOff == true) {
    primaryValue = 'Off';
  } else if (cs?.effectiveTargetTemperature != null) {
    final target = cs!.effectiveTargetTemperature!;
    primaryValue = '${fmt.formatDecimal(UnitConverter.convertTemperature(target, tempUnit), decimalPlaces: 1)}${UnitConverter.temperatureSymbol(tempUnit)}';
  } else {
    final temp = cs?.currentTemperature ?? input.temperature;
    if (temp != null) {
      primaryValue = '${fmt.formatDecimal(UnitConverter.convertTemperature(temp, tempUnit), decimalPlaces: 1)}${UnitConverter.temperatureSymbol(tempUnit)}';
    } else {
      primaryValue = '$count';
    }
  }

  // Mode label and icon for the mode action button
  String modeLabel;
  IconData modeIcon;
  final currentMode = cs?.mode;
  switch (currentMode) {
    case ClimateMode.heat:
      modeLabel = 'Heat';
      modeIcon = MdiIcons.fire;
      break;
    case ClimateMode.cool:
      modeLabel = 'Cool';
      modeIcon = MdiIcons.snowflake;
      break;
    case ClimateMode.auto:
      modeLabel = 'Auto';
      modeIcon = MdiIcons.autorenew;
      break;
    case ClimateMode.off:
    case null:
      modeLabel = 'Off';
      modeIcon = MdiIcons.power;
      break;
  }

  final subtitle = '$count device${count != 1 ? 's' : ''}';
  final temp = cs?.currentTemperature ?? input.temperature;
  final isActive = cs != null ? (cs.mode != ClimateMode.off && cs.mode != null) : temp != null;

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.label,
    primaryValue: primaryValue,
    subtitle: subtitle,
    actions: [
      QuickActionInfo(type: QuickActionType.climateMode, icon: modeIcon, label: modeLabel),
      QuickActionInfo(type: QuickActionType.climateMinus, icon: MdiIcons.minus),
      QuickActionInfo(type: QuickActionType.climatePlus, icon: MdiIcons.plus),
    ],
    isActive: isActive,
  );
}

DomainCardInfo _buildShadingCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final cvs = input.coversState;

  // Primary: detected mode label if intent active, else "Custom" when open, "Closed" when all closed
  final isActive = cvs?.anyOpen ?? (input.shadingPosition != null && input.shadingPosition! > 0);
  final allClosed = cvs?.allClosed ?? !isActive;

  String primaryValue;
  if (cvs != null &&
      cvs.isModeFromIntent &&
      cvs.detectedMode != null) {
    primaryValue = _coversModeLabel(cvs.detectedMode!);
  } else if (allClosed) {
    primaryValue = 'Closed';
  } else {
    primaryValue = 'Custom';
  }

  // Subtitle: position description
  String subtitle;
  final pos = cvs?.averagePosition ?? input.shadingPosition;
  if (pos != null) {
    if (pos == 0) {
      subtitle = 'Fully closed';
    } else if (pos == 100) {
      subtitle = 'Fully open';
    } else {
      subtitle = '$pos% open';
    }
  } else {
    subtitle = '$count device${count != 1 ? 's' : ''}';
  }

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.label,
    primaryValue: primaryValue,
    subtitle: subtitle,
    actions: [
      QuickActionInfo(type: QuickActionType.coversClose, icon: MdiIcons.arrowCollapseVertical, label: 'Close'),
      QuickActionInfo(type: QuickActionType.coversHalf, icon: MdiIcons.arrowSplitHorizontal, label: '50%'),
      QuickActionInfo(type: QuickActionType.coversOpen, icon: MdiIcons.arrowExpandVertical, label: 'Open'),
    ],
    isActive: isActive,
  );
}

String _coversModeLabel(CoversMode mode) {
  switch (mode) {
    case CoversMode.open:
      return 'Open';
    case CoversMode.closed:
      return 'Closed';
    case CoversMode.privacy:
      return 'Privacy';
    case CoversMode.daylight:
      return 'Daylight';
  }
}

DomainCardInfo _buildMediaCard(
  DomainType domain,
  RoomOverviewBuildInput input,
) {
  final ms = input.mediaState;

  // Primary: activity label if active, else "Off"
  final isActive = ms?.isActive ?? false;
  final primaryValue = isActive && ms?.activityKey != null && ms!.activityKey != MediaActivityKey.off
      ? _mediaActivityLabel(ms.activityKey!)
      : 'Off';

  final subtitle = '';

  return DomainCardInfo(
    domain: domain,
    icon: isActive ? MdiIcons.playCircle : domain.icon,
    title: domain.label,
    primaryValue: primaryValue,
    subtitle: subtitle,
    isActive: isActive,
  );
}

String _mediaActivityLabel(MediaActivityKey key) {
  switch (key) {
    case MediaActivityKey.watch:
      return 'Watch';
    case MediaActivityKey.listen:
      return 'Listen';
    case MediaActivityKey.gaming:
      return 'Gaming';
    case MediaActivityKey.background:
      return 'Background';
    case MediaActivityKey.off:
      return 'Off';
  }
}

DomainCardInfo _buildSensorsCard(
  DomainType domain,
  DomainCounts domainCounts,
  RoomOverviewBuildInput input,
) {
  final ss = input.sensorState;
  final readingsCount = domainCounts.sensorReadings;
  final displayUnits = input.displayUnits;

  final primaryValue = '$readingsCount';

  // Subtitle items with icons — same values as sensors domain view env summary
  final items = <SubtitleItem>[];
  final env = ss?.environment;
  if (env?.averageTemperature != null) {
    items.add(SubtitleItem(
      icon: MdiIcons.thermometer,
      text: SensorUtils.formatNumericValueWithUnit(
        env!.averageTemperature!,
        DevicesModuleChannelCategory.temperature,
        displayUnits: displayUnits,
      ),
    ));
  }
  if (env?.averageHumidity != null) {
    items.add(SubtitleItem(
      icon: MdiIcons.waterPercent,
      text: SensorUtils.formatNumericValueWithUnit(
        env!.averageHumidity!,
        DevicesModuleChannelCategory.humidity,
        displayUnits: displayUnits,
      ),
    ));
  }
  if (env?.averageIlluminance != null) {
    items.add(SubtitleItem(
      icon: MdiIcons.weatherSunny,
      text: SensorUtils.formatNumericValueWithUnit(
        env!.averageIlluminance!,
        DevicesModuleChannelCategory.illuminance,
        displayUnits: displayUnits,
      ),
      compactHidden: true,
    ));
  }

  final subtitleText = items.isNotEmpty
      ? items.map((i) => i.text).join(' \u00B7 ')
      : '$readingsCount reading${readingsCount != 1 ? 's' : ''}';

  final hasEnv = items.isNotEmpty;

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.label,
    primaryValue: primaryValue,
    subtitle: subtitleText,
    subtitleItems: items,
    isActive: hasEnv,
  );
}

/// Builds sensor readings for the bottom strip from sensor state environment averages.
List<SensorReading> _buildSensorReadings(RoomOverviewBuildInput input) {
  final readings = <SensorReading>[];
  final env = input.sensorState?.environment;
  final displayUnits = input.displayUnits;

  final temp = env?.averageTemperature ?? input.temperature;
  if (temp != null) {
    readings.add(SensorReading(
      icon: MdiIcons.thermometer,
      label: 'Temp',
      value: SensorUtils.formatNumericValueWithUnit(
        temp,
        DevicesModuleChannelCategory.temperature,
        displayUnits: displayUnits,
      ),
      color: SensorColors.temperature,
    ));
  }

  final humidity = env?.averageHumidity ?? input.humidity;
  if (humidity != null) {
    readings.add(SensorReading(
      icon: MdiIcons.waterPercent,
      label: 'Humidity',
      value: SensorUtils.formatNumericValueWithUnit(
        humidity,
        DevicesModuleChannelCategory.humidity,
        displayUnits: displayUnits,
      ),
      color: SensorColors.humidity,
    ));
  }

  if (env?.averageIlluminance != null) {
    readings.add(SensorReading(
      icon: MdiIcons.weatherSunny,
      label: 'Light',
      value: SensorUtils.formatNumericValueWithUnit(
        env!.averageIlluminance!,
        DevicesModuleChannelCategory.illuminance,
        displayUnits: displayUnits,
      ),
      color: SensorColors.themeColorForCategory(DevicesModuleChannelCategory.illuminance),
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
