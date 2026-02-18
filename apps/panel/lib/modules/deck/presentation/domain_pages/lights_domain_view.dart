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
//   - HEADER: [_buildHeader], [_getStatusColor], [_getModeName].
//   - SHEETS: [_showOtherLightsSheet], [_showRoleLightsSheet], [_showScenesSheet].
//   - LIGHTING MODE CONTROLS: [_setLightingMode], [_toggleRoleLights], [_toggleLight].
//   - HERO CONTROLS: [_onHeroValueChanged], [_heroSetBrightness], [_heroSetColor], etc.
//   - LAYOUTS: [_buildPortraitLayout], [_buildLandscapeLayout], role selector, scenes.
//   - HELPERS: [_getEffectiveRoleFromTargets], [_getRoleDataForRole].
// - **PRIVATE WIDGETS** — [_HeroGradients], [_LightsHeroCard], [_SceneTile].

import 'dart:async';

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
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/constants.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/lighting/role_mixed_state.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
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
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';

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
  EventBus? _eventBus;
  IntentsRepository? _intentsRepository;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;
  bool _isLoading = true;
  bool _hasError = false;

  /// Currently selected role tab in the ModeSelector.
  LightTargetRole? _selectedRole;

  /// Currently active hero card capability mode.
  LightHeroCapability? _activeHeroMode;

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

    // Fetch light targets for this space
    _fetchLightTargets();

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
      color: currentOption.color ?? ThemeColors.neutral,
      popupBuilder: _buildModePopupContent,
    ));
  }

  Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modes = _getLightingModeOptions(context, localizations);
    final (activeValue, matchedValue, lastIntentValue) = _getLightingModeSelectorValues();
    final isModeLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pSm),
          child: Text(
            localizations.popup_label_mode.toUpperCase(),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: AppSpacings.scale(1),
              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            ),
          ),
        ),
        for (final mode in modes)
          _buildPopupModeItem(
            context,
            mode: mode,
            isActive: activeValue == mode.value,
            isMatched: matchedValue == mode.value,
            isLastIntent: lastIntentValue == mode.value,
            isLocked: isModeLocked,
            onTap: () {
              _setLightingMode(mode.value);
              _registerModeConfig();
              dismiss();
            },
          ),
      ],
    );
  }

  Widget _buildPopupModeItem(
    BuildContext context, {
    required ModeOption<LightingModeUI> mode,
    required bool isActive,
    required bool isMatched,
    required bool isLastIntent,
    required bool isLocked,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      mode.color ?? ThemeColors.neutral,
    );
    final neutralColorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.neutral,
    );

    // Active (check) uses intent color; history uses neutral; sync has no highlight.
    final isHighlighted = isActive || isLastIntent;
    final colorFamily = isLastIntent ? neutralColorFamily : modeColorFamily;
    final defaultIconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final defaultTextColor = isDark ? AppTextColorDark.regular : AppTextColorLight.regular;

    return GestureDetector(
      onTap: isLocked ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pMd,
        ),
        margin: EdgeInsets.only(bottom: AppSpacings.pXs),
        decoration: BoxDecoration(
          color: isHighlighted ? colorFamily.light9 : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          border: isHighlighted
              ? Border.all(color: colorFamily.light7, width: AppSpacings.scale(1))
              : null,
        ),
        child: Row(
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              mode.icon,
              color: isHighlighted ? colorFamily.base : defaultIconColor,
              size: AppSpacings.scale(20),
            ),
            Expanded(
              child: Text(
                mode.label,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: isHighlighted ? FontWeight.w600 : FontWeight.w400,
                  color: isHighlighted ? colorFamily.base : defaultTextColor,
                ),
              ),
            ),
            if (isActive)
              Icon(Icons.check, color: colorFamily.base, size: AppSpacings.scale(16)),
            if (isMatched)
              Icon(Icons.sync, color: modeColorFamily.base, size: AppSpacings.scale(16)),
            if (isLastIntent)
              Icon(Icons.history, color: colorFamily.base, size: AppSpacings.scale(16)),
          ],
        ),
      ),
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
    if (!mounted) return;
    // Use addPostFrameCallback to avoid "setState during build" errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
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
    if (!mounted) return;
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

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    // Handle loading and error states using DomainStateView
    final loadState = _isLoading
        ? DomainLoadState.loading
        : _hasError
            ? DomainLoadState.error
            : DomainLoadState.loaded;

    if (loadState != DomainLoadState.loaded) {
      return DomainStateView(
        state: loadState,
        onRetry: _retryLoad,
        domainName: localizations.domain_lights,
        child: const SizedBox.shrink(),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final lightTargets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];

        // Build role data
        final roleDataList = _buildRoleDataList(lightTargets, devicesService, localizations);
        final definedRoles = roleDataList
            .where((r) =>
                r.role != LightTargetRole.other &&
                r.role != LightTargetRole.hidden)
            .toList();
        final hasOtherLights = roleDataList.any(
          (r) => r.role == LightTargetRole.other && r.targets.isNotEmpty,
        );

        // No configured roles — show not-configured state with header
        if (roleDataList.isEmpty) {
          return Scaffold(
            backgroundColor: Theme.of(context).brightness == Brightness.dark
                ? AppBgColorDark.page
                : AppBgColorLight.page,
            body: SafeArea(
              child: Column(
                children: [
                  PageHeader(
                    title: localizations.domain_lights,
                    subtitle: localizations.domain_not_configured_subtitle,
                    leading: HeaderMainIcon(
                      icon: MdiIcons.lightbulbOutline,
                    ),
                  ),
                  Expanded(
                    child: DomainStateView(
                      state: DomainLoadState.notConfigured,
                      onRetry: _retryLoad,
                      domainName: localizations.domain_lights,
                      notConfiguredIcon: MdiIcons.lightbulbOffOutline,
                      notConfiguredTitle: localizations.domain_lights_empty_title,
                      notConfiguredDescription: localizations.domain_lights_empty_description,
                      child: const SizedBox.shrink(),
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        // Calculate totals
        final totalLights = lightTargets.length;
        final lightsOn = _countLightsOn(lightTargets, devicesService);

        // Auto-select first role and build hero state
        final effectiveRole = _selectedRole ??
            (definedRoles.isNotEmpty ? definedRoles.first.role : null);
        _LightHeroState? heroState;
        if (effectiveRole != null) {
          final selectedRoleData = _getRoleDataForRole(definedRoles, effectiveRole);
          if (selectedRoleData != null) {
            heroState = _buildHeroState(selectedRoleData, devicesService, localizations);
            heroState = _applyHeroOptimisticOverrides(heroState!, localizations);
          }
        }

        return Scaffold(
          backgroundColor: Theme.of(context).brightness == Brightness.dark
              ? AppBgColorDark.page
              : AppBgColorLight.page,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isLandscape =
                    MediaQuery.of(context).orientation == Orientation.landscape;

                // Pre-calculate whether scenes fit inline in landscape
                final hasScenes = _lightingScenes.isNotEmpty;
                bool landscapeScenesInline = true;
                if (isLandscape && hasScenes && definedRoles.isNotEmpty) {
                  final tileHeight =
                      AppSpacings.scale(AppTileHeight.horizontal * 0.85);
                  final headerHeight = 2 * AppSpacings.pMd +
                      AppFontSize.large * 1.4 +
                      AppFontSize.small * 1.4;
                  final columnHeight =
                      constraints.maxHeight - headerHeight - AppSpacings.pMd;
                  final rolesHeight = definedRoles.length * tileHeight +
                      (definedRoles.length > 1
                          ? (definedRoles.length - 1) * AppSpacings.pSm
                          : 0);
                  final remaining =
                      columnHeight - rolesHeight - AppSpacings.pMd;
                  final titleHeight = AppFontSize.base * 1.4;
                  final minScenesHeight = titleHeight +
                      AppSpacings.pMd +
                      2 * tileHeight +
                      AppSpacings.pSm;
                  landscapeScenesInline = remaining >= minScenesHeight;
                }

                final showScenesButton =
                    isLandscape && hasScenes && !landscapeScenesInline;

                return Column(
                  children: [
                    _buildHeader(
                      context, lightsOn, totalLights,
                      hasOtherLights: hasOtherLights,
                      showScenesButton: showScenesButton,
                    ),
                    Expanded(
                      child: isLandscape
                          ? _buildLandscapeLayout(
                              context, definedRoles, localizations,
                              heroState: heroState,
                              effectiveRole: effectiveRole,
                              showScenes: landscapeScenesInline,
                            )
                          : _buildPortraitLayout(
                              context, definedRoles, localizations,
                              heroState: heroState,
                              effectiveRole: effectiveRole,
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // DATA BUILDING
  // --------------------------------------------------------------------------
  // [_buildRoleDataList]: group targets by role, compute onCount/brightness
  // (with optional lookup maps for large lists). [_buildOtherLights],
  // [_countLightsOn], [_getRoleName], [_getRoleIcon]. [_getLightOptimisticOn]
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
    // Group targets by role — skip targets without a role (not configured) or hidden
    final Map<LightTargetRole, List<LightTargetView>> grouped = {};
    for (final target in targets) {
      final role = target.role;
      if (role == null || role == LightTargetRole.other || role == LightTargetRole.hidden) continue;
      grouped.putIfAbsent(role, () => []).add(target);
    }

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

  int _countLightsOn(List<LightTargetView> targets, DevicesService devicesService) {
    int count = 0;
    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.on) count++;
      }
    }
    return count;
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

  /// Single source of theme color for the page based on lights on/off state.
  /// - All on: success; all off: neutral; mixed: warning.
  ThemeColors _getStatusColor(BuildContext context) {
    final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
    final devicesService = context.read<DevicesService>();
    final totalLights = targets.length;
    final lightsOn = _countLightsOn(targets, devicesService);
    if (lightsOn == totalLights && totalLights > 0) return ThemeColors.success;
    if (lightsOn == 0) return ThemeColors.neutral;
    return ThemeColors.warning;
  }

  /// Resolved color family for the current status color and brightness.
  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor(context));

  Widget _buildHeader(
    BuildContext context,
    int lightsOn,
    int totalLights, {
    bool hasOtherLights = false,
    bool showScenesButton = false,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final statusColorFamily = _getStatusColorFamily(context);

    // Build subtitle: intent-aware mode name or lights count
    String subtitle;
    final isModeLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);
    final state = _lightingState;

    if (isModeLocked) {
      // Optimistic UI: show locked mode name
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
        subtitle = localizations.light_header_count_of_total(lightsOn, totalLights);
      }
    } else if (state != null &&
        state.isModeFromIntent &&
        !_modeOverriddenByManualChange &&
        state.detectedMode != null) {
      // Intent active and matching: show detected mode name
      final detectedModeUI = _toLightingModeUI(state.detectedMode);
      if (detectedModeUI != null && detectedModeUI != LightingModeUI.off) {
        final modeName = _getModeName(detectedModeUI, localizations);
        subtitle = localizations.light_header_mode_count(modeName, lightsOn);
      } else {
        subtitle = localizations.light_header_count_of_total(lightsOn, totalLights);
      }
    } else if (state?.lastAppliedMode != null && lightsOn > 0) {
      // Intent exists but overridden and lights are on: show "Custom"
      subtitle = localizations.light_header_mode_count(localizations.domain_mode_custom, lightsOn);
    } else {
      // No intent or all lights off: show count
      subtitle = localizations.light_header_count_of_total(lightsOn, totalLights);
    }

    // Use actual light state for icon, not pending mode
    final hasLightsOn = lightsOn > 0;

    // Build trailing widget(s)
    final List<Widget> trailingWidgets = [
      if (showScenesButton)
        HeaderIconButton(
          icon: MdiIcons.autoFix,
          onTap: _showScenesSheet,
        ),
      if (hasOtherLights)
        HeaderIconButton(
          icon: MdiIcons.lightbulbGroup,
          onTap: _showOtherLightsSheet,
        ),
    ];

    return PageHeader(
      title: localizations.domain_lights,
      subtitle: subtitle,
      subtitleColor: hasLightsOn ? statusColorFamily.base : null,
      leading: HeaderMainIcon(
        icon: hasLightsOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
        color: _getStatusColor(context),
      ),
      landscapeAction: const DeckModeChip(),
      trailing: trailingWidgets.isNotEmpty
          ? Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: trailingWidgets,
            )
          : null,
    );
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

  // --------------------------------------------------------------------------
  // OTHER LIGHTS SHEET / DRAWER
  // --------------------------------------------------------------------------

  void _showOtherLightsSheet() {
    final targets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
    final roleGroups = _groupTargetsByRole(targets);
    final otherTargets = roleGroups[LightTargetRole.other] ?? [];
    if (otherTargets.isEmpty) return;

    final devicesService = _devicesService;
    if (devicesService == null) return;

    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
    final initialLights = _buildOtherLights(otherTargets, devicesService, roomName);
    if (initialLights.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.domain_lights_other,
        titleIcon: MdiIcons.lightbulbOutline,
        scrollable: false,
        content: ListenableBuilder(
          listenable: _roleLightsSheetNotifier,
          builder: (ctx, _) {
            final lights = _buildOtherLights(
              otherTargets,
              devicesService,
              roomName,
            );
            return VerticalScrollWithGradient(
              gradientHeight: AppSpacings.pMd,
              itemCount: lights.length,
              separatorHeight: AppSpacings.pSm,
              backgroundColor: drawerBgColor,
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pLg,
                vertical: AppSpacings.pMd,
              ),
              itemBuilder: (context, index) =>
                  _buildOtherLightTileForSheet(context, lights[index]),
            );
          },
        ),
      );
    } else {
      List<LightDeviceData> cachedLights = initialLights;

      DeckItemSheet.showItemSheetWithUpdates(
        context,
        title: localizations.domain_lights_other,
        icon: MdiIcons.lightbulbOutline,
        rebuildWhen: _roleLightsSheetNotifier,
        getItemCount: () {
          cachedLights = _buildOtherLights(
            otherTargets,
            devicesService,
            roomName,
          );
          return cachedLights.length;
        },
        itemBuilder: (context, index) => _buildOtherLightTileForSheet(
          context,
          cachedLights[index],
        ),
      );
    }
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
        if (mounted && result == null) AppToast.showError(context, message: localizations.action_failed);
        return;
      }

      var result = await spacesService.turnRoleOn(_roomId, stateRole);
      if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      if (!mounted) return;
      if (result == null) {
        AppToast.showError(context, message: localizations.action_failed);
        return;
      }

      final capabilities = state.capabilities;
      if (capabilities.contains(LightHeroCapability.brightness)) {
        result = await spacesService.setRoleBrightness(_roomId, stateRole, state.brightness.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) AppToast.showError(context, message: localizations.action_failed);
      }
      if (capabilities.contains(LightHeroCapability.colorTemp)) {
        result = await spacesService.setRoleColorTemp(_roomId, stateRole, state.colorTemp.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) AppToast.showError(context, message: localizations.action_failed);
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
        if (result == null) AppToast.showError(context, message: localizations.action_failed);
      }
      if (capabilities.contains(LightHeroCapability.whiteChannel)) {
        result = await spacesService.setRoleWhite(_roomId, stateRole, state.whiteChannel.round());
        if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        if (!mounted) return;
        if (result == null) AppToast.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (mounted) AppToast.showError(context, message: localizations.action_failed);
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
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
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
                    gradientHeight: AppSpacings.pMd,
                    itemCount: lights.length,
                    separatorHeight: AppSpacings.pSm,
                    backgroundColor: drawerBgColor,
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pLg,
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
      showAppBottomSheet(
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
                    gradientHeight: AppSpacings.pMd,
                    itemCount: lights.length,
                    separatorHeight: AppSpacings.pSm,
                    backgroundColor: bgColor,
                    shrinkWrap: true,
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pLg,
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
          horizontal: AppSpacings.pLg,
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

  // --------------------------------------------------------------------------
  // ROLE SELECTOR
  // --------------------------------------------------------------------------

  Widget _buildRoleSelector(
    BuildContext context,
    List<LightingRoleData> roles, {
    bool isLandscape = false,
    LightTargetRole? effectiveRole,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final statusColor = _getStatusColor(context);
    final statusColorFamily = _getStatusColorFamily(context);

    // Build status icons for roles with lights on
    final Map<LightTargetRole, (IconData, Color)> statusIcons = {};
    for (final role in roles) {
      final pendingState = _getRolePendingState(role.role);
      final isActive = pendingState ?? role.hasLightsOn;
      if (isActive) {
        statusIcons[role.role] = (Icons.circle, statusColorFamily.base);
      }
    }

    return ModeSelector<LightTargetRole>(
      modes: roles.map((roleData) {
        // Value line: brightness when on, "Off" when all off
        final valueText = roleData.onCount == 0
            ? localizations.light_state_off
            : roleData.brightness != null
                ? '${roleData.brightness}%'
                : localizations.light_state_on;

        return ModeOption<LightTargetRole>(
          value: roleData.role,
          icon: roleData.icon,
          label: roleData.name,
          color: statusColor,
          iconSize: AppSpacings.scale(18),
          labelBuilder: (isSelected, contentColor) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  roleData.name,
                  style: TextStyle(
                    color: contentColor,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    height: 1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  valueText,
                  style: TextStyle(
                    color: contentColor,
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                    height: 1,
                  ),
                  maxLines: 1,
                ),
              ],
            );
          },
        );
      }).toList(),
      selectedValue: effectiveRole,
      onChanged: (role) {
        _resetHeroControlState();
        setState(() {
          _selectedRole = role;
          // Reset hero mode when switching roles
          _activeHeroMode = null;
        });
      },
      orientation: isLandscape
          ? ModeSelectorOrientation.vertical
          : ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.top,
      color: statusColor,
      statusIcons: statusIcons,
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    AppLocalizations localizations, {
    _LightHeroState? heroState,
    LightTargetRole? effectiveRole,
  }) {
    final hasRoles = roles.isNotEmpty;
    final hasScenes = _lightingScenes.isNotEmpty;
    final statusColor = _getStatusColor(context);

    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero card for selected role
          if (heroState != null)
            _LightsHeroCard(
              state: heroState,
              statusColor: statusColor,
              screenService: _screenService,
              isPortrait: true,
              onModeChanged: (mode) {
                setState(() => _activeHeroMode = mode);
              },
              onToggle: effectiveRole != null
                  ? (turnOn) {
                      final roleData = _getRoleDataForRole(roles, effectiveRole);
                      if (roleData != null) _toggleRoleLights(roleData, turnOn);
                    }
                  : null,
              onShowLights: effectiveRole != null
                  ? () {
                      final roleData = _getRoleDataForRole(roles, effectiveRole);
                      if (roleData != null) _showRoleLightsSheet(roleData);
                    }
                  : null,
              onValueChanged: effectiveRole != null
                  ? (mode, value) {
                      _onHeroValueChanged(
                          mode, value, effectiveRole, heroState);
                    }
                  : null,
            ),

          if (hasRoles) ...[
            AppSpacings.spacingMdVertical,
            _buildRoleSelector(context, roles, effectiveRole: effectiveRole),
          ],

          if (hasScenes) ...[
            AppSpacings.spacingMdVertical,
            Expanded(child: _buildPortraitScenesGrid(context)),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    AppLocalizations localizations, {
    _LightHeroState? heroState,
    LightTargetRole? effectiveRole,
    bool showScenes = true,
  }) {
    final hasScenes = showScenes && _lightingScenes.isNotEmpty;

    return LandscapeViewLayout(
      mainContentPadding: EdgeInsets.only(
        right: AppSpacings.pMd,
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      mainContent: _buildLandscapeMainContent(
        context, roles,
        heroState: heroState,
        effectiveRole: effectiveRole,
      ),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: (roles.isNotEmpty || hasScenes)
          ? _buildLandscapeAdditionalColumn(
              context, roles, localizations,
              effectiveRole: effectiveRole,
              showScenes: hasScenes,
            )
          : null,
    );
  }

  Widget _buildLandscapeMainContent(
    BuildContext context,
    List<LightingRoleData> roles, {
    _LightHeroState? heroState,
    LightTargetRole? effectiveRole,
  }) {
    final statusColor = _getStatusColor(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Hero card for selected role
        if (heroState != null)
          Expanded(
            child: _LightsHeroCard(
              state: heroState,
              statusColor: statusColor,
              screenService: _screenService,
              onModeChanged: (mode) {
                setState(() => _activeHeroMode = mode);
              },
              onToggle: effectiveRole != null
                  ? (turnOn) {
                      final roleData = _getRoleDataForRole(roles, effectiveRole);
                      if (roleData != null) _toggleRoleLights(roleData, turnOn);
                    }
                  : null,
              onShowLights: effectiveRole != null
                  ? () {
                      final roleData = _getRoleDataForRole(roles, effectiveRole);
                      if (roleData != null) _showRoleLightsSheet(roleData);
                    }
                  : null,
              onValueChanged: effectiveRole != null
                  ? (mode, value) {
                      _onHeroValueChanged(
                          mode, value, effectiveRole, heroState);
                    }
                  : null,
            ),
          ),

      ],
    );
  }

  Widget _buildLandscapeAdditionalColumn(
    BuildContext context,
    List<LightingRoleData> roles,
    AppLocalizations localizations, {
    LightTargetRole? effectiveRole,
    bool showScenes = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (roles.isNotEmpty)
          _buildLandscapeRolesCard(
            context, roles,
            effectiveRole: effectiveRole,
          ),
        if (showScenes) ...[
          if (roles.isNotEmpty) AppSpacings.spacingMdVertical,
          Expanded(
            child: _buildLandscapeScenesColumn(context, localizations),
          ),
        ],
      ],
    );
  }

  Widget _buildLandscapeRolesCard(
    BuildContext context,
    List<LightingRoleData> roles, {
    LightTargetRole? effectiveRole,
  }) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return Column(
      spacing: AppSpacings.pSm,
      children: roles
          .map((role) => _buildRoleTileHorizontal(
                context, role, tileHeight,
                effectiveRole: effectiveRole,
              ))
          .toList(),
    );
  }

  Widget _buildRoleTileHorizontal(
    BuildContext context,
    LightingRoleData roleData,
    double height, {
    LightTargetRole? effectiveRole,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final statusColor = _getStatusColor(context);

    final pendingState = _getRolePendingState(roleData.role);
    final tilePending = _roleTilePendingOnStates[roleData.role];
    final isOn = tilePending ?? pendingState ?? roleData.hasLightsOn;

    final valueText = (tilePending != null)
        ? (tilePending
            ? localizations.light_state_on
            : localizations.light_state_off)
        : roleData.onCount == 0
            ? localizations.light_state_off
            : roleData.brightness != null
                ? '${roleData.brightness}%'
                : localizations.light_state_on;

    return SizedBox(
      height: height,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: roleData.icon,
        name: valueText,
        status: roleData.name,
        iconAccentColor: isOn ? statusColor : null,
        isActive: roleData.role == effectiveRole,
        activeColor: statusColor,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onIconTap: () {
          final turnOn = !isOn;
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
          _toggleRoleLights(
            roleData, turnOn,
            updateHero: roleData.role == effectiveRole,
          );
        },
        onTileTap: () {
          _resetHeroControlState();
          setState(() {
            _selectedRole = roleData.role;
            _activeHeroMode = null;
          });
        },
      ),
    );
  }

  Widget _buildLandscapeScenesColumn(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    final scenes = _lightingScenes;

    return LayoutBuilder(
      builder: (context, constraints) {
        final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
        final minSpacing = AppSpacings.pSm;
        // Reserve space for SectionTitle + gap below it
        final titleAreaHeight = AppFontSize.small * 1.4 + AppSpacings.pMd;
        final availableHeight = constraints.maxHeight - titleAreaHeight;

        final tileCount = ((availableHeight + minSpacing) /
                (tileHeight + minSpacing))
            .floor()
            .clamp(1, scenes.length);

        final hasOverflow = scenes.length > tileCount;
        final displayCount = hasOverflow ? tileCount : scenes.length;

        return Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(
              title: localizations.space_scenes_title,
              icon: MdiIcons.autoFix,
            ),
            AppSpacings.spacingMdVertical,
            ...List.generate(displayCount, (index) {
              final isLast = index == displayCount - 1;

              if (hasOverflow && isLast) {
                return Padding(
                  padding: EdgeInsets.only(
                    top: index > 0 ? minSpacing : 0,
                  ),
                  child: _buildMoreScenesTileHorizontal(
                    context,
                    scenes.length - (tileCount - 1),
                    tileHeight,
                    localizations,
                  ),
                );
              }

              final scene = scenes[index];

              return Padding(
                padding: EdgeInsets.only(
                  top: index > 0 ? minSpacing : 0,
                ),
                child: SizedBox(
                  height: tileHeight,
                  child: UniversalTile(
                    layout: TileLayout.horizontal,
                    icon: _getSceneIcon(scene),
                    name: scene.name,
                    isActive: false,
                    activeColor: _getStatusColor(context),
                    showGlow: false,
                    showDoubleBorder: false,
                    showInactiveBorder: false,
                    onTileTap: () => _activateScene(scene),
                  ),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  Widget _buildMoreScenesTileHorizontal(
    BuildContext context,
    int overflowCount,
    double height,
    AppLocalizations localizations,
  ) {
    return SizedBox(
      height: height,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.dotsHorizontal,
        name: '+$overflowCount',
        status: localizations.lights_more_scenes,
        isActive: false,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onTileTap: _showScenesSheet,
      ),
    );
  }

  Widget _buildPortraitScenesGrid(BuildContext context) {
    final isSmallScreen = _screenService.isSmallScreen;
    final scenes = _lightingScenes;
    final crossAxisCount = isSmallScreen ? 2 : 3;
    final spacing = AppSpacings.pSm;

    return LayoutBuilder(
      builder: (context, constraints) {
        final availableHeight = constraints.maxHeight;
        final gridWidth = constraints.maxWidth;
        final cellWidth =
            (gridWidth - spacing * (crossAxisCount - 1)) / crossAxisCount;

        final double childAspectRatio;
        if (isSmallScreen) {
          final tileHeight =
              AppSpacings.scale(AppTileHeight.horizontal * 0.85);
          childAspectRatio = cellWidth / tileHeight;
        } else {
          childAspectRatio = 1.2;
        }

        final cellHeight = cellWidth / childAspectRatio;
        final maxRows = ((availableHeight + spacing) / (cellHeight + spacing))
            .floor()
            .clamp(1, 100);
        final maxVisible =
            (maxRows * crossAxisCount).clamp(1, scenes.length);
        final hasOverflow = scenes.length > maxVisible;
        final displayCount = hasOverflow ? maxVisible : scenes.length;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            childAspectRatio: childAspectRatio,
            crossAxisSpacing: spacing,
            mainAxisSpacing: spacing,
          ),
          itemCount: displayCount,
          itemBuilder: (context, index) {
            if (hasOverflow && index == displayCount - 1) {
              return _buildMoreScenesTile(
                context,
                scenes.length - (maxVisible - 1),
              );
            }
            final scene = scenes[index];
            return _SceneTile(
              scene: scene,
              icon: _getSceneIcon(scene),
              onTap: () => _activateScene(scene),
              isVertical: !isSmallScreen,
            );
          },
        );
      },
    );
  }

  Widget _buildMoreScenesTile(BuildContext context, int overflowCount) {
    final localizations = AppLocalizations.of(context)!;
    final isSmallScreen = _screenService.isSmallScreen;
    final compactPadding = isSmallScreen
        ? EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pXs,
          )
        : null;

    return UniversalTile(
      layout: isSmallScreen ? TileLayout.horizontal : TileLayout.vertical,
      icon: MdiIcons.dotsHorizontal,
      name: '+$overflowCount',
      status: localizations.space_scenes_title,
      iconAccentColor: null,
      isActive: false,
      showGlow: false,
      showInactiveBorder: false,
      contentPadding: compactPadding,
      onTileTap: _showScenesSheet,
    );
  }

  void _showScenesSheet() {
    final scenes = _lightingScenes;
    if (scenes.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.space_scenes_title,
        titleIcon: MdiIcons.autoFix,
        scrollable: false,
        content: VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pMd,
          itemCount: scenes.length,
          separatorHeight: AppSpacings.pSm,
          backgroundColor: drawerBgColor,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          itemBuilder: (context, index) => _buildSceneTileForSheet(
            context,
            scenes[index],
          ),
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
        icon: _getSceneIcon(scene),
        name: scene.name,
        isActive: false,
        showGlow: false,
        showWarningBadge: false,
        showInactiveBorder: false,
        onTileTap: () {
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
        AppToast.showError(context, message: localizations.action_failed);
        _modeControlStateService.setIdle(LightingConstants.modeChannelId);
        _modeWasLocked = false; // Reset to prevent inconsistent state
      }
    } catch (e) {
      // Only show error if the mode change intent itself failed
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to set lighting mode: $e');
      }
      if (mounted) {
        AppToast.showError(context, message: localizations.action_failed);
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
    final statusColor = _getStatusColor(context);
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
        AppToast.showError(context, message: localizations.action_failed);
        if (updateHero) {
          _heroControlStateService.setIdle(LightingConstants.onOffChannelId);
          setState(() {
            _heroPendingOnState = null;
          });
        }
      } else if (updateHero) {
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
      AppToast.showError(context, message: localizations.action_failed);
      if (updateHero) {
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
        _heroControlStateService.setPending(
          LightingConstants.brightnessChannelId,
          value,
        );
        _saveHeroToCache(role, brightness: value);
        _heroBrightnessDebounceTimer?.cancel();
        _heroBrightnessDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () => _heroSetBrightness(role, value.round()),
        );
        break;
      case LightHeroCapability.colorTemp:
        _heroControlStateService.setPending(
          LightingConstants.temperatureChannelId,
          value,
        );
        _saveHeroToCache(role, temperature: value);
        _heroTemperatureDebounceTimer?.cancel();
        _heroTemperatureDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () => _heroSetColorTemp(role, value.round()),
        );
        break;
      case LightHeroCapability.hue:
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
          () => _heroSetColorFromState(role),
        );
        break;
      case LightHeroCapability.saturation:
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
          () => _heroSetColorFromState(role),
        );
        break;
      case LightHeroCapability.whiteChannel:
        _heroControlStateService.setPending(
          LightingConstants.whiteChannelId,
          value,
        );
        _saveHeroToCache(role, white: value);
        _heroWhiteDebounceTimer?.cancel();
        _heroWhiteDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () => _heroSetWhite(role, value.round()),
        );
        break;
    }
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
        AppToast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.brightnessChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
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
        AppToast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.temperatureChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
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
        AppToast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.hueChannelId);
        _heroControlStateService.setIdle(LightingConstants.saturationChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
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
        AppToast.showError(context, message: localizations.action_failed);
        _heroControlStateService.setIdle(LightingConstants.whiteChannelId);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
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

  /// Get icon for scene based on its category or name
  IconData _getSceneIcon(SceneView scene) {
    final nameLower = scene.name.toLowerCase();

    // Match common scene names to icons
    if (nameLower.contains('relax')) return MdiIcons.sofaSingleOutline;
    if (nameLower.contains('movie') || nameLower.contains('cinema')) {
      return MdiIcons.movieOpenOutline;
    }
    if (nameLower.contains('bright') || nameLower.contains('day')) {
      return MdiIcons.weatherSunny;
    }
    if (nameLower.contains('night') || nameLower.contains('sleep')) {
      return MdiIcons.weatherNight;
    }
    if (nameLower.contains('read')) return MdiIcons.bookOpenPageVariantOutline;
    if (nameLower.contains('party') || nameLower.contains('color')) {
      return MdiIcons.partyPopper;
    }
    if (nameLower.contains('dinner') || nameLower.contains('romantic')) {
      return MdiIcons.candle;
    }
    if (nameLower.contains('work') || nameLower.contains('focus')) {
      return MdiIcons.deskLamp;
    }
    if (nameLower.contains('morning') || nameLower.contains('wake')) {
      return MdiIcons.weatherSunsetUp;
    }
    if (nameLower.contains('evening') || nameLower.contains('sunset')) {
      return MdiIcons.weatherSunsetDown;
    }

    // Default icon for lighting scenes
    return MdiIcons.lightbulbGroup;
  }

  Future<void> _activateScene(SceneView scene) async {
    await _scenesService?.triggerScene(scene.id);
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
// PRIVATE WIDGETS — HERO GRADIENT DEFINITIONS
// =============================================================================

class _HeroGradients {
  _HeroGradients._();

  /// Brightness: dark fill → white (matches _BrightnessPanel).
  static List<Color> brightness(bool isDark) => [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ];

  /// Color temperature: warm orange → ivory → cool blue (matches _ColorTempPanel).
  static const colorTemp = [
    Color(0xFFFF9800),
    Color(0xFFFFFAF0),
    Color(0xFFE3F2FD),
    Color(0xFF64B5F6),
  ];

  /// Hue: full spectrum rainbow (standard hue wheel: 0°=red → 360°=red).
  static const hue = [
    Color(0xFFFF0000),
    Color(0xFFFFFF00),
    Color(0xFF00FF00),
    Color(0xFF00FFFF),
    Color(0xFF0000FF),
    Color(0xFFFF00FF),
    Color(0xFFFF0000),
  ];

  /// Saturation: white → current hue color (matches _ColorPanel sat slider).
  static List<Color> saturation(Color hueColor) => [
        AppColors.white,
        hueColor,
      ];

  /// White channel: dark fill → white (matches _WhitePanel).
  static List<Color> whiteChannel(bool isDark) => [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ];
}

// =============================================================================
// PRIVATE WIDGETS — LIGHTS HERO CARD
// =============================================================================
// Hero display for a selected light role. Shows value display, capability
// mode switcher, gradient slider track with thumb, presets, and on/off toggle.

class _LightsHeroCard extends StatelessWidget {
  final _LightHeroState state;
  final ThemeColors statusColor;
  final ScreenService screenService;
  final bool isPortrait;
  final ValueChanged<LightHeroCapability>? onModeChanged;
  final ValueChanged<bool>? onToggle;
  final VoidCallback? onShowLights;
  final void Function(LightHeroCapability mode, double value)? onValueChanged;

  const _LightsHeroCard({
    required this.state,
    required this.statusColor,
    required this.screenService,
    this.isPortrait = false,
    this.onModeChanged,
    this.onToggle,
    this.onShowLights,
    this.onValueChanged,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = this.screenService;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light, statusColor);

    return HeroCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompactFont = screenService.isPortrait
              ? screenService.isSmallScreen
              : screenService.isSmallScreen || screenService.isMediumScreen;
          final fontSize = isCompactFont
              ? (constraints.maxHeight * 0.25).clamp(AppSpacings.scale(48), AppSpacings.scale(160))
              : (constraints.maxHeight * 0.35).clamp(AppSpacings.scale(48), AppSpacings.scale(160));

          final localizations = AppLocalizations.of(context)!;

          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (state.isOnOffOnly) ...[
                _buildOnOffHero(isDark, colorFamily, localizations),
              ] else ...[
                _buildHeroRow(isDark, colorFamily, fontSize),
                if (state.showModeSwitcher) ...[
                  AppSpacings.spacingLgVertical,
                  _buildModeSwitcher(isDark, colorFamily, localizations),
                  AppSpacings.spacingMdVertical,
                ],
                AppSpacings.spacingMdVertical,
                _buildActiveSlider(isDark, colorFamily, localizations),
              ],
            ],
          );
        },
      ),
    );
  }

  // ── Hero Row (badge on left, giant value on right) ───────────

  Widget _buildHeroRow(
    bool isDark,
    ThemeColorFamily colorFamily,
    double fontSize,
  ) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _buildBadge(isDark, colorFamily),
        AppSpacings.spacingSmHorizontal,
        _buildGiantValue(isDark, fontSize),
      ],
    );
  }

  // ── Badge (split: left = power toggle, right = device count → sheet) ──

  Widget _buildBadge(bool isDark, ThemeColorFamily colorFamily) {
    final screenService = this.screenService;
    final useBaseFontSize = screenService.isLandscape
        ? screenService.isLargeScreen
        : !screenService.isSmallScreen;
    final fontSize =
        useBaseFontSize ? AppFontSize.base : AppFontSize.small;

    final onColor = colorFamily.base;
    final offColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final onBg = colorFamily.light9;
    final offBg = isDark ? AppFillColorDark.base : AppFillColorLight.lighter;

    final isOn = state.isOn;
    final activeColor = isOn ? onColor : offColor;
    final activeBg = isOn ? onBg : offBg;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Left part: power icon + role name → toggle
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.mediumImpact();
            onToggle?.call(!isOn);
          },
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pXs,
            ),
            height: AppSpacings.scale(24),
            decoration: BoxDecoration(
              color: activeBg,
              borderRadius: BorderRadius.horizontal(
                left: Radius.circular(AppBorderRadius.round),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  MdiIcons.power,
                  size: fontSize,
                  color: activeColor,
                ),
                AppSpacings.spacingSmHorizontal,
                Text(
                  state.roleName.toUpperCase(),
                  style: TextStyle(
                    fontSize: fontSize,
                    fontWeight: FontWeight.w700,
                    color: activeColor,
                    letterSpacing: AppSpacings.scale(0.3),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Divider between left and right parts
        Container(
          width: AppSpacings.scale(1),
          color: activeColor.withValues(alpha: 0.3),
          height: fontSize + AppSpacings.pXs * 2,
        ),
        // Right part: status icon + count circle → show lights sheet
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onShowLights,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pXs,
            ),
            height: AppSpacings.scale(24),
            decoration: BoxDecoration(
              color: activeBg,
              borderRadius: BorderRadius.horizontal(
                right: Radius.circular(AppBorderRadius.round),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  state.statusIcon,
                  size: fontSize,
                  color: activeColor,
                ),
                AppSpacings.spacingSmHorizontal,
                Container(
                  width: fontSize,
                  height: fontSize,
                  decoration: BoxDecoration(
                    color: activeColor,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${state.deviceCount}',
                    style: TextStyle(
                      fontSize: fontSize * 0.6,
                      fontWeight: FontWeight.w700,
                      color: activeBg,
                      height: 1,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Giant Value (number with unit at top-right, color swatch at bottom-right)

  Widget _buildGiantValue(bool isDark, double fontSize) {
    final unitFontSize = fontSize * 0.27;
    final swatchSize = fontSize * 0.22;

    // Always show brightness; fallback: colorTemp → whiteChannel
    final String value;
    final bool useIcon;
    if (state.capabilities.contains(LightHeroCapability.brightness)) {
      value = state.brightness.round().toString();
      useIcon = true;
    } else if (state.capabilities.contains(LightHeroCapability.colorTemp)) {
      value = state.colorTemp.round().toString();
      useIcon = false;
    } else if (state.capabilities.contains(LightHeroCapability.whiteChannel)) {
      value = state.whiteChannel.round().toString();
      useIcon = true;
    } else {
      value = state.brightness.round().toString();
      useIcon = true;
    }

    final textColor =
        isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
    final unitColor =
        isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

    // Color swatch: show HSV color for hue-capable, colorTemp color for temp-capable
    Color? swatchColor;
    if (state.capabilities.contains(LightHeroCapability.hue)) {
      swatchColor = state.currentColor;
    } else if (state.capabilities.contains(LightHeroCapability.colorTemp)) {
      final tempRange = state.maxColorTemp - state.minColorTemp;
      final t = tempRange > 0
          ? (state.colorTemp - state.minColorTemp) / tempRange
          : 0.5;
      swatchColor = _sampleGradient(_HeroGradients.colorTemp, t);
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w200,
            fontFamily: 'DIN1451',
            color: textColor,
            height: 0.7,
          ),
        ),
        Positioned(
          top: 0,
          right: -unitFontSize,
          child: useIcon
              ? Icon(
                  Icons.wb_sunny_outlined,
                  size: unitFontSize,
                  color: unitColor,
                )
              : Text(
                  'K',
                  style: TextStyle(
                    fontSize: unitFontSize,
                    fontWeight: FontWeight.w300,
                    color: unitColor,
                  ),
                ),
        ),
        if (swatchColor != null)
          Positioned(
            bottom: 0,
            right: -unitFontSize * 1.1,
            child: Container(
              width: swatchSize,
              height: swatchSize,
              decoration: BoxDecoration(
                color: swatchColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
                border: !isDark
                    ? Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      )
                    : null,
              ),
            ),
          ),
      ],
    );
  }

  // ── Mode Switcher (ModeSelector) ──────────────────────────────

  Widget _buildModeSwitcher(bool isDark, ThemeColorFamily colorFamily, AppLocalizations localizations) {
    final caps = state.capabilities.toList();
    caps.sort((a, b) => a.index.compareTo(b.index));

    final isSmallPortrait = isPortrait && screenService.isSmallScreen;

    return ModeSelector<LightHeroCapability>(
      modes: caps.map((cap) => ModeOption<LightHeroCapability>(
        value: cap,
        icon: _capIcon(cap),
        label: _capLabel(cap, localizations),
      )).toList(),
      selectedValue: state.activeMode ?? caps.first,
      onChanged: (cap) => onModeChanged?.call(cap),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: isSmallPortrait
          ? ModeSelectorIconPlacement.left
          : ModeSelectorIconPlacement.top,
      showLabels: isSmallPortrait || !isPortrait ? false : null,
      color: statusColor,
    );
  }

  IconData _capIcon(LightHeroCapability cap) {
    return switch (cap) {
      LightHeroCapability.brightness => Icons.wb_sunny_outlined,
      LightHeroCapability.colorTemp => Icons.thermostat,
      LightHeroCapability.hue => Icons.palette_outlined,
      LightHeroCapability.saturation => Icons.opacity,
      LightHeroCapability.whiteChannel => Icons.square_rounded,
    };
  }

  String _capLabel(LightHeroCapability cap, AppLocalizations l) {
    return switch (cap) {
      LightHeroCapability.brightness => l.light_cap_brightness,
      LightHeroCapability.colorTemp => l.light_cap_color_temp,
      LightHeroCapability.hue => l.light_cap_hue,
      LightHeroCapability.saturation => l.light_cap_saturation,
      LightHeroCapability.whiteChannel => l.light_cap_white,
    };
  }

  // ── Active Slider (SliderWithSteps) ───────────────────────────

  Widget _buildActiveSlider(bool isDark, ThemeColorFamily colorFamily, AppLocalizations localizations) {
    final mode = state.activeMode ??
        (state.capabilities.isNotEmpty
            ? state.capabilities.first
            : LightHeroCapability.brightness);

    final (gradientColors, thumbColor, position, steps) =
        _sliderParams(isDark, colorFamily, mode, localizations);

    return Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
          ),
          child: SliderWithSteps(
            value: position.clamp(0.0, 1.0),
            themeColor: ThemeColors.neutral,
            trackGradientColors: gradientColors,
            thumbBorderColor: thumbColor,
            steps: steps,
            enabled: state.isOn,
            onChanged: state.isOn
                ? (v) {
                    HapticFeedback.selectionClick();
                    onValueChanged?.call(
                        mode, _sliderToActualValue(mode, v));
                  }
                : null,
          ),
        ),
        AppSpacings.spacingMdVertical,
        _buildPresets(isDark, colorFamily, mode, localizations),
      ],
    );
  }

  /// Returns (gradientColors, thumbBorderColor, normalizedValue, stepLabels).
  (List<Color>, Color?, double, List<String>) _sliderParams(
    bool isDark,
    ThemeColorFamily colorFamily,
    LightHeroCapability mode,
    AppLocalizations localizations,
  ) {
    final currentHueColor =
        HSVColor.fromAHSV(1, state.hue.clamp(0, 360), 1, 1).toColor();
    final tempRange = state.maxColorTemp - state.minColorTemp;
    final hueRange = state.maxHue - state.minHue;
    final tempPosition = tempRange > 0
        ? (state.colorTemp - state.minColorTemp) / tempRange
        : 0.5;

    return switch (mode) {
      LightHeroCapability.brightness => (
          _HeroGradients.brightness(isDark),
          null,
          state.brightness / 100,
          ['0%', '25%', '50%', '75%', '100%'],
        ),
      LightHeroCapability.colorTemp => (
          _HeroGradients.colorTemp,
          _sampleGradient(_HeroGradients.colorTemp, tempPosition),
          tempPosition,
          [
            '${state.minColorTemp.round()}K',
            '${((state.minColorTemp + state.maxColorTemp) / 2).round()}K',
            '${state.maxColorTemp.round()}K',
          ],
        ),
      LightHeroCapability.hue => (
          _HeroGradients.hue,
          currentHueColor,
          hueRange > 0 ? (state.hue - state.minHue) / hueRange : 0.0,
          ['0°', '120°', '240°', '359°'],
        ),
      LightHeroCapability.saturation => (
          _HeroGradients.saturation(currentHueColor),
          currentHueColor,
          state.saturation / 100,
          ['0%', '25%', '50%', '75%', '100%'],
        ),
      LightHeroCapability.whiteChannel => (
          _HeroGradients.whiteChannel(isDark),
          null,
          state.whiteChannel / 100,
          [localizations.on_state_off, '25%', '50%', '75%', '100%'],
        ),
    };
  }

  /// Sample a color from a gradient at normalized position [t] (0.0–1.0).
  /// Colors are evenly distributed along the gradient.
  Color _sampleGradient(List<Color> colors, double t) {
    assert(colors.length >= 2);
    t = t.clamp(0.0, 1.0);
    final segments = colors.length - 1;
    final segment = (t * segments).floor().clamp(0, segments - 1);
    final localT = (t * segments - segment).clamp(0.0, 1.0);
    return Color.lerp(colors[segment], colors[segment + 1], localT)!;
  }

  /// Convert a 0.0–1.0 slider position back to the actual domain value.
  double _sliderToActualValue(LightHeroCapability mode, double v) {
    return switch (mode) {
      LightHeroCapability.brightness => v * 100,
      LightHeroCapability.colorTemp =>
        state.minColorTemp + (state.maxColorTemp - state.minColorTemp) * v,
      LightHeroCapability.hue =>
        state.minHue + (state.maxHue - state.minHue) * v,
      LightHeroCapability.saturation => v * 100,
      LightHeroCapability.whiteChannel => v * 100,
    };
  }

  // ── Presets ────────────────────────────────────────────────────

  Widget _buildPresets(
    bool isDark,
    ThemeColorFamily colorFamily,
    LightHeroCapability mode,
    AppLocalizations localizations,
  ) {
    final items = mode == LightHeroCapability.hue
        ? _colorPresetItems(isDark, colorFamily, localizations)
        : _chipPresetItems(isDark, colorFamily, mode, localizations);

    if (items.isEmpty) return const SizedBox.shrink();

    final cardColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.blank;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
      ),
      child: HorizontalScrollWithGradient(
        height: AppSpacings.scale(20),
        layoutPadding: AppSpacings.pLg,
        itemCount: items.length,
        separatorWidth: AppSpacings.pMd,
        backgroundColor: cardColor,
        itemBuilder: (context, index) => items[index],
      ),
    );
  }

  List<SliderPreset> _presetsForMode(LightHeroCapability mode, AppLocalizations localizations) {
    return switch (mode) {
      LightHeroCapability.brightness => [
          SliderPreset(
            label: '10%',
            value: 10,
            isActive: state.brightness.round() == 10,
          ),
          SliderPreset(
            label: '25%',
            value: 25,
            isActive: state.brightness.round() == 25,
          ),
          SliderPreset(
            label: '50%',
            value: 50,
            isActive: state.brightness.round() == 50,
          ),
          SliderPreset(
            label: '75%',
            value: 75,
            isActive: state.brightness.round() == 75,
          ),
          SliderPreset(
            label: '100%',
            value: 100,
            isActive: state.brightness.round() == 100,
          ),
        ],
      LightHeroCapability.colorTemp => [
          SliderPreset(
            label: localizations.light_preset_candle,
            value: 2700,
            isActive: state.colorTemp.round() == 2700,
          ),
          SliderPreset(
            label: localizations.light_preset_warm_white,
            value: 3200,
            isActive: state.colorTemp.round() == 3200,
          ),
          SliderPreset(
            label: localizations.light_preset_neutral,
            value: 4000,
            isActive: state.colorTemp.round() == 4000,
          ),
          SliderPreset(
            label: localizations.light_preset_daylight,
            value: 5000,
            isActive: state.colorTemp.round() == 5000,
          ),
          SliderPreset(
            label: localizations.light_preset_cool_white,
            value: 6500,
            isActive: state.colorTemp.round() == 6500,
          ),
        ],
      LightHeroCapability.saturation => [
          SliderPreset(
            label: '25%',
            value: 25,
            isActive: state.saturation.round() == 25,
          ),
          SliderPreset(
            label: '50%',
            value: 50,
            isActive: state.saturation.round() == 50,
          ),
          SliderPreset(
            label: '75%',
            value: 75,
            isActive: state.saturation.round() == 75,
          ),
          SliderPreset(
            label: '85%',
            value: 85,
            isActive: state.saturation.round() == 85,
          ),
          SliderPreset(
            label: '100%',
            value: 100,
            isActive: state.saturation.round() == 100,
          ),
        ],
      LightHeroCapability.whiteChannel => [
          SliderPreset(
            label: localizations.on_state_off,
            value: 0,
            isActive: state.whiteChannel.round() == 0,
          ),
          SliderPreset(
            label: '25%',
            value: 25,
            isActive: state.whiteChannel.round() == 25,
          ),
          SliderPreset(
            label: '50%',
            value: 50,
            isActive: state.whiteChannel.round() == 50,
          ),
          SliderPreset(
            label: '75%',
            value: 75,
            isActive: state.whiteChannel.round() == 75,
          ),
          SliderPreset(
            label: '100%',
            value: 100,
            isActive: state.whiteChannel.round() == 100,
          ),
        ],
      _ => [],
    };
  }

  List<Widget> _chipPresetItems(
    bool isDark,
    ThemeColorFamily colorFamily,
    LightHeroCapability mode,
    AppLocalizations localizations,
  ) {
    final presets = _presetsForMode(mode, localizations);

    final textSecondary =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final surfaceDim =
        isDark ? AppFillColorDark.base : AppFillColorLight.lighter;

    return presets.map((p) {
      return GestureDetector(
        onTap: state.isOn
            ? () {
                HapticFeedback.selectionClick();
                onValueChanged?.call(mode, p.value);
              }
            : null,
        child: Container(
          width: AppSpacings.scale(62),
          height: AppSpacings.scale(20),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: p.isActive ? colorFamily.light9 : surfaceDim,
            borderRadius: BorderRadius.circular(AppBorderRadius.small),
            border: Border.all(
              color: p.isActive
                  ? colorFamily.base
                  : (isDark ? AppBorderColorDark.darker : AppBorderColorLight.darker),
              width: AppSpacings.scale(1),
            ),
          ),
          child: Text(
            p.label,
            style: TextStyle(
              fontSize: AppFontSize.extraExtraSmall,
              fontWeight: FontWeight.w600,
              color: p.isActive ? colorFamily.base : textSecondary,
            ),
          ),
        ),
      );
    }).toList();
  }

  List<Widget> _colorPresetItems(bool isDark, ThemeColorFamily colorFamily, AppLocalizations localizations) {
    final presets = [
      ColorPreset(
        color: const Color(0xFFE85A4F),
        name: localizations.light_color_red,
        hueValue: 10,
        isActive: state.hue < 15,
      ),
      ColorPreset(
        color: const Color(0xFFFF9800),
        name: localizations.light_color_orange,
        hueValue: 30,
      ),
      ColorPreset(
        color: const Color(0xFFFFEB3B),
        name: localizations.light_color_yellow,
        hueValue: 60,
      ),
      ColorPreset(
        color: const Color(0xFF4CAF50),
        name: localizations.light_color_green,
        hueValue: 120,
      ),
      ColorPreset(
        color: const Color(0xFF42A5F5),
        name: localizations.light_color_blue,
        hueValue: 210,
      ),
      ColorPreset(
        color: const Color(0xFF7B1FA2),
        name: localizations.light_color_purple,
        hueValue: 280,
      ),
      ColorPreset(
        color: const Color(0xFFE91E63),
        name: localizations.light_color_pink,
        hueValue: 340,
      ),
      ColorPreset(
        color: const Color(0xFFFFFAF0),
        name: localizations.light_color_white,
        hueValue: 0,
      ),
    ];

    return presets.map((p) {
      final isLight = p.color.computeLuminance() > 0.85;
      final borderColor =
          isLight && !isDark ? AppBorderColorLight.darker : p.color;

      return GestureDetector(
        onTap: state.isOn
            ? () {
                HapticFeedback.selectionClick();
                onValueChanged?.call(LightHeroCapability.hue, p.hueValue);
              }
            : null,
        child: Container(
          width: AppSpacings.scale(38),
          height: AppSpacings.scale(20),
          decoration: BoxDecoration(
            color: p.color,
            borderRadius: BorderRadius.circular(AppBorderRadius.small),
            border: Border.all(
              color: borderColor,
              width: AppSpacings.scale(1),
            ),
            boxShadow: p.isActive
                ? [
                    BoxShadow(
                      color: p.color.withValues(alpha: 0.6),
                      blurRadius: AppSpacings.scale(8),
                      spreadRadius: AppSpacings.scale(2),
                    ),
                  ]
                : null,
          ),
        ),
      );
    }).toList();
  }

  // ── On/Off Hero (no slider capabilities) ──────────────────────

  Widget _buildOnOffHero(bool isDark, ThemeColorFamily colorFamily, AppLocalizations localizations) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pLg,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              onToggle?.call(!state.isOn);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: AppSpacings.scale(160),
              height: AppSpacings.scale(160),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: state.isOn ? primaryBgColor : inactiveBgColor,
                border: Border.all(
                  color: state.isOn
                      ? primaryColor
                      : (isDark
                          ? AppColors.blank
                          : AppBorderColorLight.darker),
                  width: state.isOn
                      ? AppSpacings.scale(4)
                      : AppSpacings.scale(1),
                ),
                boxShadow: state.isOn
                    ? [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.3),
                          blurRadius: AppSpacings.scale(40),
                          spreadRadius: 0,
                        ),
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: AppSpacings.scale(20),
                          offset: Offset(0, AppSpacings.scale(4)),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: AppSpacings.scale(20),
                          offset: Offset(0, AppSpacings.scale(4)),
                        ),
                      ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    MdiIcons.power,
                    size: AppSpacings.scale(44),
                    color: state.isOn ? primaryColor : inactiveColor,
                  ),
                  Text(
                    state.isOn ? localizations.on_state_on.toUpperCase() : localizations.on_state_off.toUpperCase(),
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w600,
                      color: state.isOn ? primaryColor : inactiveColor,
                      letterSpacing: AppSpacings.scale(1),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Text(
            state.isOn ? localizations.power_hint_tap_to_turn_off : localizations.power_hint_tap_to_turn_on,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: inactiveColor,
            ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// PRIVATE WIDGETS — SCENE TILE
// =============================================================================
// One lighting scene. No active state; tap triggers scene via [ScenesService].

class _SceneTile extends StatelessWidget {
  final SceneView scene;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isVertical;

  const _SceneTile({
    required this.scene,
    required this.icon,
    this.onTap,
    this.isVertical = true,
  });

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: isVertical ? TileLayout.vertical : TileLayout.horizontal,
      icon: icon,
      name: scene.name,
      isActive: false,
      onTileTap: onTap,
      showGlow: false,
      showWarningBadge: false,
      showInactiveBorder: false,
    );
  }
}
