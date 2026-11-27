// Lights domain view: room-level lighting control for a single space/room.
//
// **Purpose:** One screen per room showing lighting roles (main, task, ambient,
// accent, night), "other" lights, scenes, and a mode selector (off/work/relax/night).
// Role and device detail are opened via navigation.
//
// **AI / Tooling:** When editing this file, preserve the rendered UI. Do not
// change widget trees, layout parameters, or visual behavior. Section headers
// (e.g. "// DATA MODELS", "// LIFECYCLE") are stable anchors for navigation.
//
// **Data flow:**
// - [SpacesService] provides light targets and lighting state for the room.
// - [DevicesService] provides live device views used to build role/light data.
// - [DomainControlStateService] (mode + role channels) drives optimistic UI;
//   [IntentsRepository] notifies when intents complete so pending state can settle.
//
// **Key concepts:**
// - Two [DomainControlStateService] instances: one for mode (off/work/relax/night),
//   one for role toggles (main, task, ambient, etc.). Both use space-level intent
//   lock; mode lock blocks role toggles until settling.
// - Role data is built in [_buildRoleDataList] from targets + [DevicesService];
//   "other" lights and scenes are separate lists. Optimistic on/off for single
//   lights uses [DeviceControlStateService] and [IntentOverlayService].
//
// **File structure (for humans and AI):**
// Search for the exact section header (e.g. "// DATA MODELS", "// LIFECYCLE") to
// jump to that part of the file. Sections appear in this order:
//
// - **DATA MODELS** — [LightingRoleData], [LightState], [LightingModeUI] (+ extension),
//   [LightDeviceData], [_LightHeroState]. Channel IDs/settling from [LightingConstants].
// - **LIGHTS DOMAIN VIEW PAGE** — [LightsDomainViewPage] and state class:
//   - STATE & DEPENDENCIES: _roomId, [_tryLocator], optional services.
//   - DERIVED STATE & CONVERGENCE: [_lightingState], [_currentMode], [_checkModeConvergence],
//     [_checkRoleConvergence], [_getRolePendingState].
//   - HERO CARD CONVERGENCE: [_getHeroRoleAggregatedState], [_applyHeroOptimisticOverrides],
//     [_checkHero*Convergence], [_saveHeroToCache], [_loadHeroCachedValuesIfNeeded].
//   - LIFECYCLE: initState (control services, listeners, fetch), dispose.
//   - BOTTOM NAV MODE: [_onPageActivated], [_registerModeConfig], [_buildModePopupContent].
//   - CONTROL STATE & CALLBACKS: [_onDataChanged], [_groupTargetsByRole], [_onIntentChanged].
//   - BUILD: scaffold, loading/empty/content; [Consumer] for [DevicesService].
//   - DATA BUILDING: [_buildRoleDataList], [_buildOtherLights], [_getLightOptimisticOn].
//   - HEADER: [_buildHeader], [_headerStateLine], [_getModeName].
//   - SHEETS: [_showRoleLightsSheet], [_showScenesSheet].
//   - LIGHTING MODE CONTROLS: [_setLightingMode], [_toggleRoleLights], [_toggleLight].
//   - HERO CONTROLS: [_onHeroValueChanged], [_heroSetBrightness], [_heroSetColor], etc.
//   - LAYOUTS: [_buildPortraitLayout], [_buildLandscapeLayout], role selector, scenes.
//   - HELPERS: [_getEffectiveRoleFromTargets], [_getRoleDataForRole].
// - **PRIVATE WIDGETS** — [_HeroGradients], [_LightsHeroCard], [_SceneTile].

import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/domain_view.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/constants.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/lighting/role_mixed_state.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/models/intent_result.dart';
import 'package:fastybird_smart_panel/modules/deck/services/intents_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/intent_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/intent_mode_status.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/modules/scenes/types/scene_extensions.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/spaces_service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/light_targets/view.dart';

// =============================================================================
// DATA MODELS
// =============================================================================
// View models and enums for the lights domain. [LightingRoleData] and
// [LightDeviceData] are built from [SpacesService] targets + [DevicesService];
// [LightingModeUI] maps to backend [LightingMode] via [LightingModeUIExtension].

class LightingRoleData {
  final LightTargetRole role;
  final String name;
  final IconData icon;
  final int onCount;
  final int totalCount;
  final int? brightness;
  final List<LightTargetView> targets;

  const LightingRoleData({
    required this.role,
    required this.name,
    required this.icon,
    required this.onCount,
    required this.totalCount,
    required this.targets,
    this.brightness,
  });

  bool get hasLightsOn => onCount > 0;

  String get statusText {
    if (onCount == 0) {
      return '$onCount/$totalCount';
    }
    if (brightness != null) {
      return '$onCount/$totalCount \u2022 $brightness%';
    }
    return '$onCount/$totalCount';
  }
}

/// Light device power state for UI display.
enum LightState { off, on, offline }

/// UI mode for lighting control.
///
/// This enum represents the lighting modes available in the UI, including an 'off'
/// state that doesn't exist in the backend [LightingMode] enum. The backend only
/// has work/relax/night modes - turning lights off is a separate intent.
///
/// The distinction exists because:
/// - Backend [LightingMode]: Represents active lighting presets (work, relax, night)
/// - UI [LightingModeUI]: Includes 'off' as a selectable option for user convenience
///
/// Use [LightingModeUIExtension] to convert between UI and backend representations.
enum LightingModeUI { off, work, relax, night }

/// Extension to convert between UI mode and backend mode.
///
/// Provides bidirectional conversion:
/// - [toBackendMode]: Converts UI mode to backend mode
/// - [fromBackendMode]: Converts backend mode + light state to UI mode
extension LightingModeUIExtension on LightingModeUI {
  /// Converts UI mode to backend [LightingMode].
  LightingMode toBackendMode() {
    switch (this) {
      case LightingModeUI.off:
        return LightingMode.off;
      case LightingModeUI.work:
        return LightingMode.work;
      case LightingModeUI.relax:
        return LightingMode.relax;
      case LightingModeUI.night:
        return LightingMode.night;
    }
  }

  /// Converts backend [LightingMode] to UI mode.
  ///
  /// Takes into account whether any lights are on:
  /// - If no lights are on, returns [LightingModeUI.off]
  /// - If lights are on but mode is null, defaults to [LightingModeUI.work]
  /// - Otherwise, maps the backend mode to corresponding UI mode
  static LightingModeUI fromBackendMode(LightingMode? mode, bool anyLightsOn) {
    if (!anyLightsOn) return LightingModeUI.off;
    if (mode == null) return LightingModeUI.work;
    switch (mode) {
      case LightingMode.off:
        return LightingModeUI.off;
      case LightingMode.work:
        return LightingModeUI.work;
      case LightingMode.relax:
        return LightingModeUI.relax;
      case LightingMode.night:
        return LightingModeUI.night;
    }
  }
}

class LightDeviceData {
  final String deviceId;
  final String channelId;
  final String name;
  final LightState state;
  final int? brightness;

  const LightDeviceData({
    required this.deviceId,
    required this.channelId,
    required this.name,
    this.state = LightState.off,
    this.brightness,
  });

  bool get isOn => state == LightState.on;
  bool get isOffline => state == LightState.offline;

  String get statusText {
    switch (state) {
      case LightState.off:
        return 'Off';
      case LightState.on:
        return brightness != null ? '$brightness%' : 'On';
      case LightState.offline:
        return 'Offline';
    }
  }
}

/// Capabilities a light role can support for the hero card display.
enum LightHeroCapability { brightness, colorTemp, hue, saturation, whiteChannel }

/// A preset value for a slider mode.
class SliderPreset {
  final String label;
  final double value;
  final bool isActive;

  const SliderPreset({
    required this.label,
    required this.value,
    this.isActive = false,
  });
}

/// A color preset swatch for hue mode.
class ColorPreset {
  final Color color;
  final String name;
  final double hueValue;
  final bool isActive;

  const ColorPreset({
    required this.color,
    required this.name,
    required this.hueValue,
    this.isActive = false,
  });
}

/// Aggregated state of a light role for the hero card display.
///
/// Built from device channel data in [_buildHeroState]. Represents the
/// combined state of all devices in a role.
class _LightHeroState {
  final String roleName;
  final int deviceCount;
  final bool isOn;
  final Set<LightHeroCapability> capabilities;
  final LightHeroCapability? activeMode;
  final double brightness;
  final double colorTemp;
  final double minColorTemp;
  final double maxColorTemp;
  final double hue;
  final double minHue;
  final double maxHue;
  final double saturation;
  final double whiteChannel;
  final Color? currentColor;
  final String? colorName;
  final IconData statusIcon;

  _LightHeroState({
    required this.roleName,
    required this.deviceCount,
    this.isOn = false,
    this.capabilities = const {},
    this.activeMode,
    this.brightness = 0,
    this.colorTemp = 3200,
    this.minColorTemp = 2700,
    this.maxColorTemp = 6500,
    this.hue = 0,
    this.minHue = 0,
    this.maxHue = 359,
    this.saturation = 0,
    this.whiteChannel = 0,
    this.currentColor,
    this.colorName,
    IconData? statusIcon,
  }) : statusIcon = statusIcon ?? MdiIcons.lightbulbGroup;

  bool get isOnOffOnly => capabilities.isEmpty;
  bool get showModeSwitcher => capabilities.length >= 2;

  _LightHeroState copyWith({
    bool? isOn,
    double? brightness,
    double? colorTemp,
    double? hue,
    double? saturation,
    double? whiteChannel,
    Color? currentColor,
    String? colorName,
  }) {
    return _LightHeroState(
      roleName: roleName,
      deviceCount: deviceCount,
      isOn: isOn ?? this.isOn,
      capabilities: capabilities,
      activeMode: activeMode,
      brightness: brightness ?? this.brightness,
      colorTemp: colorTemp ?? this.colorTemp,
      minColorTemp: minColorTemp,
      maxColorTemp: maxColorTemp,
      hue: hue ?? this.hue,
      minHue: minHue,
      maxHue: maxHue,
      saturation: saturation ?? this.saturation,
      whiteChannel: whiteChannel ?? this.whiteChannel,
      currentColor: currentColor ?? this.currentColor,
      colorName: colorName ?? this.colorName,
      statusIcon: statusIcon,
    );
  }
}

/// Get human-readable color name from hue degree value.
String _heroHueName(double hue, AppLocalizations l) {
  if (hue < 15 || hue >= 345) return l.light_color_red;
  if (hue < 45) return l.light_color_orange;
  if (hue < 75) return l.light_color_yellow;
  if (hue < 150) return l.light_color_green;
  if (hue < 195) return l.light_color_cyan;
  if (hue < 255) return l.light_color_blue;
  if (hue < 285) return l.light_color_violet;
  if (hue < 345) return l.light_color_pink;
  return l.light_color_red;
}

// =============================================================================
// LIGHTS DOMAIN VIEW PAGE
// =============================================================================
// Stateful page and [_LightsDomainViewPageState]. State holds two control
// services (mode + role), optional services (Spaces, Devices, Scenes, Intents,
// Deck, etc.), and cached role grouping. Build uses Consumer<DevicesService>.

/// Domain view page for controlling lighting in a space.
///
/// Uses [DomainControlStateService] for optimistic UI (mode + role channels).
/// Mode changes block role toggles until settling; role toggles do not block mode.
class LightsDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const LightsDomainViewPage({super.key, required this.viewItem});

  @override
  State<LightsDomainViewPage> createState() => _LightsDomainViewPageState();
}

class _LightsDomainViewPageState extends State<LightsDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  /// Optional services: resolved in initState via [_tryLocator]. Listeners
  /// registered for Spaces, Devices, Scenes, Intents; others used ad hoc.
  SpacesService? _spacesService;
  DisplayRepository? _displayRepository;
  DevicesService? _devicesService;
  ScenesService? _scenesService;
  IntentsService? _intentsService;
  EventBus? _eventBus;
  IntentsRepository? _intentsRepository;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;
  bool _isLoading = true;
  bool _hasError = false;
  bool _isSceneTriggering = false;
  String? _triggeringSceneId;

  /// Currently selected role tab in the ModeSelector.
  LightTargetRole? _selectedRole;

  /// Currently active hero card capability mode.
  LightHeroCapability? _activeHeroMode;

  /// Per-slider dragging flags; suppress listener-driven [setState] calls so
  /// that the optimistic UI value is not overwritten by stale backend data
  /// arriving mid-drag.
  bool _isDraggingBrightness = false;
  bool _isDraggingColorTemp = false;
  bool _isDraggingHue = false;
  bool _isDraggingWhite = false;

  /// True when any hero slider is being dragged.
  bool get _isAnyDragging =>
      _isDraggingBrightness || _isDraggingColorTemp || _isDraggingHue || _isDraggingWhite;

  // Debounce timers for hero card slider changes
  Timer? _heroBrightnessDebounceTimer;
  Timer? _heroTemperatureDebounceTimer;
  Timer? _heroHueDebounceTimer;
  Timer? _heroWhiteDebounceTimer;

  /// Optimistic UI for hero card slider/preset values (brightness, hue, etc.).
  /// Uses [RoleAggregatedState] from backend as convergence target.
  late DomainControlStateService<RoleAggregatedState> _heroControlStateService;

  /// Pending on/off state for hero card optimistic UI.
  bool? _heroPendingOnState;
  Timer? _heroPendingOnStateClearTimer;

  /// Per-role pending on/off state for landscape tile icon tap optimistic UI.
  final Map<LightTargetRole, bool> _roleTilePendingOnStates = {};
  final Map<LightTargetRole, Timer> _roleTilePendingTimers = {};

  /// Role control state repository (caching slider values for mixed state).
  RoleControlStateRepository? _roleControlStateRepository;

  /// True when a hero intent was in flight; used to detect unlock.
  bool _heroWasSpaceLocked = false;

  /// Bumped whenever the hero's state is reset (a role switch): a request
  /// that started for the previous hero leaves the current one alone.
  int _heroGeneration = 0;

  /// Notifier bumped after [_toggleLight] so the role-lights sheet rebuilds.
  final ValueNotifier<int> _roleLightsSheetNotifier = ValueNotifier<int>(0);

  /// Channel IDs tracked by [_heroControlStateService].
  static const List<String> _heroControlChannelIds = [
    LightingConstants.brightnessChannelId,
    LightingConstants.hueChannelId,
    LightingConstants.saturationChannelId,
    LightingConstants.temperatureChannelId,
    LightingConstants.whiteChannelId,
    LightingConstants.onOffChannelId,
  ];

  /// Optimistic UI for mode (off/work/relax/night). Lock blocks role toggles.
  late DomainControlStateService<LightingStateModel> _modeControlStateService;

  /// Optimistic UI for role toggles (main, task, ambient, etc.). Per-role lock.
  late DomainControlStateService<LightTargetView> _roleControlStateService;

  /// True when a mode intent was in flight last frame; used in [_onIntentChanged]
  /// to call [onIntentCompleted] when space intent unlocks.
  bool _modeWasLocked = false;

  /// True when space had an intent lock last frame (any lighting intent).
  /// Used to detect role-toggle intent completion when space unlocks.
  bool _spaceWasLocked = false;

  /// Tracks whether the user has changed a hero control (brightness, hue, etc.)
  /// since the last mode intent. When true, the mode is considered overridden
  /// even if the backend still reports [isModeFromIntent] = true.
  bool _modeOverriddenByManualChange = false;

  /// The [lastAppliedAt] timestamp at the moment [_modeOverriddenByManualChange]
  /// was set. Used to distinguish stale backend state from a genuinely new intent
  /// (e.g. from another panel instance).
  DateTime? _lastAppliedAtWhenOverridden;

  /// Cached result of [_groupTargetsByRole]; invalidated via [_cachedTargetsHash].
  Map<LightTargetRole, List<LightTargetView>>? _cachedRoleGroups;
  int _cachedTargetsHash = 0;

  // --------------------------------------------------------------------------
  // STATE & DEPENDENCIES
  // --------------------------------------------------------------------------
  // Room id from [DomainViewItem]; [_tryLocator] resolves optional services
  // and registers listeners without throwing.

  String get _roomId => widget.viewItem.roomId;

  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final s = locator<T>();
      onSuccess?.call(s);
      return s;
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get $debugLabel: $e');
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // DERIVED STATE & CONVERGENCE HELPERS
  // --------------------------------------------------------------------------
  // [_lightingState], [_currentMode] (with optimistic override). Convergence
  // and lock callbacks for [DomainControlStateService]; [_getRolePendingState]
  // for optimistic role tile state.

  /// Get lighting state from backend (cached)
  LightingStateModel? get _lightingState =>
      _spacesService?.getLightingState(_roomId);

  /// Determine current UI mode from backend state or pending state
  LightingModeUI get _currentMode {
    // Check if mode is locked by state machine (optimistic UI)
    if (_modeControlStateService.isLocked(LightingConstants.modeChannelId)) {
      final desiredModeIndex = _modeControlStateService
          .getDesiredValue(LightingConstants.modeChannelId)
          ?.toInt();
      if (desiredModeIndex != null &&
          desiredModeIndex >= 0 &&
          desiredModeIndex < LightingModeUI.values.length) {
        return LightingModeUI.values[desiredModeIndex];
      }
    }

    final state = _lightingState;
    if (state == null) return LightingModeUI.off;

    return LightingModeUIExtension.fromBackendMode(
      state.detectedMode ?? state.lastAppliedMode,
      state.anyOn,
    );
  }

  /// Check if mode has converged to desired value.
  bool _checkModeConvergence(
    List<LightingStateModel> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final desiredModeIndex = desiredValue.toInt();
    if (desiredModeIndex < 0 || desiredModeIndex >= LightingModeUI.values.length) {
      return true; // Invalid index, consider converged to avoid stuck state
    }
    final desiredMode = LightingModeUI.values[desiredModeIndex];

    // For 'off' mode, check if all lights are off
    if (desiredMode == LightingModeUI.off) {
      return !state.anyOn;
    }

    // For other modes, check detectedMode matches AND isModeFromIntent is true.
    // This ensures we stay in optimistic mode until the backend confirms the intent
    // was applied. Without this check, we'd show "matched" (info color) briefly
    // before the websocket update arrives with isModeFromIntent = true.
    final backendMode = state.detectedMode;
    if (backendMode == null) {
      // No mode info available yet, consider not converged
      return false;
    }
    final actualMode = LightingModeUIExtension.fromBackendMode(
      backendMode,
      state.anyOn,
    );
    return actualMode == desiredMode && state.isModeFromIntent;
  }

  /// Check if space has an active intent lock.
  ///
  /// Used by both mode and role control channels since all lighting intents
  /// operate at the space level. The [targets] parameter is required by the
  /// [IntentLockChecker] callback signature but is not used here.
  bool _isSpaceIntentLocked<T>(List<T> targets) {
    return _intentsRepository?.isSpaceLocked(_roomId) ?? false;
  }

  /// Check if role has converged to desired on/off state.
  bool _checkRoleConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final targetOn = desiredValue > LightingConstants.onOffThreshold;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = device.lightChannels
            .cast<LightChannelView?>()
            .firstWhere(
              (c) => c?.id == target.channelId,
              orElse: () => device.lightChannels.isNotEmpty
                  ? device.lightChannels.first
                  : null,
            );
        if (channel != null && channel.on != targetOn) {
          return false;
        }
      }
    }
    return true;
  }

  /// Get the optimistic on/off state for a role.
  /// Returns null if no pending state (use actual device state).
  bool? _getRolePendingState(LightTargetRole role) {
    final channelId = LightingConstants.getRoleChannelId(role);
    if (_roleControlStateService.isLocked(channelId)) {
      final desiredValue = _roleControlStateService.getDesiredValue(channelId);
      if (desiredValue != null) {
        return desiredValue > LightingConstants.onOffThreshold;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // HERO CARD CONVERGENCE & HELPERS
  // --------------------------------------------------------------------------

  /// Get role aggregated state for the currently selected hero role.
  /// Falls back to auto-detecting the first defined role when [_selectedRole]
  /// is null (matches the build method's effectiveRole logic).
  RoleAggregatedState? _getHeroRoleAggregatedState() {
    var role = _selectedRole;
    if (role == null) {
      final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
      if (targets.isEmpty) return null;
      final roleGroups = _groupTargetsByRole(targets);
      for (final r in LightTargetRole.values) {
        if (r == LightTargetRole.other || r == LightTargetRole.hidden) continue;
        if (roleGroups.containsKey(r)) {
          role = r;
          break;
        }
      }
    }
    if (role == null) return null;
    final stateRole = mapTargetRoleToStateRole(role);
    if (stateRole == null) return null;
    return _lightingState?.getRoleState(stateRole);
  }

  /// Cache key for the currently selected hero role.
  String _heroCacheKey(LightTargetRole role) =>
      RoleControlStateRepository.generateKey(_roomId, 'lighting', role.name);

  /// Resolve effective hero role: [_selectedRole] or first defined role from targets.
  /// Used when we have targets but not yet [LightingRoleData] (e.g. initState, _onDataChanged).
  LightTargetRole? _getEffectiveRoleFromTargets() {
    if (_selectedRole != null) return _selectedRole;
    final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
    if (targets.isEmpty) return null;
    final groups = _groupTargetsByRole(targets);
    for (final r in LightTargetRole.values) {
      if (r != LightTargetRole.other && r != LightTargetRole.hidden && groups.containsKey(r)) {
        return r;
      }
    }
    return null;
  }

  /// Parse hex color string (#RRGGBB) to Color.
  Color? _parseHexColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    try {
      final cleaned = hex.replaceAll('#', '');
      if (cleaned.length != 6) return null;
      final r = int.parse(cleaned.substring(0, 2), radix: 16);
      final g = int.parse(cleaned.substring(2, 4), radix: 16);
      final b = int.parse(cleaned.substring(4, 6), radix: 16);
      return Color.fromARGB(255, r, g, b);
    } catch (_) {
      return null;
    }
  }

  /// Parse backend color string to (hue, saturation).
  /// Handles hex (#RRGGBB) and hue-only format (hue:181) from backend.
  (double?, double?) _parseColorToHueSat(String? colorStr) {
    if (colorStr == null || colorStr.isEmpty) return (null, null);
    final hexColor = _parseHexColor(colorStr);
    if (hexColor != null) {
      final hsv = HSVColor.fromColor(hexColor);
      return (hsv.hue, hsv.saturation);
    }
    final hueMatch = RegExp(r'^hue:(\d+(?:\.\d+)?)$').firstMatch(colorStr);
    if (hueMatch != null) {
      final hue = double.tryParse(hueMatch.group(1)!);
      return (hue, null);
    }
    return (null, null);
  }

  bool _checkHeroBrightnessConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.brightness == null) return false;
    return (state.brightness! - desiredValue).abs() <= tolerance;
  }

  bool _checkHeroHueConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final (hue, _) = _parseColorToHueSat(state.color);
    if (hue == null) return false;
    return (hue - desiredValue).abs() <= tolerance;
  }

  bool _checkHeroSaturationConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final (_, sat) = _parseColorToHueSat(state.color);
    if (sat == null) return false;
    final saturation = sat * 100.0;
    return (saturation - desiredValue).abs() <= tolerance;
  }

  bool _checkHeroTemperatureConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.colorTemperature == null) return false;
    return (state.colorTemperature! - desiredValue).abs() <= tolerance;
  }

  bool _checkHeroWhiteConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.white == null) return false;
    return (state.white! - desiredValue).abs() <= tolerance;
  }

  bool _checkHeroOnOffConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final targetOn = desiredValue > LightingConstants.onOffThreshold;
    return state.isOn == targetOn && !state.isOnMixed;
  }

  /// Apply optimistic overrides from [_heroControlStateService] onto
  /// a hero state built from device data.
  _LightHeroState _applyHeroOptimisticOverrides(_LightHeroState base, AppLocalizations localizations) {
    final isOn = _heroPendingOnState ?? base.isOn;

    final brightness =
        _heroControlStateService.isLocked(LightingConstants.brightnessChannelId)
            ? (_heroControlStateService.getDesiredValue(
                    LightingConstants.brightnessChannelId) ??
                base.brightness)
            : base.brightness;

    final colorTemp =
        _heroControlStateService.isLocked(LightingConstants.temperatureChannelId)
            ? (_heroControlStateService.getDesiredValue(
                    LightingConstants.temperatureChannelId) ??
                base.colorTemp)
            : base.colorTemp;

    final whiteChannel =
        _heroControlStateService.isLocked(LightingConstants.whiteChannelId)
            ? (_heroControlStateService.getDesiredValue(
                    LightingConstants.whiteChannelId) ??
                base.whiteChannel)
            : base.whiteChannel;

    double hue = base.hue;
    double saturation = base.saturation;
    Color? currentColor = base.currentColor;
    String? colorName = base.colorName;

    final hueDesired = _heroControlStateService
        .getDesiredValue(LightingConstants.hueChannelId);
    final satDesired = _heroControlStateService
        .getDesiredValue(LightingConstants.saturationChannelId);

    if (_heroControlStateService.isLocked(LightingConstants.hueChannelId) &&
        hueDesired != null) {
      hue = hueDesired;
      colorName = _heroHueName(hue, localizations);
    }
    if (_heroControlStateService
            .isLocked(LightingConstants.saturationChannelId) &&
        satDesired != null) {
      saturation = satDesired;
    }
    if (hue != base.hue || saturation != base.saturation) {
      currentColor = HSVColor.fromAHSV(
              1, hue.clamp(0, 360), (saturation / 100).clamp(0.0, 1.0), 1)
          .toColor();
    }

    return base.copyWith(
      isOn: isOn,
      brightness: brightness,
      colorTemp: colorTemp,
      hue: hue,
      saturation: saturation,
      whiteChannel: whiteChannel,
      currentColor: currentColor,
      colorName: colorName,
    );
  }

  /// Save hero slider values to cache for mixed-state recovery.
  /// Saturation must be 0.0-1.0 for [RoleCacheEntry]; brightness/hue/temp/white
  /// use the same scale as hero display (0-100, 0-360, kelvin, 0-100).
  void _saveHeroToCache(
    LightTargetRole role, {
    double? brightness,
    double? hue,
    double? saturation,
    double? temperature,
    double? white,
  }) {
    _roleControlStateRepository?.set(
      _heroCacheKey(role),
      brightness: brightness,
      hue: hue,
      saturation: saturation != null ? saturation / 100 : null,
      temperature: temperature,
      white: white,
    );
  }

  /// Build [RoleMixedState] from [RoleAggregatedState] for hero role.
  RoleMixedState _buildHeroMixedStateFromRole(RoleAggregatedState roleState) {
    return RoleMixedState(
      onStateMixed: roleState.isOnMixed,
      brightnessMixed: roleState.isBrightnessMixed,
      hueMixed: roleState.isColorMixed,
      temperatureMixed: roleState.isColorTemperatureMixed,
      whiteMixed: roleState.isWhiteMixed,
      onCount: roleState.devicesOn,
      offCount: roleState.devicesCount - roleState.devicesOn,
    );
  }

  double? _extractHeroHueFromRole(RoleAggregatedState roleState) {
    final (hue, _) = _parseColorToHueSat(roleState.color);
    return hue;
  }

  double? _extractHeroSaturationFromRole(RoleAggregatedState roleState) {
    final (_, sat) = _parseColorToHueSat(roleState.color);
    return sat != null ? sat * 100 : null;
  }

  /// Load cached values into hero control state when role is mixed.
  void _loadHeroCachedValuesIfNeeded(
    RoleAggregatedState roleState,
    RoleMixedState roleMixedState,
    LightTargetRole role,
  ) {
    if (!roleMixedState.isMixed) return;

    final cached = _roleControlStateRepository?.get(_heroCacheKey(role));
    if (cached == null) return;
    if (!mounted) return;

    final brightness = cached.brightness ?? roleState.brightness?.toDouble();
    if (brightness != null &&
        _heroControlStateService.getDesiredValue(LightingConstants.brightnessChannelId) == null) {
      _heroControlStateService.setMixed(LightingConstants.brightnessChannelId, brightness);
    }

    final hue = cached.hue ?? _extractHeroHueFromRole(roleState);
    if (hue != null &&
        _heroControlStateService.getDesiredValue(LightingConstants.hueChannelId) == null) {
      _heroControlStateService.setMixed(LightingConstants.hueChannelId, hue);
    }

    final saturation = cached.saturation != null
        ? cached.saturation! * 100
        : _extractHeroSaturationFromRole(roleState);
    if (saturation != null &&
        _heroControlStateService.getDesiredValue(LightingConstants.saturationChannelId) == null) {
      _heroControlStateService.setMixed(LightingConstants.saturationChannelId, saturation);
    }

    final temperature = cached.temperature ?? roleState.colorTemperature?.toDouble();
    if (temperature != null &&
        _heroControlStateService.getDesiredValue(LightingConstants.temperatureChannelId) == null) {
      _heroControlStateService.setMixed(LightingConstants.temperatureChannelId, temperature);
    }

    final white = cached.white ?? roleState.white?.toDouble();
    if (white != null &&
        _heroControlStateService.getDesiredValue(LightingConstants.whiteChannelId) == null) {
      _heroControlStateService.setMixed(LightingConstants.whiteChannelId, white);
    }
  }

  /// Update cache when hero role is fully synced.
  ///
  /// Preserves existing cached hue/saturation when backend returns hue-only
  /// format (e.g. "hue:181") which doesn't include saturation. Otherwise we'd
  /// wipe the user's set values and the UI would snap back.
  void _updateHeroCacheIfSynced(RoleAggregatedState? roleState, LightTargetRole role) {
    if (roleState == null) return;

    final roleMixedState = _buildHeroMixedStateFromRole(roleState);
    if (!roleMixedState.isSynced || roleMixedState.onStateMixed) return;

    double? commonBrightness;
    double? commonHue;
    double? commonSaturation;
    double? commonTemperature;
    double? commonWhite;

    if (roleState.isOn) {
      commonBrightness = roleState.brightness?.toDouble();
      commonTemperature = roleState.colorTemperature?.toDouble();
      commonWhite = roleState.white?.toDouble();

      final (parsedHue, parsedSat) = _parseColorToHueSat(roleState.color);
      commonHue = parsedHue;
      commonSaturation = parsedSat;

      final existing = _roleControlStateRepository?.get(_heroCacheKey(role));
      if (commonHue == null && existing?.hue != null) commonHue = existing!.hue;
      if (commonSaturation == null && existing?.saturation != null) {
        commonSaturation = existing!.saturation;
      }
    }

    if (commonBrightness != null ||
        commonHue != null ||
        commonSaturation != null ||
        commonTemperature != null ||
        commonWhite != null) {
      _roleControlStateRepository?.updateFromSync(
        _heroCacheKey(role),
        brightness: commonBrightness,
        hue: commonHue,
        saturation: commonSaturation,
        temperature: commonTemperature,
        white: commonWhite,
      );
    }
  }

  /// Reset hero control state (when switching roles).
  void _resetHeroControlState() {
    _heroGeneration++;
    for (final channelId in _heroControlChannelIds) {
      _heroControlStateService.setIdle(channelId);
    }
    _heroBrightnessDebounceTimer?.cancel();
    _heroTemperatureDebounceTimer?.cancel();
    _heroHueDebounceTimer?.cancel();
    _heroWhiteDebounceTimer?.cancel();
    _heroPendingOnStateClearTimer?.cancel();
    _heroPendingOnState = null;
    _heroWasSpaceLocked = false;
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  // initState: create mode + role [DomainControlStateService], register
  // listeners (Spaces, Devices, Scenes, Intents), then [_fetchLightTargets].
  // dispose: remove listeners and dispose both control services.

  @override
  void initState() {
    super.initState();

    // Initialize the control state service with lighting mode config
    _modeControlStateService = DomainControlStateService<LightingStateModel>(
      channelConfigs: {
        LightingConstants.modeChannelId: ControlChannelConfig(
          id: LightingConstants.modeChannelId,
          convergenceChecker: _checkModeConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.modeSettlingWindowMs,
          tolerance: 0.0, // Mode is exact match
        ),
      },
    );
    _modeControlStateService.addListener(_onControlStateChanged);

    // Initialize the role control state service for role toggles
    _roleControlStateService = DomainControlStateService<LightTargetView>(
      channelConfigs: {
        LightingConstants.roleMainChannelId: ControlChannelConfig(
          id: LightingConstants.roleMainChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
        LightingConstants.roleTaskChannelId: ControlChannelConfig(
          id: LightingConstants.roleTaskChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
        LightingConstants.roleAmbientChannelId: ControlChannelConfig(
          id: LightingConstants.roleAmbientChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
        LightingConstants.roleAccentChannelId: ControlChannelConfig(
          id: LightingConstants.roleAccentChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
        LightingConstants.roleNightChannelId: ControlChannelConfig(
          id: LightingConstants.roleNightChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
        LightingConstants.roleOtherChannelId: ControlChannelConfig(
          id: LightingConstants.roleOtherChannelId,
          convergenceChecker: _checkRoleConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.roleToggleSettlingWindowMs,
          tolerance: 0.0,
        ),
      },
    );
    _roleControlStateService.addListener(_onControlStateChanged);

    // Initialize the hero card control state service for slider/preset optimistic UI
    _heroControlStateService = DomainControlStateService<RoleAggregatedState>(
      channelConfigs: {
        LightingConstants.brightnessChannelId: ControlChannelConfig(
          id: LightingConstants.brightnessChannelId,
          convergenceChecker: _checkHeroBrightnessConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.brightnessTolerance,
        ),
        LightingConstants.hueChannelId: ControlChannelConfig(
          id: LightingConstants.hueChannelId,
          convergenceChecker: _checkHeroHueConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.hueTolerance,
        ),
        LightingConstants.saturationChannelId: ControlChannelConfig(
          id: LightingConstants.saturationChannelId,
          convergenceChecker: _checkHeroSaturationConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.saturationTolerance,
        ),
        LightingConstants.temperatureChannelId: ControlChannelConfig(
          id: LightingConstants.temperatureChannelId,
          convergenceChecker: _checkHeroTemperatureConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.temperatureTolerance,
        ),
        LightingConstants.whiteChannelId: ControlChannelConfig(
          id: LightingConstants.whiteChannelId,
          convergenceChecker: _checkHeroWhiteConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.whiteTolerance,
        ),
        LightingConstants.onOffChannelId: ControlChannelConfig(
          id: LightingConstants.onOffChannelId,
          convergenceChecker: _checkHeroOnOffConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.onOffSettlingWindowMs,
          tolerance: 0.0,
        ),
      },
    );
    _heroControlStateService.addListener(_onControlStateChanged);

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _scenesService = _tryLocator<ScenesService>('ScenesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _intentsService = _tryLocator<IntentsService>('IntentsService');
    _eventBus = _tryLocator<EventBus>('EventBus');
    _intentsRepository = _tryLocator<IntentsRepository>('IntentsRepository', onSuccess: (s) => s.addListener(_onIntentChanged));
    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
    }
    _deviceControlStateService = _tryLocator<DeviceControlStateService>('DeviceControlStateService');
    _roleControlStateRepository = _tryLocator<RoleControlStateRepository>('RoleControlStateRepository');
    _bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');
    _displayRepository = _tryLocator<DisplayRepository>('DisplayRepository');

    // Subscribe to page activation events for bottom nav mode registration
    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    // Defer fetch to after initState so inherited widgets (AppLocalizations,
    // Theme) are accessible when data is already cached and the method runs
    // synchronously through _registerModeConfig.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fetchLightTargets();
    });

    // Load hero cached values when role is mixed (after first frame)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final heroRoleState = _getHeroRoleAggregatedState();
      final effectiveRole = _getEffectiveRoleFromTargets();
      if (heroRoleState != null && effectiveRole != null) {
        final roleMixedState = _buildHeroMixedStateFromRole(heroRoleState);
        _loadHeroCachedValuesIfNeeded(heroRoleState, roleMixedState, effectiveRole);
        setState(() {});
      }
    });
  }

  Future<void> _fetchLightTargets() async {
    try {
      // Check if data is already available (cached) before fetching
      final existingTargets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
      final existingState = _spacesService?.getLightingState(_roomId);

      // Only fetch if data is not already available
      if (existingTargets.isEmpty || existingState == null) {
        // Fetch light targets and lighting state in parallel
        await Future.wait([
          _spacesService?.fetchLightTargetsForSpace(_roomId) ?? Future.value(),
          _spacesService?.fetchLightingState(_roomId) ?? Future.value(),
        ]);
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = false;
        });
        _registerModeConfig();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to fetch light targets: $e');
      }
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  /// Retry loading data after an error.
  Future<void> _retryLoad() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });
    await _fetchLightTargets();
  }

  @override
  void dispose() {
    _heroBrightnessDebounceTimer?.cancel();
    _heroTemperatureDebounceTimer?.cancel();
    _heroHueDebounceTimer?.cancel();
    _heroWhiteDebounceTimer?.cancel();
    _heroPendingOnStateClearTimer?.cancel();
    for (final timer in _roleTilePendingTimers.values) {
      timer.cancel();
    }
    _pageActivatedSubscription?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    _scenesService?.removeListener(_onDataChanged);
    _intentsRepository?.removeListener(_onIntentChanged);
    _modeControlStateService.removeListener(_onControlStateChanged);
    _modeControlStateService.dispose();
    _roleControlStateService.removeListener(_onControlStateChanged);
    _roleControlStateService.dispose();
    _heroControlStateService.removeListener(_onControlStateChanged);
    _heroControlStateService.dispose();
    _roleLightsSheetNotifier.dispose();
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // BOTTOM NAV MODE REGISTRATION
  // --------------------------------------------------------------------------

  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;
    _isActivePage = event.itemId == widget.viewItem.id;

    if (_isActivePage) {
      // Trigger rebuild to pick up any data changes that occurred while offscreen
      setState(() {});
      _registerModeConfig();
    }
  }

  void _registerModeConfig() {
    if (!_isActivePage || _isLoading) return;

    final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
    final hasConfiguredLights = targets.any((t) =>
        t.role != null &&
        t.role != LightTargetRole.other &&
        t.role != LightTargetRole.hidden);

    if (!LightingConstants.useBackendIntents || !hasConfiguredLights) {
      _bottomNavModeNotifier?.clear();
      return;
    }

    final mode = _currentMode;
    final modeOptions = _getLightingModeOptions(context, AppLocalizations.of(context)!);
    final currentOption = modeOptions.firstWhere(
      (o) => o.value == mode,
      orElse: () => modeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      title: AppLocalizations.of(context)!.mode_title_lights,
      color: ThemeColors.lights,
      popupBuilder: _buildModePopupContent,
    ));
  }

  Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
    final localizations = AppLocalizations.of(context)!;
    final modes = _getLightingModeOptions(context, localizations);
    final (activeValue, matchedValue, lastIntentValue) =
        _getLightingModeSelectorValues();
    final isModeLocked = _modeControlStateService.isLocked(
      LightingConstants.modeChannelId,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: AppSpacings.scale(DeckModePopupMetrics.gap),
      children: [
        for (final mode in modes)
          DeckModePopupOption(
            icon: mode.icon,
            label: mode.label,
            color: ThemeColors.lights,
            isSelected: activeValue == mode.value,
            // The room matches this mode without it being applied, or it was
            // the last one applied before a change by hand.
            statusIcon: matchedValue == mode.value
                ? MdiIcons.syncIcon
                : lastIntentValue == mode.value
                ? MdiIcons.history
                : null,
            onTap: isModeLocked
                ? null
                : () {
                    _setLightingMode(mode.value);
                    _registerModeConfig();
                    dismiss();
                  },
          ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // CONTROL STATE & CALLBACKS
  // --------------------------------------------------------------------------
  // [_onDataChanged]: check convergence for mode and role channels, then
  // setState. [_groupTargetsByRole] caches by content hash. [_onIntentChanged]:
  // when space intent unlocks, call onIntentCompleted for mode/role so pending
  // state can settle.

  void _onDataChanged() {
    if (!mounted || _isAnyDragging) return;
    // Use addPostFrameCallback to avoid "setState during build" errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_isAnyDragging) {
        // If backend confirms a new mode intent (lastAppliedAt changed),
        // clear the local manual override flag. We compare timestamps to
        // avoid clearing the flag when the backend still reflects the old
        // intent before manual-change invalidation has propagated.
        if (_modeOverriddenByManualChange &&
            _lightingState?.isModeFromIntent == true) {
          final backendAt = _lightingState?.lastAppliedAt;
          if (backendAt != null && backendAt != _lastAppliedAtWhenOverridden) {
            _modeOverriddenByManualChange = false;
            _lastAppliedAtWhenOverridden = null;
          }
        }

        // Check convergence for mode channel
        final lightingState = _lightingState;
        if (lightingState != null) {
          _modeControlStateService.checkConvergence(
            LightingConstants.modeChannelId,
            [lightingState],
          );
        }

        // Check convergence for role channels
        final lightTargets = _spacesService?.getLightTargetsForSpace(_roomId);
        if (lightTargets != null && lightTargets.isNotEmpty) {
          final roleGroups = _groupTargetsByRole(lightTargets);
          for (final entry in roleGroups.entries) {
            final channelId = LightingConstants.getRoleChannelId(entry.key);
            _roleControlStateService.checkConvergence(channelId, entry.value);
          }
        }

        // Check convergence for hero card control channels
        final heroRoleState = _getHeroRoleAggregatedState();
        final effectiveRole = _getEffectiveRoleFromTargets();
        if (heroRoleState != null && effectiveRole != null) {
          final heroTargets = [heroRoleState];
          for (final channelId in _heroControlChannelIds) {
            _heroControlStateService.checkConvergence(channelId, heroTargets);
          }
          final roleMixedState = _buildHeroMixedStateFromRole(heroRoleState);
          _loadHeroCachedValuesIfNeeded(heroRoleState, roleMixedState, effectiveRole);
          _updateHeroCacheIfSynced(heroRoleState, effectiveRole);
        }

        // Check convergence for device-level on/off optimistic states
        // (set by _toggleLight via DeviceControlStateService).
        _checkDeviceLightConvergence();

        setState(() {});

        // Update bottom nav mode config if this is the active page
        _registerModeConfig();
      }
    });
    // Ensure a frame is scheduled so the post-frame callback runs promptly
    // (addPostFrameCallback alone does not schedule a frame).
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  /// Checks convergence for device-level on/off optimistic states set by
  /// [_toggleLight]. Without this, the [DeviceControlStateService] transitions
  /// pending → settling → mixed and stays locked forever, returning the stale
  /// desired value in [_getLightOptimisticOn].
  void _checkDeviceLightConvergence() {
    final controlState = _deviceControlStateService;
    final devicesService = _devicesService;
    if (controlState == null || devicesService == null) return;

    final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Only check properties that have active optimistic state.
      if (controlState.isLocked(target.deviceId, channel.id, channel.onProp.id)) {
        controlState.checkPropertyConvergence(
          target.deviceId,
          channel.id,
          channel.onProp.id,
          channel.on,
        );
      }
    }
  }

  /// Group light targets by their role.
  /// Uses caching to avoid recomputation when targets haven't changed.
  Map<LightTargetRole, List<LightTargetView>> _groupTargetsByRole(
    List<LightTargetView> targets,
  ) {
    // Compute content-based hash using target IDs
    final currentHash = _computeTargetsHash(targets);

    // Return cached result if targets haven't changed
    if (_cachedRoleGroups != null && currentHash == _cachedTargetsHash) {
      return _cachedRoleGroups!;
    }

    final result = <LightTargetRole, List<LightTargetView>>{};
    for (final target in targets) {
      final role = target.role;
      // Skip targets without a specific role — null, "other", and "hidden"
      // are all considered not configured for this screen
      if (role == null || role == LightTargetRole.other || role == LightTargetRole.hidden) continue;
      result.putIfAbsent(role, () => []).add(target);
    }

    // Cache the result with content hash
    _cachedRoleGroups = result;
    _cachedTargetsHash = currentHash;
    return result;
  }

  /// Compute a hash based on target IDs and roles for cache invalidation.
  int _computeTargetsHash(List<LightTargetView> targets) {
    int hash = targets.length;
    for (final target in targets) {
      hash = hash ^ target.id.hashCode ^ target.deviceId.hashCode ^ (target.role?.hashCode ?? 0);
    }
    return hash;
  }

  void _onControlStateChanged() {
    if (!mounted || _isAnyDragging) return;
    setState(() {});
  }

  void _onIntentChanged() {
    if (!mounted) return;

    // Early return if intents repository is not available
    final intentsRepo = _intentsRepository;
    if (intentsRepo == null) return;

    // Check if space intent was unlocked (completed)
    final isNowLocked = intentsRepo.isSpaceLocked(_roomId);

    final lightingState = _lightingState;
    final modeTargets = lightingState != null
        ? [lightingState]
        : <LightingStateModel>[];

    // Get light targets for role channel completion checks
    final lightTargets = _spacesService?.getLightTargetsForSpace(_roomId);
    final roleGroups = lightTargets != null && lightTargets.isNotEmpty
        ? _groupTargetsByRole(lightTargets)
        : <LightTargetRole, List<LightTargetView>>{};

    // Track which role channels are currently locked
    final roleChannelsNowLocked = <String>{};
    for (final entry in roleGroups.entries) {
      final channelId = LightingConstants.getRoleChannelId(entry.key);
      if (_roleControlStateService.isLocked(channelId)) {
        roleChannelsNowLocked.add(channelId);
      }
    }

    // Detect mode intent unlock
    if (_modeWasLocked && !isNowLocked) {
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Intent unlocked - triggering settling for mode');
      }
      _modeControlStateService.onIntentCompleted(
        LightingConstants.modeChannelId,
        modeTargets,
      );

      // Only trigger completion for role toggles that are actually pending.
      // This prevents incorrectly completing role toggles that weren't
      // triggered by the current intent (e.g., role toggles have their own
      // separate intents from mode changes).
      for (final entry in roleGroups.entries) {
        final channelId = LightingConstants.getRoleChannelId(entry.key);
        // Only complete if this specific role channel is actually pending
        if (_roleControlStateService.isLocked(channelId)) {
          _roleControlStateService.onIntentCompleted(channelId, entry.value);
        }
      }
    }

    // Detect role toggle intent unlocks (independent of mode changes)
    // When space intent unlocks and it wasn't a mode change, check for locked role channels
    // If a role channel is locked, it means it was part of the intent that just completed
    if (_spaceWasLocked && !isNowLocked && !_modeWasLocked && roleChannelsNowLocked.isNotEmpty) {
      // Space was locked and is now unlocked, and it wasn't a mode change, so it must have been a role toggle
      // Complete all currently locked role channels (they were part of the completed intent)
      for (final entry in roleGroups.entries) {
        final channelId = LightingConstants.getRoleChannelId(entry.key);
        if (roleChannelsNowLocked.contains(channelId)) {
          if (kDebugMode) {
            debugPrint('[LightsDomainView] Role intent unlocked - triggering settling for ${entry.key.name}');
          }
          _roleControlStateService.onIntentCompleted(channelId, entry.value);
        }
      }
    }

    // Detect hero control intent unlock
    if (_heroWasSpaceLocked && !isNowLocked) {
      final heroRoleState = _getHeroRoleAggregatedState();
      final heroTargets = heroRoleState != null
          ? [heroRoleState]
          : <RoleAggregatedState>[];
      for (final channelId in _heroControlChannelIds) {
        _heroControlStateService.onIntentCompleted(channelId, heroTargets);
      }
    }

    // Update tracking state for next iteration
    // Only update _modeWasLocked if a mode change was in progress (it was already true)
    // This prevents incorrectly setting it to true when other intents (like role toggles) lock the space
    if (_modeWasLocked) {
      _modeWasLocked = isNowLocked;
    }
    if (_heroWasSpaceLocked) {
      _heroWasSpaceLocked = isNowLocked;
    }
    // Always update _spaceWasLocked to track space lock state
    _spaceWasLocked = isNowLocked;
  }

  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------
  // [DomainViewLayout]: the header, the hero for the selected role, the role
  // tiles and the lighting scene pills (docs/display-ui-design-spec.md §4,
  // §6; design canvas "3 · Domain views").

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (_isLoading || _hasError) {
      return DomainViewLayout(
        header: _buildHeader(
          context,
          subtitle: _isLoading ? localizations.state_loading : null,
        ),
        hero: _isLoading
            ? const DomainHeroState.loading()
            : DomainHeroState(
                state: AppScreenState.error,
                title: localizations.domain_data_load_failed(
                  localizations.domain_lights,
                ),
                message: localizations.domain_data_load_failed_description,
                onAction: _retryLoad,
              ),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final lightTargets =
            _spacesService?.getLightTargetsForSpace(_roomId) ?? [];

        // Already excludes unconfigured and hidden targets.
        final roles = _buildRoleDataList(
          lightTargets,
          devicesService,
          localizations,
        );

        if (roles.isEmpty) {
          return DomainViewLayout(
            header: _buildHeader(
              context,
              subtitle: localizations.domain_not_configured_subtitle,
            ),
            hero: DomainHeroState(
              state: AppScreenState.notConfigured,
              title: localizations.domain_lights_empty_title,
              message: localizations.domain_lights_empty_description,
              icon: MdiIcons.lightbulbOutline,
              domain: ThemeColors.lights,
            ),
          );
        }

        final totalLights = roles.fold<int>(0, (sum, r) => sum + r.totalCount);
        final lightsOn = roles.fold<int>(0, (sum, r) => sum + r.onCount);

        final effectiveRole = _selectedRole ?? roles.first.role;
        final roleData =
            _getRoleDataForRole(roles, effectiveRole) ?? roles.first;
        final heroState = _applyHeroOptimisticOverrides(
          _buildHeroState(roleData, devicesService, localizations) ??
              _LightHeroState(
                roleName: roleData.name,
                deviceCount: roleData.totalCount,
                isOn: roleData.hasLightsOn,
              ),
          localizations,
        );

        final scenes = _lightingScenes;
        // Compact keeps the scenes behind the header button (spec §4).
        final showScenes = scenes.isNotEmpty && !_screenService.isCompact;

        return DomainViewLayout(
          header: _buildHeader(
            context,
            lightsOn: lightsOn,
            totalLights: totalLights,
            roles: roles,
            effectiveRole: roleData.role,
          ),
          hero: _buildHero(context, roles, roleData, heroState),
          tiles: roles.length > 1
              ? [
                  for (final role in roles)
                    _buildRoleTile(context, role, roleData.role),
                ]
              : const [],
          below: showScenes ? _buildScenePills(scenes) : null,
          belowLabel: localizations.lights_scenes_label,
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // ROLE TILES AND SCENES
  // --------------------------------------------------------------------------

  /// One role's value: "Off", "On" or its brightness.
  String _roleValueText(
    LightingRoleData roleData,
    bool? pendingOn,
    AppLocalizations localizations,
  ) {
    if (pendingOn != null) {
      return pendingOn
          ? localizations.light_state_on
          : localizations.light_state_off;
    }
    if (roleData.onCount == 0) return localizations.light_state_off;
    final brightness = roleData.brightness;

    return brightness != null ? '$brightness %' : localizations.light_state_on;
  }

  Widget _buildRoleTile(
    BuildContext context,
    LightingRoleData roleData,
    LightTargetRole effectiveRole,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final pendingState = _getRolePendingState(roleData.role);
    final tilePending = _roleTilePendingOnStates[roleData.role];
    final isOn = tilePending ?? pendingState ?? roleData.hasLightsOn;
    final value = _roleValueText(roleData, tilePending, localizations);

    return DomainTile(
      key: ValueKey('lights-role-${roleData.role.name}'),
      name: roleData.name,
      value: value,
      color: ThemeColors.lights,
      selected: roleData.role == effectiveRole,
      valueMuted: !isOn,
      onTap: () => _selectRole(roleData.role),
      // Landscape role tiles switch their role at once and never lock
      // (spec §7, "Control feedback").
      leading: _screenService.isLandscape
          ? DomainTileToggle(
              icon: roleData.icon,
              on: isOn,
              color: ThemeColors.lights,
              semanticLabel: isOn
                  ? localizations.lights_role_turn_off(roleData.name)
                  : localizations.lights_role_turn_on(roleData.name),
              onTap: () => _toggleRoleFromTile(
                roleData,
                !isOn,
                updateHero: roleData.role == effectiveRole,
              ),
            )
          : null,
    );
  }

  void _selectRole(LightTargetRole role) {
    _resetHeroControlState();
    setState(() {
      _selectedRole = role;
      _activeHeroMode = null;
    });
  }

  void _toggleRoleFromTile(
    LightingRoleData roleData,
    bool turnOn, {
    required bool updateHero,
  }) {
    _roleTilePendingTimers[roleData.role]?.cancel();
    setState(() {
      _roleTilePendingOnStates[roleData.role] = turnOn;
    });
    _roleTilePendingTimers[roleData.role] = Timer(
      const Duration(milliseconds: LightingConstants.onOffSettlingWindowMs),
      () {
        if (mounted) {
          setState(() {
            _roleTilePendingOnStates.remove(roleData.role);
          });
        }
      },
    );
    _toggleRoleLights(roleData, turnOn, updateHero: updateHero);
  }

  /// The role chooser on the square, where the role tiles do not fit.
  Future<void> _showRolesChooser(
    List<LightingRoleData> roles,
    LightTargetRole effectiveRole,
  ) async {
    final localizations = AppLocalizations.of(context)!;
    final role = await showAppSelectionDialog<LightTargetRole>(
      context: context,
      title: localizations.lights_roles_title,
      currentValue: effectiveRole,
      options: [
        for (final roleData in roles)
          SelectionOption(
            value: roleData.role,
            label:
                '${roleData.name} · ${_roleValueText(roleData, null, localizations)}',
          ),
      ],
    );
    if (role != null && mounted && role != effectiveRole) _selectRole(role);
  }

  Widget _buildScenePills(List<SceneView> scenes) {
    final localizations = AppLocalizations.of(context)!;

    return DomainPillRow(
      pills: [
        for (final scene in scenes)
          DomainPillData(
            label: scene.name,
            semanticLabel: localizations.lights_scene_run(scene.name),
            onTap: _isSceneTriggering ? null : () => _activateScene(scene),
          ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // HERO
  // --------------------------------------------------------------------------
  // [HeroCard.slots]: the role badge (opens the role's lights), the value of
  // the light property shown, the property line (a chooser when the role has
  // more than one), the property's slider and its preset buttons.

  /// The light property the hero shows and sets.
  LightHeroCapability? _heroMode(_LightHeroState state) {
    if (state.capabilities.isEmpty) return null;
    final active = state.activeMode;
    if (active != null && state.capabilities.contains(active)) return active;
    final caps = state.capabilities.toList()
      ..sort((a, b) => a.index.compareTo(b.index));

    return caps.first;
  }

  /// The hero control's feedback state for [channelId].
  ControlState _heroControlState(String channelId) {
    if (_heroControlStateService.isMixed(channelId)) {
      return ControlState.unconfirmed;
    }
    if (_heroControlStateService.isLocked(channelId)) {
      return ControlState.pending;
    }

    return ControlState.idle;
  }

  static String _channelFor(LightHeroCapability mode) => switch (mode) {
    LightHeroCapability.brightness => LightingConstants.brightnessChannelId,
    LightHeroCapability.colorTemp => LightingConstants.temperatureChannelId,
    LightHeroCapability.hue => LightingConstants.hueChannelId,
    LightHeroCapability.saturation => LightingConstants.saturationChannelId,
    LightHeroCapability.whiteChannel => LightingConstants.whiteChannelId,
  };

  Widget _buildHero(
    BuildContext context,
    List<LightingRoleData> roles,
    LightingRoleData roleData,
    _LightHeroState state,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mode = _heroMode(state);
    final onOffState = _heroControlState(LightingConstants.onOffChannelId);
    final valueState = mode == null ? onOffState : _heroControlState(_channelFor(mode));
    final controlState = onOffState == ControlState.idle ? valueState : onOffState;

    // On the square the role tiles do not fit and the badge chooses the
    // role (design canvas, the square boards); elsewhere it opens the
    // role's lights.
    final badge = HeroBadge(
      key: const ValueKey('lights-hero-badge'),
      icon: roleData.icon,
      label: roleData.name,
      color: ThemeColors.lights,
      onTap: _screenService.isSquare && roles.length > 1
          ? () => _showRolesChooser(roles, roleData.role)
          : () => _showRoleLightsSheet(roleData),
    );

    final value = _LightsHeroValue.of(state, mode, localizations);

    Widget feedback;
    if (controlState == ControlState.unconfirmed) {
      feedback = OutcomeIndicator(
        outcome: AppOutcome.notConfirmed,
        onDetails: () => _showRoleLightsSheet(roleData),
      );
    } else if (controlState == ControlState.pending) {
      feedback = HeroFeedback(
        text: localizations.outcome_setting,
        icon: MdiIcons.refresh,
      );
    } else {
      final caps = state.capabilities.toList()
        ..sort((a, b) => a.index.compareTo(b.index));
      final line = mode == null
          ? roleData.name
          : '${_LightsHeroValue.capLabel(mode, localizations)} · ${roleData.name}';
      feedback = HeroFeedback(
        key: const ValueKey('lights-hero-property'),
        text: line,
        semanticLabel: localizations.lights_property_choose(line),
        onTap: caps.length >= 2
            ? () => _chooseHeroMode(caps, mode ?? caps.first)
            : null,
      );
    }

    Widget? slider;
    if (mode != null) {
      final params = _LightsHeroValue.slider(state, mode, isDark);
      slider = AppSlider(
        key: const ValueKey('lights-hero-slider'),
        value: params.position,
        hero: true,
        color: ThemeColors.lights,
        trackGradient: params.track,
        thumbColor: params.thumb,
        state: state.isOn ? controlState : ControlState.disabled,
        semanticLabel: _LightsHeroValue.capLabel(mode, localizations),
        semanticFormatter: (v) => _LightsHeroValue.format(
          mode,
          _LightsHeroValue.toActual(state, mode, v),
          localizations,
        ),
        onChanged: state.isOn
            ? (v) {
                HapticFeedback.selectionClick();
                _onHeroValueChanged(
                  mode,
                  _LightsHeroValue.toActual(state, mode, v),
                  roleData.role,
                  state,
                );
              }
            : null,
      );
    }

    return HeroCard.slots(
      key: const ValueKey('lights-hero'),
      fill: true,
      value: value.text,
      unit: value.unit,
      swatch: value.swatch,
      dimmed: !state.isOn || controlState == ControlState.pending,
      badge: badge,
      feedback: feedback,
      slider: slider,
      buttons: HeroButtonRow(
        color: ThemeColors.lights,
        buttons: _heroButtons(roleData, state, mode, localizations),
      ),
    );
  }

  Future<void> _chooseHeroMode(
    List<LightHeroCapability> caps,
    LightHeroCapability current,
  ) async {
    final localizations = AppLocalizations.of(context)!;
    final mode = await showAppSelectionDialog<LightHeroCapability>(
      context: context,
      title: localizations.lights_property_title,
      currentValue: current,
      options: [
        for (final cap in caps)
          SelectionOption(
            value: cap,
            label: _LightsHeroValue.capLabel(cap, localizations),
          ),
      ],
    );
    if (mode != null && mounted) setState(() => _activeHeroMode = mode);
  }

  /// The hero's preset buttons for [mode]: Off and four levels for
  /// brightness, Off and warm to cool for colour temperature, Off and named
  /// colours for hue. Every property leads with Off, and a preset on an off
  /// role turns it on first, so the role's power is one tap away whichever
  /// property the hero shows. An on/off-only role gets Off and On.
  List<HeroButtonData> _heroButtons(
    LightingRoleData roleData,
    _LightHeroState state,
    LightHeroCapability? mode,
    AppLocalizations localizations,
  ) {
    void turn(bool on) {
      HapticFeedback.mediumImpact();
      _toggleRoleLights(roleData, on);
    }

    // An off role turns on, then takes the value, unless the hero has moved
    // to another role meanwhile: the value would land on the new role's
    // hero state.
    VoidCallback preset(LightHeroCapability m, double v) => () async {
          if (!state.isOn) {
            final generation = _heroGeneration;
            await _toggleRoleLights(roleData, true);
            if (!mounted || generation != _heroGeneration) return;
          }
          HapticFeedback.selectionClick();
          _onHeroValueChanged(m, v, roleData.role, state);
        };

    final off = HeroButtonData(
      label: localizations.light_state_off,
      selected: !state.isOn,
      onTap: state.isOn ? () => turn(false) : null,
    );

    switch (mode) {
      case null:
        return [
          off,
          HeroButtonData(
            label: localizations.light_state_on,
            selected: state.isOn,
            onTap: state.isOn ? null : () => turn(true),
          ),
        ];
      case LightHeroCapability.brightness:
        HeroButtonData level(int v, {bool optional = false}) => HeroButtonData(
              label: '$v%',
              optional: optional,
              selected: state.isOn && state.brightness.round() == v,
              onTap: preset(LightHeroCapability.brightness, v.toDouble()),
            );

        return [
          off,
          level(25, optional: true),
          level(50),
          level(75, optional: true),
          level(100),
        ];
      case LightHeroCapability.colorTemp:
        final mid = (state.minColorTemp + state.maxColorTemp) / 2;
        HeroButtonData temp(String label, double v) => HeroButtonData(
              label: label,
              selected: state.isOn && (state.colorTemp - v).abs() < 100,
              onTap: preset(LightHeroCapability.colorTemp, v),
            );

        return [
          off,
          temp(localizations.light_preset_warm, state.minColorTemp),
          temp(localizations.light_preset_neutral, mid),
          temp(localizations.light_preset_cool, state.maxColorTemp),
        ];
      case LightHeroCapability.hue:
        HeroButtonData colour(String label, double v, {bool optional = false}) {
          final distance = (state.hue - v).abs() % 360;
          return HeroButtonData(
            label: label,
            optional: optional,
            selected: state.isOn && math.min(distance, 360 - distance) < 15,
            onTap: preset(LightHeroCapability.hue, v),
          );
        }

        return [
          off,
          colour(localizations.light_color_red, 10),
          colour(localizations.light_color_orange, 30, optional: true),
          colour(localizations.light_color_green, 120),
          colour(localizations.light_color_blue, 210),
          colour(localizations.light_color_purple, 280, optional: true),
        ];
      case LightHeroCapability.saturation:
        HeroButtonData sat(int v, {bool optional = false}) => HeroButtonData(
              label: '$v%',
              optional: optional,
              selected: state.isOn && state.saturation.round() == v,
              onTap: preset(LightHeroCapability.saturation, v.toDouble()),
            );

        return [
          off,
          sat(25, optional: true),
          sat(50),
          sat(75, optional: true),
          sat(100),
        ];
      case LightHeroCapability.whiteChannel:
        // The white channel's own 0 is "0%", not Off: Off is the role's
        // power.
        HeroButtonData white(int v) => HeroButtonData(
              label: '$v%',
              selected: state.isOn && state.whiteChannel.round() == v,
              onTap: preset(LightHeroCapability.whiteChannel, v.toDouble()),
            );

        return [off, white(0), white(50), white(100)];
    }
  }

  // --------------------------------------------------------------------------
  // DATA BUILDING
  // --------------------------------------------------------------------------
  // [_buildRoleDataList]: group targets by role, compute onCount/brightness
  // (with optional lookup maps for large lists). [_buildOtherLights],
  // [_getRoleName], [_getRoleIcon]. [_getLightOptimisticOn]
  // for single-light optimistic on/off.

  /// Builds a list of [LightingRoleData] from the given targets.
  ///
  /// Uses [RoleAggregatedState] from [SpacesService.getLightingState()] as the
  /// source of truth for on/off counts and brightness, matching the approach
  /// in the role detail page. Targets are still grouped for navigation and
  /// capability detection.
  List<LightingRoleData> _buildRoleDataList(
    List<LightTargetView> targets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final grouped = _groupTargetsByRole(targets);
    final lightingState = _lightingState;

    final List<LightingRoleData> roles = [];
    for (final role in LightTargetRole.values) {
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      // Read aggregated values from backend state
      final stateRole = mapTargetRoleToStateRole(role);
      final roleState = stateRole != null ? lightingState?.getRoleState(stateRole) : null;

      final onCount = roleState?.devicesOn ?? 0;
      final totalCount = roleState?.devicesCount ?? roleTargets.length;
      final brightness = roleState?.brightness;

      roles.add(LightingRoleData(
        role: role,
        name: _getRoleName(role, localizations),
        icon: _getRoleIcon(role),
        onCount: onCount,
        totalCount: totalCount,
        brightness: onCount > 0 ? brightness : null,
        targets: roleTargets,
      ));
    }

    return roles;
  }

  /// Get optimistic on/off state for a single light from overlay services.
  /// Falls back to [fallback] when no pending state exists.
  bool _getLightOptimisticOn(
    String deviceId,
    String channelId,
    String propertyId,
    bool fallback,
  ) {
    final deviceControl = _deviceControlStateService;
    if (deviceControl != null &&
        deviceControl.isLocked(deviceId, channelId, propertyId)) {
      final v = deviceControl.getDesiredValue(deviceId, channelId, propertyId);
      if (v is bool) return v;
    }
    final overlay = _intentOverlayService;
    if (overlay != null && overlay.isLocked(deviceId, channelId, propertyId)) {
      final v = overlay.getOverlayValue(deviceId, channelId, propertyId);
      if (v is bool) return v;
    }
    return fallback;
  }

  List<LightDeviceData> _buildOtherLights(
    List<LightTargetView> targets,
    DevicesService devicesService,
    String roomName,
  ) {
    final List<LightDeviceData> lights = [];

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );
      final isOn = _getLightOptimisticOn(
        target.deviceId,
        target.channelId,
        channel.onProp.id,
        channel.on,
      );

      LightState state;
      if (!device.isOnline) {
        state = LightState.offline;
      } else if (isOn) {
        state = LightState.on;
      } else {
        state = LightState.off;
      }

      lights.add(LightDeviceData(
        deviceId: target.deviceId,
        channelId: channel.id,
        name: getLightTargetDisplayName(target, targets, roomName),
        state: state,
        brightness: channel.hasBrightness && isOn ? channel.brightness : null,
      ));
    }

    return lights;
  }

  String _getRoleName(LightTargetRole role, AppLocalizations localizations) {
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

  IconData _getRoleIcon(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return MdiIcons.ceilingLight;
      case LightTargetRole.ambient:
        return MdiIcons.wallSconce;
      case LightTargetRole.task:
        return MdiIcons.deskLamp;
      case LightTargetRole.accent:
        return MdiIcons.lightbulbSpot;
      case LightTargetRole.night:
        return MdiIcons.weatherNight;
      case LightTargetRole.other:
        return MdiIcons.lightbulbOutline;
      case LightTargetRole.hidden:
        return MdiIcons.eyeOff;
    }
  }

  // --------------------------------------------------------------------------
  // HERO STATE BUILDING
  // --------------------------------------------------------------------------

  /// Build the hero card state for a selected role.
  ///
  /// Capabilities and value ranges come from device channels; aggregated
  /// display values (brightness, color temp, hue, etc.) come from
  /// [RoleAggregatedState] — the same source as the role detail page.
  _LightHeroState? _buildHeroState(
    LightingRoleData roleData,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final targets = roleData.targets;
    if (targets.isEmpty) return null;

    // Detect capabilities and ranges from device channels
    final Set<LightHeroCapability> capabilities = {};
    double minColorTemp = 2700;
    double maxColorTemp = 6500;
    double minHue = 0;
    double maxHue = 359;
    int deviceCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );
      deviceCount++;

      if (channel.hasBrightness) {
        capabilities.add(LightHeroCapability.brightness);
      }

      if (channel.hasTemperature) {
        capabilities.add(LightHeroCapability.colorTemp);
        final tempProp = channel.temperatureProp;
        if (tempProp != null) {
          final format = tempProp.format;
          if (format is NumberListFormatType && format.value.length == 2) {
            minColorTemp = (format.value[0] as num).toDouble();
            maxColorTemp = (format.value[1] as num).toDouble();
          }
        }
      }

      if (channel.hasHue) {
        capabilities.add(LightHeroCapability.hue);
        minHue = channel.minHue;
        maxHue = channel.maxHue.clamp(0, 359).toDouble();
      }

      if (channel.hasSaturation) {
        capabilities.add(LightHeroCapability.saturation);
      }

      if (channel.hasColorWhite) {
        capabilities.add(LightHeroCapability.whiteChannel);
      }
    }

    if (deviceCount == 0) return null;

    // Read aggregated values from RoleAggregatedState (matching detail page).
    // These persist regardless of on/off state.
    final stateRole = mapTargetRoleToStateRole(roleData.role);
    final roleState = stateRole != null
        ? _lightingState?.getRoleState(stateRole)
        : null;

    final isOn = roleState?.anyOn ?? false;
    final brightness = roleState?.brightness?.toDouble() ?? 100;
    final colorTemp = roleState?.colorTemperature?.toDouble() ?? 4000;
    final white = roleState?.white?.toDouble() ?? 100;

    // Parse color for hue/saturation from RoleAggregatedState first.
    // Backend may return hex (#RRGGBB) or hue-only (hue:181) format.
    double hue = 0;
    double saturation = 0;
    Color? currentColor;
    String? colorName;

    final (parsedHue, parsedSat) = _parseColorToHueSat(roleState?.color);
    if (parsedHue != null) {
      hue = parsedHue;
      saturation = parsedSat != null ? parsedSat * 100 : 100;
      final cached = _roleControlStateRepository?.get(_heroCacheKey(roleData.role));
      if (parsedSat == null && cached?.saturation != null) {
        saturation = cached!.saturation! * 100;
      }
      currentColor = HSVColor.fromAHSV(1, hue.clamp(0, 360), (saturation / 100).clamp(0.0, 1.0), 1).toColor();
      colorName = _heroHueName(hue, localizations);
    } else if (capabilities.contains(LightHeroCapability.hue)) {
      // Fall back to device channel values for color info
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is! LightingDeviceView) continue;
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColor) {
          try {
            currentColor = channel.color;
            if (channel.hasHue) {
              hue = channel.hue;
              colorName = _heroHueName(hue, localizations);
            }
            if (channel.hasSaturation) {
              saturation = channel.saturation.toDouble();
            }
            break;
          } catch (_) {}
        }
      }
      // Ensure color swatch is always visible when hue is supported
      currentColor ??= HSVColor.fromAHSV(
        1, hue.clamp(0, 360), (saturation / 100).clamp(0.0, 1.0), 1,
      ).toColor();
    }

    // Determine status icon: offline → alert, mixed → tune, synced → lightbulbGroup
    IconData statusIcon;
    final hasOffline = targets.any((t) {
      final d = devicesService.getDevice(t.deviceId);
      return d != null && !d.isOnline;
    });
    if (hasOffline) {
      statusIcon = MdiIcons.alert;
    } else if (roleState != null) {
      final mixed = _buildHeroMixedStateFromRole(roleState);
      statusIcon = mixed.isMixed ? MdiIcons.tune : MdiIcons.lightbulbGroup;
    } else {
      statusIcon = MdiIcons.lightbulbGroup;
    }

    return _LightHeroState(
      roleName: roleData.name,
      deviceCount: deviceCount,
      isOn: isOn,
      capabilities: capabilities,
      activeMode: _activeHeroMode ??
          (capabilities.isNotEmpty ? capabilities.first : null),
      brightness: brightness,
      colorTemp: colorTemp,
      minColorTemp: minColorTemp,
      maxColorTemp: maxColorTemp,
      hue: hue,
      minHue: minHue,
      maxHue: maxHue,
      saturation: saturation,
      whiteChannel: white,
      currentColor: currentColor,
      colorName: colorName,
      statusIcon: statusIcon,
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  /// The header: the Lights icon tile in the domain colour, the live-state
  /// line, the mode chip in landscape, on the square a role button and on
  /// Compact a scenes button.
  Widget _buildHeader(
    BuildContext context, {
    int? lightsOn,
    int? totalLights,
    String? subtitle,
    List<LightingRoleData> roles = const [],
    LightTargetRole? effectiveRole,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final hasLightsOn = (lightsOn ?? 0) > 0;
    final unknown = _lightingState?.unknownLights ?? 0;
    final selectedRole = effectiveRole == null
        ? null
        : roles.where((r) => r.role == effectiveRole).firstOrNull;

    final line =
        subtitle ??
        (lightsOn != null && totalLights != null
            ? _headerStateLine(localizations, lightsOn, totalLights)
            : null);

    final actions = <Widget>[
      // The square has no room for the role tiles, and its hero may be too
      // short for the badge: the role chooser sits in the header.
      if (_screenService.isSquare && roles.length > 1 && effectiveRole != null)
        HeaderIconButton(
          key: const ValueKey('lights-roles-button'),
          icon: MdiIcons.lightbulbGroupOutline,
          semanticLabel: localizations.lights_roles_title,
          onTap: () => _showRolesChooser(roles, effectiveRole),
        ),
      // The hero badge is how a role's lights open elsewhere. Compact
      // landscape drops it (spec §4, "Domain hero"), and on the square it
      // chooses the role, when there are several, or may not fit: the
      // header takes the lights.
      if (_screenService.isCompact &&
          _screenService.isLandscape &&
          selectedRole != null &&
          (!_screenService.isSquare || roles.length > 1))
        HeaderIconButton(
          key: const ValueKey('lights-role-lights-button'),
          icon: MdiIcons.lightbulbGroup,
          semanticLabel: localizations.lights_role_lights(selectedRole.name),
          onTap: () => _showRoleLightsSheet(selectedRole),
        ),
      if (_screenService.isCompact &&
          lightsOn != null &&
          _lightingScenes.isNotEmpty)
        HeaderIconButton(
          key: const ValueKey('lights-scenes-button'),
          icon: MdiIcons.starOutline,
          semanticLabel: localizations.lights_scenes_label,
          onTap: _showScenesSheet,
        ),
    ];

    return PageHeader(
      title: localizations.domain_lights,
      subtitle: line,
      subtitleColor: unknown > 0
          ? Theme.of(context).status(AppStatus.warning).text
          : null,
      leading: HeaderMainIcon(
        icon: hasLightsOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
        color: ThemeColors.lights,
      ),
      landscapeAction: lightsOn != null ? const DeckModeChip() : null,
      trailing: actions.isEmpty
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: actions,
            ),
    );
  }

  /// "Work · 3 on" while a mode is active or pending, "Custom · 3 on" once
  /// changed by hand, else "3 of 7"; unknown lights are added at the end.
  String _headerStateLine(
    AppLocalizations localizations,
    int lightsOn,
    int totalLights,
  ) {
    String subtitle;
    final isModeLocked = _modeControlStateService.isLocked(
      LightingConstants.modeChannelId,
    );
    final state = _lightingState;

    if (isModeLocked) {
      final desiredIndex = _modeControlStateService
          .getDesiredValue(LightingConstants.modeChannelId)
          ?.toInt();
      if (desiredIndex != null &&
          desiredIndex >= 0 &&
          desiredIndex < LightingModeUI.values.length) {
        final lockedMode = LightingModeUI.values[desiredIndex];
        final modeName = _getModeName(lockedMode, localizations);
        subtitle = localizations.light_header_mode_count(modeName, lightsOn);
      } else {
        subtitle = localizations.light_header_count_of_total(
          lightsOn,
          totalLights,
        );
      }
    } else if (state != null &&
        state.isModeFromIntent &&
        !_modeOverriddenByManualChange &&
        state.detectedMode != null) {
      final detectedModeUI = _toLightingModeUI(state.detectedMode);
      if (detectedModeUI != null && detectedModeUI != LightingModeUI.off) {
        final modeName = _getModeName(detectedModeUI, localizations);
        subtitle = localizations.light_header_mode_count(modeName, lightsOn);
      } else {
        subtitle = localizations.light_header_count_of_total(
          lightsOn,
          totalLights,
        );
      }
    } else if (state?.lastAppliedMode != null && lightsOn > 0) {
      subtitle = localizations.light_header_mode_count(
        localizations.domain_mode_custom,
        lightsOn,
      );
    } else {
      subtitle = localizations.light_header_count_of_total(
        lightsOn,
        totalLights,
      );
    }

    if ((state?.unknownLights ?? 0) > 0) {
      subtitle =
          '$subtitle · ${localizations.filter_status_unknown}: ${state!.unknownLights}';
    }

    return subtitle;
  }

  /// Get localized name for lighting mode
  String _getModeName(LightingModeUI mode, AppLocalizations localizations) {
    switch (mode) {
      case LightingModeUI.off:
        return localizations.space_lighting_mode_off;
      case LightingModeUI.work:
        return localizations.space_lighting_mode_work;
      case LightingModeUI.relax:
        return localizations.space_lighting_mode_relax;
      case LightingModeUI.night:
        return localizations.space_lighting_mode_night;
    }
  }

  /// Convert backend [LightingMode] to [LightingModeUI]. Returns null for null input.
  LightingModeUI? _toLightingModeUI(LightingMode? mode) {
    if (mode == null) return null;
    return LightingModeUI.values.firstWhere(
      (m) => m.name == mode.name,
      orElse: () => LightingModeUI.off,
    );
  }

  (LightingModeUI?, LightingModeUI?, LightingModeUI?) _getLightingModeSelectorValues() {
    final isLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);
    LightingModeUI? lockedValue;
    if (isLocked) {
      final desiredIndex = _modeControlStateService
          .getDesiredValue(LightingConstants.modeChannelId)
          ?.toInt();
      if (desiredIndex != null &&
          desiredIndex >= 0 &&
          desiredIndex < LightingModeUI.values.length) {
        lockedValue = LightingModeUI.values[desiredIndex];
      }
    }

    final state = _lightingState;
    final detectedModeUI = _toLightingModeUI(state?.detectedMode);
    final lastAppliedModeUI = _toLightingModeUI(state?.lastAppliedMode);

    return computeIntentModeStatus<LightingModeUI>(
      selectedIntent: lastAppliedModeUI,
      currentState: detectedModeUI,
      isCurrentStateFromIntent: (state?.isModeFromIntent ?? false) && !_modeOverriddenByManualChange,
      isLocked: isLocked,
      lockedValue: lockedValue,
    ).toTuple();
  }

  /// Sync all lights in the role to current hero display values.
  Future<void> _heroSyncAllForRole(LightingRoleData roleData) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final heroState = _buildHeroState(roleData, devicesService, localizations);
    if (heroState == null) return;
    final state = _applyHeroOptimisticOverrides(heroState, localizations);
    final stateRole = mapTargetRoleToStateRole(roleData.role);
    if (stateRole == null) return;

    final spacesService = _spacesService;
    if (spacesService == null) return;

    try {
      _heroWasSpaceLocked = true;

      if (!state.isOn) {
        final result = await spacesService.turnRoleOff(_roomId, stateRole);
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (mounted && result == null) Toast.showError(context, message: localizations.action_failed);
        return;
      }

      var result = await spacesService.turnRoleOn(_roomId, stateRole);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        Toast.showError(context, message: localizations.action_failed);
        return;
      }

      final capabilities = state.capabilities;
      if (capabilities.contains(LightHeroCapability.brightness)) {
        result = await spacesService.setRoleBrightness(_roomId, stateRole, state.brightness.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) Toast.showError(context, message: localizations.action_failed);
      }
      if (capabilities.contains(LightHeroCapability.colorTemp)) {
        result = await spacesService.setRoleColorTemp(_roomId, stateRole, state.colorTemp.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) Toast.showError(context, message: localizations.action_failed);
      }
      if (capabilities.contains(LightHeroCapability.hue) || capabilities.contains(LightHeroCapability.saturation)) {
        final color = HSVColor.fromAHSV(
          1.0,
          state.hue.clamp(0, 360),
          (state.saturation / 100).clamp(0.0, 1.0),
          1.0,
        ).toColor();
        final hex = '#${(color.r * 255).toInt().toRadixString(16).padLeft(2, '0')}'
            '${(color.g * 255).toInt().toRadixString(16).padLeft(2, '0')}'
            '${(color.b * 255).toInt().toRadixString(16).padLeft(2, '0')}'.toUpperCase();
        result = await spacesService.setRoleColor(_roomId, stateRole, hex);
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) Toast.showError(context, message: localizations.action_failed);
      }
      if (capabilities.contains(LightHeroCapability.whiteChannel)) {
        result = await spacesService.setRoleWhite(_roomId, stateRole, state.whiteChannel.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) Toast.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (mounted) Toast.showError(context, message: localizations.action_failed);
    }
  }

  /// Shows a bottom sheet (portrait) / drawer (landscape) with the lights
  /// assigned to a specific role.
  void _showRoleLightsSheet(LightingRoleData roleData) {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

    // Check there are lights to show before opening the sheet.
    final initialLights =
        _buildOtherLights(roleData.targets, devicesService, roomName);
    if (initialLights.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final roleName = _getRoleName(roleData.role, localizations);
    final isLandscape = locator<ScreenService>().isLandscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showRightDrawer(
        context,
        title: roleName,
        titleIcon: MdiIcons.lightbulbGroup,
        scrollable: false,
        content: ListenableBuilder(
          listenable: _roleLightsSheetNotifier,
          builder: (ctx, _) {
            final lights = _buildOtherLights(
              roleData.targets,
              devicesService,
              roomName,
            );
            return Column(
              children: [
                Expanded(
                  child: VerticalScrollWithGradient(
                    itemCount: lights.length,
                    separatorHeight: AppSpacings.pSm,
                    backgroundColor: drawerBgColor,
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                    itemBuilder: (context, index) =>
                        _buildOtherLightTileForSheet(context, lights[index]),
                  ),
                ),
                _buildRoleLightsSheetFooter(ctx, roleData),
              ],
            );
          },
        ),
      );
    } else {
      showBottomSheetDialog(
        context,
        title: roleName,
        titleIcon: MdiIcons.lightbulbGroup,
        scrollable: false,
        content: ListenableBuilder(
          listenable: _roleLightsSheetNotifier,
          builder: (ctx, _) {
            final lights = _buildOtherLights(
              roleData.targets,
              devicesService,
              roomName,
            );
            final isDark =
                Theme.of(ctx).brightness == Brightness.dark;
            final bgColor =
                isDark ? AppFillColorDark.base : AppFillColorLight.blank;
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: VerticalScrollWithGradient(
                    itemCount: lights.length,
                    separatorHeight: AppSpacings.pSm,
                    backgroundColor: bgColor,
                    shrinkWrap: true,
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                    itemBuilder: (c, i) =>
                        _buildOtherLightTileForSheet(c, lights[i]),
                  ),
                ),
                _buildRoleLightsSheetFooter(ctx, roleData),
              ],
            );
          },
        ),
      );
    }
  }

  /// Builds the footer for the role-lights sheet: sync-all, retry, or nothing.
  ///
  /// Checks the device-level optimistic state (same source as the tile icons)
  /// rather than the backend role-level aggregated state, so the button
  /// appears/disappears immediately after [_toggleLight].
  ///
  /// Includes its own top-border decoration so it can live inside the content
  /// area and collapse to [SizedBox.shrink] without leaving a visible gap.
  Widget _buildRoleLightsSheetFooter(
    BuildContext context,
    LightingRoleData roleData,
  ) {
    final devicesService = _devicesService;
    if (devicesService == null) return const SizedBox.shrink();

    // Check device-level state (with optimistic overlays) for mixed / offline.
    bool hasOn = false;
    bool hasOff = false;
    bool hasOffline = false;
    for (final t in roleData.targets) {
      final device = devicesService.getDevice(t.deviceId);
      if (device is! LightingDeviceView) continue;
      if (!device.isOnline) {
        hasOffline = true;
        continue;
      }
      final channel = device.lightChannels.firstWhere(
        (c) => c.id == t.channelId,
        orElse: () => device.lightChannels.first,
      );
      final isOn = _getLightOptimisticOn(
        t.deviceId,
        t.channelId,
        channel.onProp.id,
        channel.on,
      );
      if (isOn) {
        hasOn = true;
      } else {
        hasOff = true;
      }
    }
    final isMixed = hasOn && hasOff;

    if (!isMixed && !hasOffline) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final borderColor =
        isDark ? AppBorderColorDark.darker : AppBorderColorLight.darker;
    final filledTheme = hasOffline
        ? (isDark
            ? AppFilledButtonsDarkThemes.warning
            : AppFilledButtonsLightThemes.warning)
        : (isDark
            ? AppFilledButtonsDarkThemes.info
            : AppFilledButtonsLightThemes.info);
    final label = hasOffline
        ? localizations.button_retry
        : localizations.button_sync_all;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: borderColor,
            width: AppSpacings.scale(1),
          ),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pMd,
        ),
        child: Theme(
          data: Theme.of(context).copyWith(filledButtonTheme: filledTheme),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                _heroSyncAllForRole(roleData);
                Navigator.of(context).pop();
              },
              child: Text(label),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOtherLightTileForSheet(
    BuildContext context,
    LightDeviceData light,
  ) {
    final localizations = AppLocalizations.of(context)!;

    String statusText;
    switch (light.state) {
      case LightState.off:
        statusText = localizations.light_state_off;
      case LightState.on:
        statusText = light.brightness != null
            ? '${light.brightness}%'
            : localizations.light_state_on;
      case LightState.offline:
        statusText = localizations.device_status_offline;
    }

    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lightbulbOutline,
        activeIcon: MdiIcons.lightbulb,
        name: light.name,
        status: statusText,
        isActive: light.isOn,
        isOffline: light.isOffline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onIconTap: light.isOffline
            ? null
            : () => _toggleLight(light),
        onTileTap: () {
          Navigator.of(context).pop();
          _openDeviceDetail(context, light);
        },
      ),
    );
  }

  /// Find [LightingRoleData] for a role in the roles list. Returns null if not found.
  LightingRoleData? _getRoleDataForRole(
    List<LightingRoleData> roles,
    LightTargetRole role,
  ) {
    for (final r in roles) {
      if (r.role == role) return r;
    }
    return null;
  }

  void _showScenesSheet() {
    final scenes = _lightingScenes;
    if (scenes.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape = locator<ScreenService>().isLandscape;

    if (isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.space_scenes_title,
        icon: MdiIcons.autoFix,
        itemCount: scenes.length,
        itemBuilder: (context, index) => _buildSceneTileForSheet(
          context,
          scenes[index],
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.space_scenes_title,
        icon: MdiIcons.autoFix,
        itemCount: scenes.length,
        itemBuilder: (context, index) => _buildSceneTileForSheet(
          context,
          scenes[index],
        ),
      );
    }
  }

  Widget _buildSceneTileForSheet(BuildContext context, SceneView scene) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: scene.iconData,
        name: scene.name,
        isActive: _triggeringSceneId == scene.id,
        showGlow: false,
        showWarningBadge: false,
        showInactiveBorder: false,
        onTileTap: _isSceneTriggering ? null : () {
          Navigator.of(context).pop();
          _activateScene(scene);
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LIGHTING MODE CONTROLS (BACKEND INTENTS)
  // --------------------------------------------------------------------------
  // [_setLightingMode]: setPending → API (turn off or set mode) → onIntentCompleted
  // when IntentsRepository unlocks. [_toggleRoleLights]: role on/off via SpacesService
  // intent. [_toggleLight]: direct device control with DeviceControlStateService.

  /// Set lighting mode via backend intent
  Future<void> _setLightingMode(LightingModeUI mode) async {
    // Guard against concurrent execution - check if mode is already pending
    if (_modeControlStateService.isLocked(LightingConstants.modeChannelId)) return;

    // Get localizations early (should always be available in widget context)
    final localizations = AppLocalizations.of(context)!;

    // Set pending state in control service (will lock UI to show desired value)
    _modeControlStateService.setPending(
      LightingConstants.modeChannelId,
      mode.index.toDouble(),
    );

    if (kDebugMode) {
      debugPrint('[LightsDomainView] Mode change: ${mode.name} (pending)');
    }

    // Track that we're waiting for an intent
    _modeWasLocked = true;
    _modeOverriddenByManualChange = false;
    _lastAppliedAtWhenOverridden = null;

    // Optimistic UI update (now driven by control service)
    setState(() {});

    try {
      bool success = false;

      if (mode == LightingModeUI.off) {
        // Turn all lights off
        final result = await _spacesService?.turnLightsOff(_roomId);
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      } else {
        // Set the mode - backend handles turning on appropriate lights
        final backendMode = mode.toBackendMode();
        final result = await _spacesService?.setLightingMode(_roomId, backendMode);
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      }

      if (success && mounted) {
        // If intents repository is not available, manually trigger completion
        // to start the settling process. Otherwise, rely on _onIntentChanged
        // to detect intent unlock and call onIntentCompleted.
        if (_intentsRepository == null) {
          if (kDebugMode) {
            debugPrint(
              '[LightsDomainView] IntentsRepository unavailable, manually triggering completion for mode',
            );
          }
          final lightingState = _lightingState;
          final modeTargets = lightingState != null
              ? [lightingState]
              : <LightingStateModel>[];
          _modeControlStateService.onIntentCompleted(
            LightingConstants.modeChannelId,
            modeTargets,
          );
          _modeWasLocked = false; // Reset since we're handling completion manually
        }
        // If intents repository is available, _onIntentChanged will handle completion
      } else if (!success && mounted) {
        Toast.showError(context, message: localizations.action_failed);
        _modeControlStateService.setIdle(LightingConstants.modeChannelId);
        _modeWasLocked = false; // Reset to prevent inconsistent state
      }
    } catch (e) {
      // Only show error if the mode change intent itself failed
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to set lighting mode: $e');
      }
      if (mounted) {
        Toast.showError(context, message: localizations.action_failed);
        _modeControlStateService.setIdle(LightingConstants.modeChannelId);
        _modeWasLocked = false; // Reset to prevent inconsistent state
      }
    }
  }

  /// Get mode options for the mode selector (uses page status color for all modes).
  List<ModeOption<LightingModeUI>> _getLightingModeOptions(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    const statusColor = ThemeColors.lights;
    return [
      ModeOption(
        value: LightingModeUI.work,
        icon: MdiIcons.lightbulbOn,
        label: localizations.space_lighting_mode_work,
        color: statusColor,
      ),
      ModeOption(
        value: LightingModeUI.relax,
        icon: MdiIcons.sofaSingleOutline,
        label: localizations.space_lighting_mode_relax,
        color: statusColor,
      ),
      ModeOption(
        value: LightingModeUI.night,
        icon: MdiIcons.weatherNight,
        label: localizations.space_lighting_mode_night,
        color: statusColor,
      ),
      ModeOption(
        value: LightingModeUI.off,
        icon: MdiIcons.power,
        label: localizations.space_lighting_mode_off,
        color: statusColor,
      ),
    ];
  }

  /// Toggle a single light
  Future<void> _toggleLight(LightDeviceData light) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final device = devicesService.getDevice(light.deviceId);
    if (device is! LightingDeviceView) return;

    final channel = device.lightChannels.firstWhere(
      (c) => c.id == light.channelId,
      orElse: () => device.lightChannels.first,
    );

    // Use overlay value if exists (for rapid taps), otherwise use actual state
    final currentOverlay = _intentOverlayService?.getOverlayValue(
      light.deviceId,
      light.channelId,
      channel.onProp.id,
    );
    final currentState = currentOverlay is bool ? currentOverlay : channel.on;
    final newState = !currentState;

    final displayId = _displayRepository?.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: _roomId,
    );

    // Set pending state for immediate optimistic UI (DeviceControlStateService)
    _deviceControlStateService?.setPending(
      light.deviceId,
      light.channelId,
      channel.onProp.id,
      newState,
    );

    // Create overlay for optimistic UI (IntentOverlayService - backup/settling)
    _intentOverlayService?.createLocalOverlay(
      deviceId: light.deviceId,
      channelId: light.channelId,
      propertyId: channel.onProp.id,
      value: newState,
      ttlMs: 5000,
    );

    // Force immediate UI update
    if (mounted) setState(() {});
    _roleLightsSheetNotifier.value++;

    await devicesService.setMultiplePropertyValues(
      properties: [
        PropertyCommandItem(
          deviceId: light.deviceId,
          channelId: light.channelId,
          propertyId: channel.onProp.id,
          value: newState,
        ),
      ],
      context: commandContext,
    );

    // Transition to settling state after command is sent
    _deviceControlStateService?.setSettling(
      light.deviceId,
      light.channelId,
      channel.onProp.id,
    );
  }

  /// Toggle all lights in a role to [turnOn] state via SpacesService intent.
  ///
  /// When [updateHero] is false, hero card optimistic state is not touched —
  /// used when toggling a non-selected role from the landscape tile icon.
  Future<void> _toggleRoleLights(
    LightingRoleData roleData,
    bool turnOn, {
    bool updateHero = true,
  }) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(roleData.role);
    if (stateRole == null) return;
    final generation = _heroGeneration;
    // After the request, the hero is only this role's if no switch happened.
    bool heroStillOurs() => updateHero && generation == _heroGeneration;

    try {
      if (updateHero) {
        _heroPendingOnStateClearTimer?.cancel();
        _heroPendingOnStateClearTimer = null;

        _heroControlStateService.setPending(
          LightingConstants.onOffChannelId,
          turnOn ? LightingConstants.onValue : LightingConstants.offValue,
        );

        setState(() {
          _heroPendingOnState = turnOn;
        });
      }

      _modeOverriddenByManualChange = true;
      _lastAppliedAtWhenOverridden = _lightingState?.lastAppliedAt;

      _heroWasSpaceLocked = true;

      final result = turnOn
          ? await spacesService.turnRoleOn(_roomId, stateRole)
          : await spacesService.turnRoleOff(_roomId, stateRole);
      final success = result != null;

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      }

      if (!mounted) return;

      if (!success) {
        Toast.showError(context, message: localizations.action_failed);
        if (heroStillOurs()) {
          _heroControlStateService.setIdle(LightingConstants.onOffChannelId);
          setState(() {
            _heroPendingOnState = null;
          });
        }
      } else if (heroStillOurs()) {
        _heroPendingOnStateClearTimer = Timer(
          const Duration(milliseconds: LightingConstants.onOffSettlingWindowMs),
          () {
            if (mounted) {
              setState(() {
                _heroPendingOnState = null;
              });
            }
          },
        );
      }
    } catch (e) {
      if (!mounted) return;
      Toast.showError(context, message: localizations.action_failed);
      if (heroStillOurs()) {
        _heroControlStateService.setIdle(LightingConstants.onOffChannelId);
        setState(() {
          _heroPendingOnState = null;
        });
      }
    }
  }

  /// Handle hero card slider/preset value changes with optimistic UI.
  ///
  /// Immediately sets pending state in [_heroControlStateService] and saves
  /// to cache, then debounces the actual API call via [SpacesService].
  void _onHeroValueChanged(
    LightHeroCapability mode,
    double value,
    LightTargetRole role,
    _LightHeroState? heroState,
  ) {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final stateRole = mapTargetRoleToStateRole(role);
    if (stateRole == null) return;

    _modeOverriddenByManualChange = true;
    _lastAppliedAtWhenOverridden = _lightingState?.lastAppliedAt;

    switch (mode) {
      case LightHeroCapability.brightness:
        _isDraggingBrightness = true;
        _heroControlStateService.setPending(
          LightingConstants.brightnessChannelId,
          value,
        );
        _saveHeroToCache(role, brightness: value);
        _heroBrightnessDebounceTimer?.cancel();
        _heroBrightnessDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            _isDraggingBrightness = false;
            _heroSetBrightness(role, value.round());
          },
        );
        break;
      case LightHeroCapability.colorTemp:
        _isDraggingColorTemp = true;
        _heroControlStateService.setPending(
          LightingConstants.temperatureChannelId,
          value,
        );
        _saveHeroToCache(role, temperature: value);
        _heroTemperatureDebounceTimer?.cancel();
        _heroTemperatureDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            _isDraggingColorTemp = false;
            _heroSetColorTemp(role, value.round());
          },
        );
        break;
      case LightHeroCapability.hue:
        _isDraggingHue = true;
        // Backend requires hue + saturation together (hex) to convert to RGB.
        final currentSat = heroState?.saturation ?? 100;
        _heroControlStateService.setPending(
          LightingConstants.hueChannelId,
          value,
        );
        _heroControlStateService.setPending(
          LightingConstants.saturationChannelId,
          currentSat,
        );
        _saveHeroToCache(role, hue: value, saturation: currentSat);
        _heroHueDebounceTimer?.cancel();
        _heroHueDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            _isDraggingHue = false;
            _heroSetColorFromState(role);
          },
        );
        break;
      case LightHeroCapability.saturation:
        _isDraggingHue = true;
        // Backend requires hue + saturation together (hex) to convert to RGB.
        final currentHue = heroState?.hue ?? 0;
        _heroControlStateService.setPending(
          LightingConstants.saturationChannelId,
          value,
        );
        _heroControlStateService.setPending(
          LightingConstants.hueChannelId,
          currentHue,
        );
        _saveHeroToCache(role, saturation: value, hue: currentHue);
        _heroHueDebounceTimer?.cancel();
        _heroHueDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            _isDraggingHue = false;
            _heroSetColorFromState(role);
          },
        );
        break;
      case LightHeroCapability.whiteChannel:
        _isDraggingWhite = true;
        _heroControlStateService.setPending(
          LightingConstants.whiteChannelId,
          value,
        );
        _saveHeroToCache(role, white: value);
        _heroWhiteDebounceTimer?.cancel();
        _heroWhiteDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            _isDraggingWhite = false;
            _heroSetWhite(role, value.round());
          },
        );
        break;
    }

    // Explicit setState so non-slider UI (value labels, hero card displays)
    // reflects the optimistic value immediately. _onControlStateChanged is
    // suppressed while _isAnyDragging is true, so without this call the
    // pending value would not be visible until the debounce timer fires.
    setState(() {});
  }

  /// Execute hero brightness API call with error handling.
  Future<void> _heroSetBrightness(LightTargetRole role, int value) async {
    if (!mounted) return;
    final spacesService = _spacesService;
    final stateRole = mapTargetRoleToStateRole(role);
    if (spacesService == null || stateRole == null) return;

    final localizations = AppLocalizations.of(context)!;
    try {
      _heroWasSpaceLocked = true;
      final result = await spacesService.setRoleBrightness(_roomId, stateRole, value);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        Toast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.brightnessChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      Toast.showError(context, message: localizations.action_failed);
      _heroControlStateService.setIdle(LightingConstants.brightnessChannelId);
    }
  }

  /// Execute hero color temp API call with error handling.
  Future<void> _heroSetColorTemp(LightTargetRole role, int value) async {
    if (!mounted) return;
    final spacesService = _spacesService;
    final stateRole = mapTargetRoleToStateRole(role);
    if (spacesService == null || stateRole == null) return;

    final localizations = AppLocalizations.of(context)!;
    try {
      _heroWasSpaceLocked = true;
      final result = await spacesService.setRoleColorTemp(_roomId, stateRole, value);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        Toast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.temperatureChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      Toast.showError(context, message: localizations.action_failed);
      _heroControlStateService.setIdle(LightingConstants.temperatureChannelId);
    }
  }

  /// Execute hero color API call, reading hue+saturation from control state.
  /// Backend requires both together (as hex) to convert to RGB; sending only one
  /// would fail. We always send both from the state machine.
  Future<void> _heroSetColorFromState(LightTargetRole role) async {
    if (!mounted) return;

    double hue = _heroControlStateService.getDesiredValue(LightingConstants.hueChannelId) ?? 0;
    double satRaw = _heroControlStateService.getDesiredValue(LightingConstants.saturationChannelId) ?? 100;
    double saturation = (satRaw <= 1.0 ? satRaw : satRaw / 100).clamp(0.0, 1.0);

    final roleState = _getHeroRoleAggregatedState();
    if (_heroControlStateService.getDesiredValue(LightingConstants.hueChannelId) == null && roleState != null) {
      final color = _parseHexColor(roleState.color);
      if (color != null) hue = HSVColor.fromColor(color).hue;
    }
    if (_heroControlStateService.getDesiredValue(LightingConstants.saturationChannelId) == null && roleState != null) {
      final color = _parseHexColor(roleState.color);
      if (color != null) saturation = HSVColor.fromColor(color).saturation;
    }

    await _heroSetColor(role, hue.clamp(0, 360), saturation);
  }

  /// Execute hero color API call with error handling.
  /// [hue] 0-360, [saturation] 0.0-1.0. Always sends both as hex to backend.
  Future<void> _heroSetColor(LightTargetRole role, double hue, double saturation) async {
    if (!mounted) return;
    final spacesService = _spacesService;
    final stateRole = mapTargetRoleToStateRole(role);
    if (spacesService == null || stateRole == null) return;

    final localizations = AppLocalizations.of(context)!;
    try {
      _heroWasSpaceLocked = true;
      final color = HSVColor.fromAHSV(1.0, hue.clamp(0, 360), saturation.clamp(0.0, 1.0), 1.0).toColor();
      final hex = '#${(color.r * 255).toInt().toRadixString(16).padLeft(2, '0')}'
          '${(color.g * 255).toInt().toRadixString(16).padLeft(2, '0')}'
          '${(color.b * 255).toInt().toRadixString(16).padLeft(2, '0')}'.toUpperCase();
      final result = await spacesService.setRoleColor(_roomId, stateRole, hex);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        Toast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.hueChannelId);
        _heroControlStateService.setIdle(LightingConstants.saturationChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      Toast.showError(context, message: localizations.action_failed);
      _heroControlStateService.setIdle(LightingConstants.hueChannelId);
      _heroControlStateService.setIdle(LightingConstants.saturationChannelId);
    }
  }

  /// Execute hero white channel API call with error handling.
  Future<void> _heroSetWhite(LightTargetRole role, int value) async {
    if (!mounted) return;
    final spacesService = _spacesService;
    final stateRole = mapTargetRoleToStateRole(role);
    if (spacesService == null || stateRole == null) return;

    final localizations = AppLocalizations.of(context)!;
    try {
      _heroWasSpaceLocked = true;
      final result = await spacesService.setRoleWhite(_roomId, stateRole, value);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        Toast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.whiteChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      Toast.showError(context, message: localizations.action_failed);
      _heroControlStateService.setIdle(LightingConstants.whiteChannelId);
    }
  }

  // --------------------------------------------------------------------------
  // SCENES
  // --------------------------------------------------------------------------

  /// Get lighting scenes for the current room
  List<SceneView> get _lightingScenes {
    if (_scenesService == null) return [];

    // Get scenes for this room with lighting category
    return _scenesService!
        .getScenesForSpace(_roomId)
        .where((s) => s.category == ScenesModuleDataSceneCategory.lighting)
        .toList();
  }

  Future<void> _activateScene(SceneView scene) async {
    if (_isSceneTriggering) return;

    setState(() {
      _isSceneTriggering = true;
      _triggeringSceneId = scene.id;
    });

    try {
      IntentResult? result;

      if (_intentsService != null) {
        result = await _intentsService!.activateScene(scene.id, localizations: AppLocalizations.of(context)!);
      } else if (_scenesService != null) {
        final triggerResult = await _scenesService!.triggerScene(scene.id);
        final partialGroup = triggerResult.composites.any(
          (parent) => parent.status == 'partial',
        );
        final memberDetails = triggerResult.composites
            .expand((parent) => parent.children)
            .where((child) => child.status != 'confirmed')
            .map((child) => '${child.memberIdentity ?? child.memberId}: ${child.status}')
            .join(', ');
        result = triggerResult.success
            ? IntentResult.success(IntentType.activateScene)
            : (triggerResult.successCount > 0 || partialGroup
                ? IntentResult.partialSuccess(
                    IntentType.activateScene,
                    message: memberDetails.isEmpty ? triggerResult.errorMessage : memberDetails,
                  )
                : IntentResult.failure(IntentType.activateScene, message: triggerResult.errorMessage));
      }

      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      if (result == null) return;

      final localizations = AppLocalizations.of(context)!;

      if (result.isSuccess) {
        Toast.showSuccess(
          context,
          message: localizations.space_scene_triggered,
        );
      } else if (result.isPartialSuccess) {
        Toast.showInfo(
          context,
          message: result.message ??
              localizations.space_scene_partial_success,
        );
      } else {
        Toast.showError(
          context,
          message: result.message ?? localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      final localizations = AppLocalizations.of(context)!;
      Toast.showError(
        context,
        message: localizations.action_failed,
      );
    }
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openDeviceDetail(BuildContext context, LightDeviceData light) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          light.deviceId,
          initialChannelId: light.channelId,
        ),
      ),
    );
  }

}

// =============================================================================
// PRIVATE WIDGETS — HERO VALUE
// =============================================================================

/// What the lights hero shows for a light property: the numeral and its
/// unit, a colour swatch, the slider's track and position.
@immutable
class _LightsHeroValue {
  const _LightsHeroValue(this.text, {this.unit, this.swatch});

  final String text;
  final String? unit;
  final Color? swatch;

  static _LightsHeroValue of(
    _LightHeroState state,
    LightHeroCapability? mode,
    AppLocalizations localizations,
  ) {
    if (!state.isOn) return _LightsHeroValue(localizations.light_state_off);

    return switch (mode) {
      null => _LightsHeroValue(localizations.light_state_on),
      LightHeroCapability.brightness => _LightsHeroValue(
        '${state.brightness.round()}',
        unit: ' %',
      ),
      LightHeroCapability.colorTemp => _LightsHeroValue(
        '${state.colorTemp.round()}',
        unit: ' K',
      ),
      LightHeroCapability.hue => _LightsHeroValue(
        '${state.hue.round()}',
        unit: '°',
        swatch: state.currentColor,
      ),
      LightHeroCapability.saturation => _LightsHeroValue(
        '${state.saturation.round()}',
        unit: ' %',
        swatch: state.currentColor,
      ),
      LightHeroCapability.whiteChannel => _LightsHeroValue(
        '${state.whiteChannel.round()}',
        unit: ' %',
      ),
    };
  }

  static String capLabel(LightHeroCapability cap, AppLocalizations l) =>
      switch (cap) {
        LightHeroCapability.brightness => l.light_cap_brightness,
        LightHeroCapability.colorTemp => l.light_cap_color_temp,
        LightHeroCapability.hue => l.light_cap_hue,
        LightHeroCapability.saturation => l.light_cap_saturation,
        LightHeroCapability.whiteChannel => l.light_cap_white,
      };

  /// [value] in the property's unit, for a screen reader.
  static String format(
    LightHeroCapability mode,
    double value,
    AppLocalizations localizations,
  ) => switch (mode) {
    LightHeroCapability.colorTemp => '${value.round()} K',
    LightHeroCapability.hue => '${value.round()}°',
    _ => '${value.round()} %',
  };

  /// The slider's track, thumb ring and position (0–1) for [mode].
  static ({List<Color> track, Color? thumb, double position}) slider(
    _LightHeroState state,
    LightHeroCapability mode,
    bool isDark,
  ) {
    final hueColor = HSVColor.fromAHSV(1, state.hue.clamp(0, 360), 1, 1).toColor();
    final tempRange = state.maxColorTemp - state.minColorTemp;
    final hueRange = state.maxHue - state.minHue;

    return switch (mode) {
      LightHeroCapability.brightness => (
        track: AppHeroTracks.brightness(
          isDark ? Brightness.dark : Brightness.light,
        ),
        thumb: null,
        position: (state.brightness / 100).clamp(0.0, 1.0),
      ),
      LightHeroCapability.colorTemp => (
        track: AppHeroTracks.colorTemperature,
        thumb: null,
        position: tempRange > 0
            ? ((state.colorTemp - state.minColorTemp) / tempRange).clamp(
                0.0,
                1.0,
              )
            : 0.5,
      ),
      LightHeroCapability.hue => (
        track: AppHeroTracks.hue,
        thumb: null,
        position: hueRange > 0
            ? ((state.hue - state.minHue) / hueRange).clamp(0.0, 1.0)
            : 0.0,
      ),
      LightHeroCapability.saturation => (
        track: AppHeroTracks.saturation(hueColor),
        thumb: null,
        position: (state.saturation / 100).clamp(0.0, 1.0),
      ),
      LightHeroCapability.whiteChannel => (
        track: AppHeroTracks.white,
        thumb: null,
        position: (state.whiteChannel / 100).clamp(0.0, 1.0),
      ),
    };
  }

  /// A slider position (0–1) as the property's value.
  static double toActual(
    _LightHeroState state,
    LightHeroCapability mode,
    double v,
  ) => switch (mode) {
    LightHeroCapability.brightness => v * 100,
    LightHeroCapability.colorTemp =>
      state.minColorTemp + (state.maxColorTemp - state.minColorTemp) * v,
    LightHeroCapability.hue => state.minHue + (state.maxHue - state.minHue) * v,
    LightHeroCapability.saturation => v * 100,
    LightHeroCapability.whiteChannel => v * 100,
  };
}
