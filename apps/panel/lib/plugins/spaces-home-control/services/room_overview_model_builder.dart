import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/core/utils/icon.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/export.dart';
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

  /// Localizations for translating UI strings.
  final AppLocalizations localizations;

  const RoomOverviewBuildInput({
    required this.display,
    required this.room,
    required this.deviceCategories,
    required this.scenes,
    required this.now,
    required this.localizations,
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

  const SubtitleItem({
    this.icon,
    required this.text,
    this.compactHidden = false,
  });
}

/// Types of quick actions available on domain cards.
enum QuickActionType {
  lightsOff,
  lightsOn,
  lightsHalf,
  lightsFull,
  climateMode,
  climateMinus,
  climatePlus,
  coversClose,
  coversHalf,
  coversOpen,
  mediaPlay,
  mediaPause,
  mediaStop,
}

/// A quick action button on a domain card: a short label, or an icon when
/// [label] is null.
class QuickActionInfo {
  final QuickActionType type;
  final IconData icon;
  final String? label;
  final bool disabled;

  /// Whether it matches the domain's state now ("Off" while the lights are
  /// off); drawn in the domain's tint.
  final bool selected;

  /// What screen readers hear; defaults to [label].
  final String? semanticLabel;

  const QuickActionInfo({
    required this.type,
    required this.icon,
    this.label,
    this.disabled = false,
    this.selected = false,
    this.semanticLabel,
  });

  QuickActionInfo copyWith({
    IconData? icon,
    String? label,
    bool? selected,
    String? semanticLabel,
  }) => QuickActionInfo(
    type: type,
    icon: icon ?? this.icon,
    label: label ?? this.label,
    disabled: disabled,
    selected: selected ?? this.selected,
    semanticLabel: semanticLabel ?? this.semanticLabel,
  );
}

/// One domain card on the room overview (docs/display-ui-design-spec.md
/// §4, §9): the domain's state, never a domain mode name.
///
/// - [primaryValue] and [unit]: "50" " %", "21.5" "°", "Off", "Watch".
/// - [subtitle]: the state line, "3 of 4 active", "Heating"; screen readers
///   hear [spokenSubtitle] instead when there is one ("Heating to 22°").
/// - [target]: "22°", shown under the value.
/// - [actions]: three quick actions; [compactActions] the two a narrow card
///   keeps.
class DomainCardInfo {
  final DomainType domain;
  final IconData icon;
  final String title;
  final String primaryValue;
  final String? unit;
  final String? target;
  final String subtitle;
  final String? spokenSubtitle;
  final List<SubtitleItem> subtitleItems;
  final List<QuickActionInfo> actions;
  final List<QuickActionInfo> compactActions;
  final bool isActive;

  const DomainCardInfo({
    required this.domain,
    required this.icon,
    required this.title,
    required this.primaryValue,
    this.unit,
    this.target,
    required this.subtitle,
    this.spokenSubtitle,
    this.subtitleItems = const [],
    this.actions = const [],
    this.compactActions = const [],
    this.isActive = false,
  });

  /// An optimistic value replaces the value and its unit together.
  DomainCardInfo copyWith({
    String? primaryValue,
    String? unit,
    bool clearUnit = false,
    bool? isActive,
    List<QuickActionInfo>? actions,
    List<QuickActionInfo>? compactActions,
  }) => DomainCardInfo(
    domain: domain,
    icon: icon,
    title: title,
    primaryValue: primaryValue ?? this.primaryValue,
    unit: clearUnit ? null : unit ?? this.unit,
    target: target,
    subtitle: subtitle,
    spokenSubtitle: spokenSubtitle,
    subtitleItems: subtitleItems,
    actions: actions ?? this.actions,
    compactActions: compactActions ?? this.compactActions,
    isActive: isActive ?? this.isActive,
  );
}

/// A card while a quick action waits for the room to report back: the value
/// it expects ([primaryValue] and [unit] together), whether the domain is
/// on, and for Climate the new mode's label, icon and spoken label.
///
/// The selection follows: Off is selected while the lights are off and On
/// (or the Climate mode button) while they are on.
DomainCardInfo optimisticCard(
  DomainCardInfo card, {
  String? primaryValue,
  String? unit,
  bool? isActive,
  ({String label, IconData icon, String semanticLabel, bool on})? climateMode,
}) {
  List<QuickActionInfo> select(List<QuickActionInfo> actions, bool on) => [
    for (final action in actions)
      switch (action.type) {
        QuickActionType.lightsOff => action.copyWith(selected: !on),
        QuickActionType.lightsOn => action.copyWith(selected: on),
        // The brightness presets only match a reported brightness.
        QuickActionType.lightsHalf ||
        QuickActionType.lightsFull => action.copyWith(selected: false),
        _ => action,
      },
  ];

  var actions = card.actions;
  var compactActions = card.compactActions;

  if (card.domain == DomainType.lights && isActive != null) {
    actions = select(actions, isActive);
    compactActions = select(compactActions, isActive);
  }

  if (climateMode != null &&
      card.domain == DomainType.climate &&
      actions.isNotEmpty &&
      actions.first.type == QuickActionType.climateMode) {
    actions = [
      actions.first.copyWith(
        label: climateMode.label,
        icon: climateMode.icon,
        selected: climateMode.on,
        semanticLabel: climateMode.semanticLabel,
      ),
      ...actions.skip(1),
    ];
  }

  return card.copyWith(
    primaryValue: primaryValue,
    unit: unit,
    clearUnit: primaryValue != null && unit == null,
    isActive: isActive,
    actions: actions,
    compactActions: compactActions,
  );
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

enum SuggestedActionType { scene, turnOffLights }

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
    icon: resolveSpaceIcon(room?.icon, room?.category),
    title: room?.name ?? input.localizations.room_name_fallback,
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
    final priorityCompare = _getSceneCategoryPriority(
      a.category,
    ).compareTo(_getSceneCategoryPriority(b.category));
    if (priorityCompare != 0) return priorityCompare;
    return a.order.compareTo(b.order);
  });

  return triggerableScenes.map((scene) {
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
    suggestions.add(
      SuggestedAction(
        id: 'turn-off-lights',
        label: input.localizations.suggested_action_turn_off_lights,
        icon: MdiIcons.lightbulbOutline,
        actionType: SuggestedActionType.turnOffLights,
      ),
    );
  }

  // 2. Movie mode suggestion (if media + lights present and MOVIE scene exists)
  if (domainCounts.hasDomain(DomainType.lights) &&
      domainCounts.hasDomain(DomainType.media)) {
    final movieScene = findSceneByCategory(ScenesModuleDataSceneCategory.movie);
    if (movieScene != null &&
        !hasQuickSceneWithCategory(ScenesModuleDataSceneCategory.movie)) {
      suggestions.add(
        SuggestedAction(
          id: 'movie-mode',
          label: input.localizations.suggested_action_movie_mode,
          icon: MdiIcons.movieOutline,
          sceneId: movieScene.id,
        ),
      );
    }
  }

  // 3. Night mode suggestion (if 21:00-06:00 and NIGHT scene exists)
  final hour = now.hour;
  final isNightHours = hour >= 21 || hour < 6;
  if (isNightHours) {
    final nightScene = findSceneByCategory(ScenesModuleDataSceneCategory.night);
    if (nightScene != null &&
        !hasQuickSceneWithCategory(ScenesModuleDataSceneCategory.night)) {
      suggestions.add(
        SuggestedAction(
          id: 'night-mode',
          label: input.localizations.suggested_action_night_mode,
          icon: MdiIcons.weatherNight,
          sceneId: nightScene.id,
        ),
      );
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
        cards.add(_buildMediaCard(domain, count, input));
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
  final l = input.localizations;
  final ls = input.lightingState;
  final lightsOn = ls?.lightsOn ?? input.lightsOnCount ?? 0;
  final totalLights = ls?.totalLights ?? count;
  final isActive = lightsOn > 0;
  final brightness = ls?.averageBrightness?.round();

  // The state, never the lighting mode: the brightness while lights are on,
  // "On" without one, "Off".
  final String primaryValue;
  String? unit;
  if (!isActive) {
    primaryValue = l.light_state_off;
  } else if (brightness != null) {
    primaryValue = '$brightness';
    unit = ' %';
  } else {
    primaryValue = l.light_state_on;
  }

  final subtitle = isActive
      ? l.room_overview_lights_active(lightsOn, totalLights)
      : l.room_overview_light_count(totalLights);

  final off = QuickActionInfo(
    type: QuickActionType.lightsOff,
    icon: MdiIcons.lightbulbOff,
    label: l.light_state_off,
    selected: !isActive,
  );

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.localizedLabel(l),
    primaryValue: primaryValue,
    unit: unit,
    subtitle: subtitle,
    actions: [
      off,
      QuickActionInfo(
        type: QuickActionType.lightsHalf,
        icon: MdiIcons.brightnessAuto,
        label: '50%',
        selected:
            isActive && brightness != null && (brightness - 50).abs() <= 2,
      ),
      QuickActionInfo(
        type: QuickActionType.lightsFull,
        icon: MdiIcons.brightness7,
        label: '100%',
        selected: isActive && brightness != null && brightness >= 98,
      ),
    ],
    compactActions: [
      off,
      QuickActionInfo(
        type: QuickActionType.lightsOn,
        icon: MdiIcons.lightbulbOn,
        label: l.light_state_on,
        selected: isActive,
      ),
    ],
    isActive: isActive,
  );
}

DomainCardInfo _buildClimateCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final l = input.localizations;
  final cs = input.climateState;
  final contribution = cs?.temperatureContribution;
  final currentTemperature = contribution?.isUnavailable == true
      ? null
      : cs?.currentTemperature ??
            (contribution == null ? input.temperature : null);
  final tempUnit = input.displayUnits.temperature;

  String format(double value) => NumberUtils.formatDecimal(
    UnitConverter.convertTemperature(value, tempUnit),
    decimalPlaces: 1,
  );

  // A target in the card's short form: "22°", "22.5°".
  String degrees(double value) {
    final converted = UnitConverter.convertTemperature(value, tempUnit);
    final whole = (converted * 10).round() % 10 == 0;

    return '${NumberUtils.formatDecimal(converted, decimalPlaces: whole ? 0 : 1)}\u00B0';
  }

  // The value is the room's temperature now; the state line says what the
  // climate is doing about it.
  final String primaryValue;
  String? unit;
  if (currentTemperature != null) {
    primaryValue = format(currentTemperature);
    unit = '°';
  } else if (cs?.isOff == true) {
    primaryValue = l.thermostat_mode_off;
  } else if (cs?.effectiveTargetTemperature != null) {
    primaryValue = format(cs!.effectiveTargetTemperature!);
    unit = '°';
  } else {
    primaryValue = '$count';
  }

  final target = cs?.effectiveTargetTemperature;
  final String subtitle;
  if (contribution?.isUnavailable == true) {
    subtitle = contribution!.hasConflict
        ? l.climate_temperature_coverage_conflict
        : l.climate_temperature_coverage_unavailable;
  } else if (cs == null) {
    subtitle = l.room_overview_device_count(count);
  } else if (cs.isOff) {
    subtitle = l.thermostat_state_off;
  } else if (cs.isHeating) {
    subtitle = l.thermostat_state_heating;
  } else if (cs.isCooling) {
    subtitle = l.thermostat_state_cooling;
  } else {
    subtitle = l.thermostat_state_idling;
  }

  // Mode label and icon for the mode action button
  String modeLabel;
  IconData modeIcon;
  final currentMode = cs?.mode;
  switch (currentMode) {
    case ClimateMode.heat:
      modeLabel = l.thermostat_mode_heat;
      modeIcon = MdiIcons.fire;
      break;
    case ClimateMode.cool:
      modeLabel = l.thermostat_mode_cool;
      modeIcon = MdiIcons.snowflake;
      break;
    case ClimateMode.auto:
      modeLabel = l.thermostat_mode_auto;
      modeIcon = MdiIcons.autorenew;
      break;
    case ClimateMode.off:
    case null:
      modeLabel = l.thermostat_mode_off;
      modeIcon = MdiIcons.power;
      break;
  }

  final isActive = cs != null
      ? (cs.mode != ClimateMode.off && cs.mode != null)
      : currentTemperature != null;

  final minus = QuickActionInfo(
    type: QuickActionType.climateMinus,
    icon: MdiIcons.minus,
    semanticLabel: l.room_card_lower_target,
  );
  final plus = QuickActionInfo(
    type: QuickActionType.climatePlus,
    icon: MdiIcons.plus,
    semanticLabel: l.room_card_raise_target,
  );

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.localizedLabel(l),
    primaryValue: primaryValue,
    unit: unit,
    // The target sits under the value on every card; screen readers hear
    // it with the state: "Heating to 22°".
    target:
        target != null &&
            cs?.isOff != true &&
            contribution?.isUnavailable != true
        ? degrees(target)
        : null,
    subtitle: subtitle,
    // A coverage warning replaces the state, and screen readers hear it too.
    spokenSubtitle:
        target == null || cs == null || contribution?.isUnavailable == true
        ? null
        : cs.isHeating
        ? l.thermostat_state_heating_to(degrees(target))
        : cs.isCooling
        ? l.thermostat_state_cooling_to(degrees(target))
        : null,
    actions: [
      QuickActionInfo(
        type: QuickActionType.climateMode,
        icon: modeIcon,
        label: modeLabel,
        selected: isActive,
        semanticLabel: l.room_card_climate_mode(modeLabel),
      ),
      minus,
      plus,
    ],
    compactActions: [minus, plus],
    isActive: isActive,
  );
}

DomainCardInfo _buildShadingCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final l = input.localizations;
  final cvs = input.coversState;
  final grouped = cvs?.groupOperations != null;
  final current = !grouped || cvs?.groupExpiresAt?.isAfter(input.now) == true;
  bool ready(String operation) =>
      !grouped ||
      (cvs?.groupOperations?.any(
            (entry) => entry.operation == operation && entry.commandable,
          ) ??
          false);

  final isActive =
      cvs?.anyOpen ??
      (input.shadingPosition != null && input.shadingPosition! > 0);
  final allClosed = cvs?.allClosed ?? !isActive;
  final pos = grouped
      ? (current ? cvs?.averagePosition : null)
      : cvs?.averagePosition ?? input.shadingPosition;

  // The position, never the covers mode. A group whose members disagree or
  // have not reported says so instead of averaging.
  final String primaryValue;
  String? unit;
  if (grouped && (!current || cvs?.averagePosition == null)) {
    primaryValue = current && cvs?.isPositionMixed == true
        ? l.groupMixed
        : l.groupUnknown;
  } else if (!grouped && cvs?.isPositionMixed == true) {
    primaryValue = l.groupMixed;
  } else if (pos != null) {
    primaryValue = '$pos';
    unit = ' %';
  } else if (allClosed) {
    primaryValue = l.covers_mode_closed;
  } else {
    primaryValue = l.covers_mode_open;
  }

  final String subtitle;
  if (pos != null && !(grouped && !current)) {
    if (pos == 0) {
      subtitle = l.shading_fully_closed;
    } else if (pos == 100) {
      subtitle = l.shading_fully_open;
    } else {
      subtitle = l.shading_state_partial(pos);
    }
  } else {
    subtitle = l.room_overview_device_count(count);
  }

  final open = QuickActionInfo(
    type: QuickActionType.coversOpen,
    disabled: !ready('open'),
    icon: MdiIcons.arrowExpandVertical,
    label: l.shading_action_open,
    selected: pos == 100,
  );
  final close = QuickActionInfo(
    type: QuickActionType.coversClose,
    disabled: !ready('close'),
    icon: MdiIcons.arrowCollapseVertical,
    label: l.shading_action_close,
    selected: pos == 0,
  );

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.localizedLabel(l),
    primaryValue: primaryValue,
    unit: unit,
    subtitle: subtitle,
    actions: [
      open,
      QuickActionInfo(
        type: QuickActionType.coversHalf,
        disabled: cvs == null || grouped,
        icon: MdiIcons.arrowSplitHorizontal,
        label: '50%',
        selected: pos == 50,
      ),
      close,
    ],
    // Narrow cards keep the two ends as icons.
    compactActions: [
      QuickActionInfo(
        type: open.type,
        disabled: open.disabled,
        icon: MdiIcons.arrowUp,
        selected: open.selected,
        semanticLabel: l.room_card_open_shading,
      ),
      QuickActionInfo(
        type: close.type,
        disabled: close.disabled,
        icon: MdiIcons.arrowDown,
        selected: close.selected,
        semanticLabel: l.room_card_close_shading,
      ),
    ],
    isActive: isActive,
  );
}

DomainCardInfo _buildMediaCard(
  DomainType domain,
  int count,
  RoomOverviewBuildInput input,
) {
  final l = input.localizations;
  final ms = input.mediaState;

  // The activity running now ("Watch"), else "Off".
  final isActive = ms?.isActive ?? false;
  final primaryValue =
      isActive &&
          ms?.activityKey != null &&
          ms!.activityKey != MediaActivityKey.off
      ? _mediaActivityLabel(ms.activityKey!, l)
      : l.media_activity_off;

  final pause = QuickActionInfo(
    type: QuickActionType.mediaPause,
    icon: MdiIcons.pause,
    disabled: !isActive,
    semanticLabel: l.room_card_media_pause,
  );
  final stop = QuickActionInfo(
    type: QuickActionType.mediaStop,
    icon: MdiIcons.stop,
    disabled: !isActive,
    semanticLabel: l.room_card_media_stop,
  );

  return DomainCardInfo(
    domain: domain,
    icon: isActive ? MdiIcons.playCircle : domain.icon,
    title: domain.localizedLabel(l),
    primaryValue: primaryValue,
    subtitle: l.room_overview_device_count(count),
    actions: [
      QuickActionInfo(
        type: QuickActionType.mediaPlay,
        icon: MdiIcons.play,
        disabled: !isActive,
        semanticLabel: l.room_card_media_play,
      ),
      pause,
      stop,
    ],
    compactActions: [pause, stop],
    isActive: isActive,
  );
}

String _mediaActivityLabel(MediaActivityKey key, AppLocalizations l) {
  switch (key) {
    case MediaActivityKey.watch:
      return l.media_activity_watch;
    case MediaActivityKey.listen:
      return l.media_activity_listen;
    case MediaActivityKey.gaming:
      return l.media_activity_gaming;
    case MediaActivityKey.background:
      return l.media_activity_background;
    case MediaActivityKey.off:
      return l.media_activity_off;
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
    items.add(
      SubtitleItem(
        icon: MdiIcons.thermometer,
        text: SensorUtils.formatNumericValueWithUnit(
          env!.averageTemperature!,
          DevicesModuleChannelCategory.temperature,
          displayUnits: displayUnits,
        ),
      ),
    );
  }
  if (env?.averageHumidity != null) {
    items.add(
      SubtitleItem(
        icon: MdiIcons.waterPercent,
        text: SensorUtils.formatNumericValueWithUnit(
          env!.averageHumidity!,
          DevicesModuleChannelCategory.humidity,
          displayUnits: displayUnits,
        ),
      ),
    );
  }
  if (env?.averageIlluminance != null) {
    items.add(
      SubtitleItem(
        icon: MdiIcons.weatherSunny,
        text: SensorUtils.formatNumericValueWithUnit(
          env!.averageIlluminance!,
          DevicesModuleChannelCategory.illuminance,
          displayUnits: displayUnits,
        ),
        compactHidden: true,
      ),
    );
  }

  final l = input.localizations;
  final subtitleText = items.isNotEmpty
      ? items.map((i) => i.text).join(' \u00B7 ')
      : l.room_overview_reading_count(readingsCount);

  final hasEnv = items.isNotEmpty;

  return DomainCardInfo(
    domain: domain,
    icon: domain.icon,
    title: domain.localizedLabel(l),
    primaryValue: primaryValue,
    subtitle: subtitleText,
    subtitleItems: items,
    isActive: hasEnv,
  );
}

/// Builds sensor readings for the bottom strip from sensor state environment averages.
List<SensorReading> _buildSensorReadings(RoomOverviewBuildInput input) {
  final l = input.localizations;
  final readings = <SensorReading>[];
  final env = input.sensorState?.environment;
  final displayUnits = input.displayUnits;

  final temp =
      env?.averageTemperature ??
      (input.climateState?.temperatureContribution == null
          ? input.temperature
          : input.climateState!.temperatureContribution!.isUnavailable
          ? null
          : input.climateState!.currentTemperature);
  if (temp != null) {
    readings.add(
      SensorReading(
        icon: MdiIcons.thermometer,
        label: l.device_temperature,
        value: SensorUtils.formatNumericValueWithUnit(
          temp,
          DevicesModuleChannelCategory.temperature,
          displayUnits: displayUnits,
        ),
        color: SensorColors.temperature,
      ),
    );
  }

  final humidity = env?.averageHumidity ?? input.humidity;
  if (humidity != null) {
    readings.add(
      SensorReading(
        icon: MdiIcons.waterPercent,
        label: l.device_humidity,
        value: SensorUtils.formatNumericValueWithUnit(
          humidity,
          DevicesModuleChannelCategory.humidity,
          displayUnits: displayUnits,
        ),
        color: SensorColors.humidity,
      ),
    );
  }

  if (env?.averageIlluminance != null) {
    readings.add(
      SensorReading(
        icon: MdiIcons.weatherSunny,
        label: l.sensor_label_light,
        value: SensorUtils.formatNumericValueWithUnit(
          env!.averageIlluminance!,
          DevicesModuleChannelCategory.illuminance,
          displayUnits: displayUnits,
        ),
        color: SensorColors.themeColorForCategory(
          DevicesModuleChannelCategory.illuminance,
        ),
      ),
    );
  }

  return readings;
}
