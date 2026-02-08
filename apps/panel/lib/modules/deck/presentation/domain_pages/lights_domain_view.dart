// Lights domain view: room-level lighting control for a single space/room.
//
// **Purpose:** One screen per room showing lighting roles (main, task, ambient,
// accent, night), "other" lights, scenes, and a mode selector (off/work/relax/night).
// Role and device detail are opened via navigation.
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
//   [LightDeviceData]. Channel IDs/settling from [LightingConstants] (constants.dart).
// - **LIGHTS DOMAIN VIEW PAGE** — [LightsDomainViewPage] and state class:
//   - STATE & DEPENDENCIES: _roomId, [_tryLocator], optional services.
//   - DERIVED STATE & CONVERGENCE HELPERS: [_lightingState], [_currentMode],
//     [_checkModeConvergence], [_checkRoleConvergence], [_getRolePendingState].
//   - LIFECYCLE: initState (mode + role control services, listeners, fetch), dispose.
//   - CONTROL STATE & CALLBACKS: [_onDataChanged], [_groupTargetsByRole],
//     [_onIntentChanged].
//   - UTILITIES: [_scale], [_navigateToHome].
//   - BUILD: scaffold, loading/empty/content; [Consumer] for [DevicesService].
//   - DATA BUILDING: [_buildRoleDataList], [_buildOtherLights], counts, role names/icons.
//   - HEADER: [_buildHeader], mode subtitle, status color.
//   - PORTRAIT LAYOUT, LANDSCAPE LAYOUT: roles, scenes, other lights, mode selector.
//   - LIGHTING MODE CONTROLS: [_setLightingMode], [_toggleRoleViaIntent],
//     [_toggleRole], [_toggleLight].
//   - ROLES GRID, LIGHTS GRID, SCENES, NAVIGATION, EMPTY STATE: UI builders.
// - **PRIVATE WIDGETS** — [_RoleCard], [_LightTile], [_SceneTile] (all use [UniversalTile]).

import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/intent_mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/constants.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/light_role_detail_page.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
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

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _scenesService = _tryLocator<ScenesService>('ScenesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _eventBus = _tryLocator<EventBus>('EventBus');
    _intentsRepository = _tryLocator<IntentsRepository>('IntentsRepository', onSuccess: (s) => s.addListener(_onIntentChanged));
    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
    }
    _deviceControlStateService = _tryLocator<DeviceControlStateService>('DeviceControlStateService');
    _bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');

    // Subscribe to page activation events for bottom nav mode registration
    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    // Fetch light targets for this space
    _fetchLightTargets();
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
    _pageActivatedSubscription?.cancel();
    if (_isActivePage) {
      _bottomNavModeNotifier?.clear();
    }
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    _scenesService?.removeListener(_onDataChanged);
    _intentsRepository?.removeListener(_onIntentChanged);
    _modeControlStateService.removeListener(_onControlStateChanged);
    _modeControlStateService.dispose();
    _roleControlStateService.removeListener(_onControlStateChanged);
    _roleControlStateService.dispose();
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
    final hasLights = targets.isNotEmpty;

    if (!LightingConstants.useBackendIntents || !hasLights) {
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
            'MODE',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
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
              dismiss();
              _registerModeConfig();
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
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      mode.color ?? ThemeColors.neutral,
    );

    final isHighlighted = isActive || isMatched || isLastIntent;

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
              color: isHighlighted ? colorFamily.base : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
              size: AppSpacings.scale(20),
            ),
            Expanded(
              child: Text(
                mode.label,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: isHighlighted ? FontWeight.w600 : FontWeight.w400,
                  color: isHighlighted ? colorFamily.base : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
                ),
              ),
            ),
            if (isActive)
              Icon(Icons.check, color: colorFamily.base, size: AppSpacings.scale(16)),
            if (isMatched)
              Icon(Icons.sync, color: colorFamily.base, size: AppSpacings.scale(16)),
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

        setState(() {});

        // Update bottom nav mode config if this is the active page
        _registerModeConfig();
      }
    });
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
      final role = target.role ?? LightTargetRole.other;
      if (role == LightTargetRole.hidden) continue;
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

    // Update tracking state for next iteration
    // Only update _modeWasLocked if a mode change was in progress (it was already true)
    // This prevents incorrectly setting it to true when other intents (like role toggles) lock the space
    if (_modeWasLocked) {
      _modeWasLocked = isNowLocked;
    }
    // Always update _spaceWasLocked to track space lock state
    _spaceWasLocked = isNowLocked;
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------



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

        if (lightTargets.isEmpty) {
          return _buildEmptyState(context);
        }

        // Build role data and other lights
        final roleDataList = _buildRoleDataList(lightTargets, devicesService, localizations);
        final definedRoles = roleDataList
            .where((r) =>
                r.role != LightTargetRole.other &&
                r.role != LightTargetRole.hidden)
            .toList();
        final otherRole = roleDataList.firstWhere(
          (r) => r.role == LightTargetRole.other,
          orElse: () => LightingRoleData(
            role: LightTargetRole.other,
            name: localizations.light_role_other,
            icon: MdiIcons.lightbulbOutline,
            onCount: 0,
            totalCount: 0,
            targets: [],
          ),
        );
        // Calculate totals
        final totalLights = lightTargets.length;
        final lightsOn = _countLightsOn(lightTargets, devicesService);
        final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

        final otherLights = _buildOtherLights(otherRole.targets, devicesService, roomName);

        return Scaffold(
          backgroundColor: Theme.of(context).brightness == Brightness.dark
              ? AppBgColorDark.page
              : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, roomName, lightsOn, totalLights),
                Expanded(
                  child: OrientationBuilder(
                    builder: (context, orientation) {
                      final isLandscape = orientation == Orientation.landscape;
                      return isLandscape
                          ? _buildLandscapeLayout(
                              context, definedRoles, otherLights, otherRole.targets, devicesService, localizations)
                          : _buildPortraitLayout(
                              context, definedRoles, otherLights, otherRole.targets, devicesService, localizations);
                    },
                  ),
                ),
              ],
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
  /// Performance optimization: For large target lists (> [LightingConstants.largeTargetListThreshold]),
  /// pre-builds device and channel lookup maps to avoid repeated service calls and list searches.
  List<LightingRoleData> _buildRoleDataList(
    List<LightTargetView> targets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    // Group targets by role
    final Map<LightTargetRole, List<LightTargetView>> grouped = {};
    for (final target in targets) {
      final role = target.role ?? LightTargetRole.other;
      if (role == LightTargetRole.hidden) continue;
      grouped.putIfAbsent(role, () => []).add(target);
    }

    // Performance optimization: Pre-build device lookup map for large target lists.
    // This avoids repeated hash lookups in DevicesService.getDevice() for each target.
    final bool useLookupMaps = targets.length > LightingConstants.largeTargetListThreshold;
    Map<String, LightingDeviceView>? deviceLookup;
    Map<String, Map<String, LightChannelView>>? channelLookup;

    if (useLookupMaps) {
      deviceLookup = {};
      channelLookup = {};

      // Collect unique device IDs
      final uniqueDeviceIds = targets.map((t) => t.deviceId).toSet();

      for (final deviceId in uniqueDeviceIds) {
        final device = devicesService.getDevice(deviceId);
        if (device is LightingDeviceView) {
          deviceLookup[deviceId] = device;
          // Pre-build channel lookup map for this device
          channelLookup[deviceId] = {
            for (final channel in device.lightChannels) channel.id: channel,
          };
        }
      }
    }

    final List<LightingRoleData> roles = [];
    for (final role in LightTargetRole.values) {
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      int onCount = 0;
      int? avgBrightness;
      int brightnessSum = 0;
      int brightnessCount = 0;

      for (final target in roleTargets) {
        // Use pre-built lookup maps for large lists, otherwise fetch directly
        final LightingDeviceView? device;
        final LightChannelView? channel;

        if (useLookupMaps) {
          device = deviceLookup![target.deviceId];
          if (device != null) {
            channel = channelLookup![target.deviceId]?[target.channelId] ??
                device.lightChannels.firstOrNull;
          } else {
            channel = null;
          }
        } else {
          final rawDevice = devicesService.getDevice(target.deviceId);
          if (rawDevice is LightingDeviceView) {
            device = rawDevice;
            final channels = rawDevice.lightChannels;
            // Use firstOrNull for consistency with optimized path - handles empty channel lists gracefully
            channel = channels.where((c) => c.id == target.channelId).firstOrNull ??
                channels.firstOrNull;
          } else {
            device = null;
            channel = null;
          }
        }

        if (device != null && channel != null && channel.on) {
          onCount++;
          if (channel.hasBrightness) {
            brightnessSum += channel.brightness;
            brightnessCount++;
          }
        }
      }

      if (brightnessCount > 0) {
        avgBrightness = (brightnessSum / brightnessCount).round();
      }

      roles.add(LightingRoleData(
        role: role,
        name: _getRoleName(role, localizations),
        icon: _getRoleIcon(role),
        onCount: onCount,
        totalCount: roleTargets.length,
        brightness: onCount > 0 ? avgBrightness : null,
        targets: roleTargets,
      ));
    }

    return roles;
  }

  bool _getLightOptimisticOn(
    String deviceId,
    String channelId,
    String propertyId,
    bool fallback,
  ) {
    if (_deviceControlStateService != null &&
        _deviceControlStateService!.isLocked(deviceId, channelId, propertyId)) {
      final v = _deviceControlStateService!.getDesiredValue(deviceId, channelId, propertyId);
      if (v is bool) return v;
    }
    if (_intentOverlayService != null &&
        _intentOverlayService!.isLocked(deviceId, channelId, propertyId)) {
      final v = _intentOverlayService!.getOverlayValue(deviceId, channelId, propertyId);
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
    String roomName,
    int lightsOn,
    int totalLights,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final statusColorFamily = _getStatusColorFamily(context);

    // Build subtitle based on mode and lights state
    final mode = _currentMode;
    String subtitle;
    if (mode == LightingModeUI.off || lightsOn == 0) {
      subtitle = '$lightsOn of $totalLights on';
    } else {
      final modeName = _getModeName(mode, localizations);
      subtitle = '$modeName \u2022 $lightsOn on';
    }

    // Use actual light state for icon, not pending mode
    final hasLightsOn = lightsOn > 0;

    return PageHeader(
      title: localizations.domain_lights,
      subtitle: subtitle,
      subtitleColor: hasLightsOn ? statusColorFamily.base : null,
      leading: HeaderMainIcon(
        icon: hasLightsOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
        color: _getStatusColor(context),
      ),
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

  LightingModeUI? _toLightingModeUI(LightingMode? mode) {
    if (mode == null) return null;
    return LightingModeUI.values.firstWhere(
      (m) => m.name == mode.name,
      orElse: () => LightingModeUI.off,
    );
  }

  (LightingModeUI? activeValue, LightingModeUI? matchedValue, LightingModeUI? lastIntentValue)
      _getLightingModeSelectorValues() {
    final mode = _currentMode;
    if (_modeControlStateService.isLocked(LightingConstants.modeChannelId)) {
      return (mode, null, null);
    }
    final detectedMode = _lightingState?.detectedMode;
    final lastAppliedMode = _lightingState?.lastAppliedMode;
    final isModeFromIntent = _lightingState?.isModeFromIntent ?? false;
    final detectedModeUI = _toLightingModeUI(detectedMode);
    final lastAppliedModeUI = _toLightingModeUI(lastAppliedMode);
    if (detectedModeUI != null && isModeFromIntent) return (detectedModeUI, null, null);
    if (detectedModeUI != null && !isModeFromIntent) return (null, detectedModeUI, null);
    if (lastAppliedModeUI != null) return (null, null, lastAppliedModeUI);
    return (mode == LightingModeUI.off ? LightingModeUI.off : null, null, null);
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final hasRoles = roles.isNotEmpty;
    final hasOtherLights = otherLights.isNotEmpty;
    final hasScenes = _lightingScenes.isNotEmpty;

    // Responsive scenes per row based on screen size
    // Small: 3, Medium/Large: 4
    final isSmallScreen = _screenService.isSmallScreen;
    final scenesPerRow = isSmallScreen ? 3 : 4;

    return PortraitViewLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          // Roles Grid
          if (hasRoles)
            _buildRolesGrid(context, roles, devicesService, crossAxisCount: 3),

          // Quick Scenes Section
          if (hasScenes) ...[
            SectionTitle(
                title: localizations.space_scenes_title,
                icon: MdiIcons.autoFix),
            // Use horizontal scroll when other lights present (less vertical space)
            if (hasOtherLights)
              SizedBox(
                height: AppSpacings.scale(70),
                child: _buildPortraitScenesRow(
                  context,
                  tilesPerRow: scenesPerRow,
                ),
              )
            else
              _buildScenesGrid(context, crossAxisCount: scenesPerRow),
          ],

          // Other Lights Section
          if (hasOtherLights) ...[
            _buildOtherLightsTitle(otherLights, otherTargets, localizations),
            _buildLightsGrid(
              context,
              otherLights,
              localizations,
              crossAxisCount: 2,
            ),
          ],
        ],
      ),
      modeSelector: null,
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final hasRoles = roles.isNotEmpty;
    final hasOtherLights = otherLights.isNotEmpty;
    final hasScenes = _lightingScenes.isNotEmpty;
    final hasLights = hasRoles || hasOtherLights;

    // Use ScreenService breakpoints for responsive layout
    // Landscape breakpoints: small ≤800, medium ≤1150, large >1150
    final isLargeScreen = _screenService.isLargeScreen;

    return LandscapeViewLayout(
      mainContent: _buildLandscapeMainContent(
        context,
        roles,
        otherLights,
        otherTargets,
        devicesService,
        localizations,
      ),
      modeSelector: LightingConstants.useBackendIntents && hasLights
          ? _buildLandscapeModeSelector(
              context,
              localizations,
              showLabels: isLargeScreen,
            )
          : null,
      modeSelectorShowLabels: isLargeScreen,
      additionalContent: hasScenes
          ? _buildLandscapeScenesColumn(context, localizations)
          : null,
    );
  }

  Widget _buildLandscapeMainContent(
    BuildContext context,
    List<LightingRoleData> roles,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final hasRoles = roles.isNotEmpty;
    final hasOtherLights = otherLights.isNotEmpty;
    final isLargeScreen = _screenService.isLargeScreen;
    final tilesPerRow = isLargeScreen ? 4 : 3;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        // Roles + Other Lights layout
        if (hasRoles && hasOtherLights) ...[
          // Roles row
          _buildLandscapeRolesRow(
            context,
            roles,
            devicesService,
            tilesPerRow: tilesPerRow,
          ),
          // Other Lights header
          _buildOtherLightsTitle(otherLights, otherTargets, localizations),
          // Other Lights grid
          _buildLandscapeLightsGrid(
            context,
            otherLights,
            localizations,
            tilesPerRow: tilesPerRow,
            maxRows: isLargeScreen ? 2 : 1,
          ),
        ] else if (hasRoles) ...[
          // Only roles, no other lights - grid layout
          Expanded(
            child: _buildRolesGrid(
              context,
              roles,
              devicesService,
              crossAxisCount: tilesPerRow,
            ),
          ),
        ] else if (hasOtherLights) ...[
          // Only other lights, no roles
          _buildOtherLightsTitle(otherLights, otherTargets, localizations),
          _buildLandscapeLightsGrid(
            context,
            otherLights,
            localizations,
            tilesPerRow: tilesPerRow,
            maxRows: isLargeScreen ? 2 : 1,
          ),
        ],
      ],
    );
  }

  Widget _buildLandscapeScenesColumn(
    BuildContext context,
    AppLocalizations localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          title: localizations.space_scenes_title,
          icon: MdiIcons.autoFix,
        ),
        _buildLandscapeScenesCard(context),
      ],
    );
  }

  /// Build scenes card matching the presets pattern from window_covering.dart.
  /// Large screens: 2 vertical tiles per row (square).
  /// Small/medium screens: Column of fixed-height horizontal tiles.
  Widget _buildLandscapeScenesCard(BuildContext context) {
    final isLargeScreen = _screenService.isLargeScreen;
    final scenes = _lightingScenes;

    // Large screens: 2 vertical tiles per row (square)
    if (isLargeScreen) {
      return GridView.count(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacings.pMd,
        crossAxisSpacing: AppSpacings.pMd,
        childAspectRatio: AppTileAspectRatio.square,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: scenes.map((scene) {
          return VerticalTileLarge(
            icon: _getSceneIcon(scene),
            name: scene.name,
            isActive: false,
            activeColor: _getStatusColor(context),
            onTileTap: () => _activateScene(scene),
          );
        }).toList(),
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    return Column(
      children: scenes.asMap().entries.map((entry) {
        final index = entry.key;
        final scene = entry.value;
        final isLast = index == scenes.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: HorizontalTileStretched(
            icon: _getSceneIcon(scene),
            name: scene.name,
            isActive: false,
            activeColor: _getStatusColor(context),
            onTileTap: () => _activateScene(scene),
          ),
        );
      }).toList(),
    );
  }

  /// Build vertical mode selector for landscape layout
  Widget _buildLandscapeModeSelector(
    BuildContext context,
    AppLocalizations localizations, {
    bool showLabels = false,
  }) {
    final (activeValue, matchedValue, lastIntentValue) = _getLightingModeSelectorValues();
    final isModeLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);

    // Fixed width matching landscape layout constants (100 large, 64 compact)
    final selectorWidth = AppSpacings.scale(showLabels ? 100.0 : 64.0);

    return IgnorePointer(
      ignoring: isModeLocked,
      child: IntentModeSelector<LightingModeUI>(
        modes: _getLightingModeOptions(context, localizations),
        activeValue: activeValue,
        matchedValue: matchedValue,
        lastIntentValue: lastIntentValue,
        onChanged: _setLightingMode,
        orientation: ModeSelectorOrientation.vertical,
        iconPlacement: ModeSelectorIconPlacement.top,
        showLabels: showLabels,
        fixedWidth: selectorWidth,
        scrollable: showLabels, // Enable scroll when labels shown (takes more space)
      ),
    );
  }

  Widget _buildLandscapeRolesRow(
    BuildContext context,
    List<LightingRoleData> roles,
    DevicesService devicesService, {
    required int tilesPerRow,
    double aspectRatio = 1.0, // width / height ratio
  }) {
    final isModeLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);

    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile width from available horizontal space
        final totalSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalSpacing) / tilesPerRow;

        // Derive tile height from width using aspect ratio
        final tileHeight = tileWidth / aspectRatio;

        return SizedBox(
          height: tileHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: roles.length,
            separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
            itemBuilder: (context, index) {
              return SizedBox(
                width: tileWidth,
                child: _RoleCard(
                  role: roles[index],
                  onTap: () => _openRoleDetail(context, roles[index]),
                  onIconTap: () => _toggleRoleViaIntent(roles[index]),
                  isLoading: isModeLocked,
                  pendingState: _getRolePendingState(roles[index].role),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildPortraitScenesRow(
    BuildContext context, {
    required int tilesPerRow,
  }) {
    final scenes = _lightingScenes;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile width to fit exactly tilesPerRow tiles
        final totalSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalSpacing) / tilesPerRow;

        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: scenes.length,
          separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
          itemBuilder: (context, index) {
            return SizedBox(
              width: tileWidth,
              child: _SceneTile(
                scene: scenes[index],
                icon: _getSceneIcon(scenes[index]),
                onTap: () => _activateScene(scenes[index]),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLandscapeLightsGrid(
    BuildContext context,
    List<LightDeviceData> lights,
    AppLocalizations localizations, {
    required int tilesPerRow,
    required int maxRows,
    double aspectRatio = 1.0, // width / height ratio
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile width from available horizontal space
        final totalHSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalHSpacing) / tilesPerRow;

        // Derive tile height from width using aspect ratio
        final tileHeight = tileWidth / aspectRatio;

        // Calculate total grid height
        final totalVSpacing = maxRows > 1 ? AppSpacings.pMd * (maxRows - 1) : 0.0;
        final gridHeight = tileHeight * maxRows + totalVSpacing;

        // Build columns of tiles (each column has maxRows tiles stacked)
        final columnCount = (lights.length / maxRows).ceil();

        return SizedBox(
          height: gridHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: columnCount,
            separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
            itemBuilder: (context, colIndex) {
              return SizedBox(
                width: tileWidth,
                child: Column(
                  spacing: AppSpacings.pMd,
                  children: [
                    for (var row = 0; row < maxRows; row++)
                      SizedBox(
                        height: tileHeight,
                        child: Builder(
                          builder: (_) {
                            final index = colIndex * maxRows + row;
                            if (index < lights.length) {
                              return _LightTile(
                                light: lights[index],
                                localizations: localizations,
                                onTap: () => _openDeviceDetail(context, lights[index]),
                                onIconTap: () => _toggleLight(lights[index]),
                                isVertical: true,
                              );
                            }
                            return const SizedBox.shrink();
                          },
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildOtherLightsTitle(
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    AppLocalizations localizations,
  ) {
    final anyOn = otherLights.any((light) => light.isOn);
    final buttonLabel = anyOn
        ? localizations.domain_lights_button_all_off
        : localizations.domain_lights_button_all_on;

    return SectionTitle(
      title: localizations.domain_lights_other,
      icon: MdiIcons.lightbulbOutline,
      trailing: SectionTitleButton(
        label: buttonLabel,
        icon: MdiIcons.power,
        onTap: () => _toggleAllOtherLights(otherTargets, anyOn),
      ),
    );
  }

  /// Toggle all other lights on or off
  Future<void> _toggleAllOtherLights(
    List<LightTargetView> targets,
    bool currentlyAnyOn,
  ) async {
    final targetState = !currentlyAnyOn; // If any on, turn all off; if all off, turn all on

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Only toggle lights that need to change state
      final isOn = channel.on;
      if ((targetState && !isOn) || (!targetState && isOn)) {
        final onPropId = channel.onProp.id;
        await _devicesService?.setPropertyValue(onPropId, targetState);
      }
    }
  }

  // --------------------------------------------------------------------------
  // LIGHTING MODE CONTROLS (BACKEND INTENTS)
  // --------------------------------------------------------------------------
  // [_setLightingMode]: setPending → API (turn off or set mode) → onIntentCompleted
  // when IntentsRepository unlocks. [_toggleRoleViaIntent]: same for role
  // on/off; falls back to [_toggleRole] if no backend intents. [_toggleLight]:
  // direct device control with DeviceControlStateService + IntentOverlay.

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

  /// Toggle role via backend intent.
  ///
  /// Falls back to [_toggleRole] (direct device control) when:
  /// - [LightingConstants.useBackendIntents] is `false`
  /// - The role cannot be mapped to a [LightingStateRole]
  /// - [SpacesService] is not available
  Future<void> _toggleRoleViaIntent(LightingRoleData roleData) async {
    // Guard against concurrent execution:
    // - Block if mode change is pending (mode changes affect all roles)
    // - Block if this specific role toggle is already pending
    // This prevents conflicting intents and ensures UI consistency.
    final roleChannelId = LightingConstants.getRoleChannelId(roleData.role);
    if (_modeControlStateService.isLocked(LightingConstants.modeChannelId)) return;
    if (_roleControlStateService.isLocked(roleChannelId)) return;

    // Check feature flag - fallback to direct device control if disabled
    if (!LightingConstants.useBackendIntents) {
      await _toggleRole(roleData);
      return;
    }

    final localizations = AppLocalizations.of(context)!;
    final spacesService = _spacesService;

    // Map LightTargetRole to LightingStateRole for backend
    final stateRole = mapTargetRoleToStateRole(roleData.role);

    // Fallback to direct device control when:
    // - SpacesService is not available
    // - Role cannot be mapped to a LightingStateRole
    if (spacesService == null || stateRole == null) {
      await _toggleRole(roleData);
      return;
    }

    // Determine the new state (toggle)
    final anyOn = roleData.hasLightsOn;
    final newState = !anyOn;

    // Set optimistic UI state
    _roleControlStateService.setPending(
      roleChannelId,
      newState ? LightingConstants.onValue : LightingConstants.offValue,
    );

    if (kDebugMode) {
      debugPrint('[LightsDomainView] Role toggle: ${roleData.role.name} -> ${newState ? "on" : "off"} (pending)');
    }

    try {
      bool success = false;

      if (anyOn) {
        final result = await spacesService.turnRoleOff(_roomId, stateRole);
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      } else {
        final result = await spacesService.turnRoleOn(_roomId, stateRole);
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
              '[LightsDomainView] IntentsRepository unavailable, manually triggering completion for role ${roleData.role.name}',
            );
          }
          final lightTargets = _spacesService?.getLightTargetsForSpace(_roomId);
          final roleTargets = lightTargets != null && lightTargets.isNotEmpty
              ? _groupTargetsByRole(lightTargets)[roleData.role] ?? []
              : <LightTargetView>[];
          _roleControlStateService.onIntentCompleted(roleChannelId, roleTargets);
        }
        // If intents repository is available, _onIntentChanged will handle completion
      } else if (!success && mounted) {
        AppToast.showError(
          context,
          message: localizations.action_failed,
        );
        // Reset on error
        _roleControlStateService.setIdle(roleChannelId);
      }
    } catch (e) {
      // Only show error if the toggle intent itself failed
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to toggle role: $e');
      }
      if (mounted) {
        AppToast.showError(
          context,
          message: localizations.action_failed,
        );
        // Reset on error
        _roleControlStateService.setIdle(roleChannelId);
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

  /// Toggle all lights in a role
  Future<void> _toggleRole(LightingRoleData roleData) async {
    // If any light is on, turn all off. If all off, turn all on.
    final anyOn = roleData.hasLightsOn;
    final targetState = !anyOn;

    for (final target in roleData.targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Only toggle lights that need to change state
      final isOn = channel.on;
      if ((targetState && !isOn) || (!targetState && isOn)) {
        final onPropId = channel.onProp.id;
        await _devicesService?.setPropertyValue(onPropId, targetState);
      }
    }
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

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

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

  // --------------------------------------------------------------------------
  // ROLES GRID
  // --------------------------------------------------------------------------

  Widget _buildRolesGrid(
    BuildContext context,
    List<LightingRoleData> roles,
    DevicesService devicesService, {
    required int crossAxisCount,
    double aspectRatio = 0.9,
  }) {
    final isModeLocked = _modeControlStateService.isLocked(LightingConstants.modeChannelId);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio,
      ),
      itemCount: roles.length,
      itemBuilder: (context, index) {
        return _RoleCard(
          role: roles[index],
          onTap: () => _openRoleDetail(context, roles[index]),
          onIconTap: () => _toggleRoleViaIntent(roles[index]),
          isLoading: isModeLocked,
          pendingState: _getRolePendingState(roles[index].role),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // LIGHTS GRID
  // --------------------------------------------------------------------------

  /// Builds a grid of light tiles (other lights) using [DeviceTilePortrait].
  Widget _buildLightsGrid(
    BuildContext context,
    List<LightDeviceData> lights,
    AppLocalizations localizations, {
    int crossAxisCount = 2,
  }) {
    // Build device tiles using DeviceTilePortrait wrapper
    final items = lights.map((light) {
      return DeviceTilePortrait(
        icon: MdiIcons.lightbulbOutline,
        activeIcon: MdiIcons.lightbulb,
        name: light.name,
        status: _getLightStatusText(light, localizations),
        isActive: light.isOn,
        isOffline: light.isOffline,
        onTileTap: () => _openDeviceDetail(context, light),
        onIconTap: light.isOffline ? null : () => _toggleLight(light),
      );
    }).toList();

    // Build rows of tiles
    final List<Widget> rows = [];
    for (var i = 0; i < items.length; i += crossAxisCount) {
      final rowItems = <Widget>[];
      for (var j = 0; j < crossAxisCount; j++) {
        final index = i + j;
        if (index < items.length) {
          rowItems.add(Expanded(child: items[index]));
        } else {
          rowItems.add(const Expanded(child: SizedBox()));
        }
        if (j < crossAxisCount - 1) {
          rowItems.add(AppSpacings.spacingMdHorizontal);
        }
      }
      if (rows.isNotEmpty) {
        rows.add(AppSpacings.spacingMdVertical);
      }
      rows.add(Row(children: rowItems));
    }

    return Column(children: rows);
  }

  /// Get localized status text for a light device.
  String _getLightStatusText(LightDeviceData light, AppLocalizations localizations) {
    switch (light.state) {
      case LightState.off:
        return localizations.light_state_off;
      case LightState.on:
        return light.brightness != null
            ? '${light.brightness}%'
            : localizations.light_state_on;
      case LightState.offline:
        return localizations.device_status_offline;
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

  Widget _buildScenesGrid(BuildContext context, {required int crossAxisCount}) {
    final scenes = _lightingScenes;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: 1.0,
      ),
      itemCount: scenes.length,
      itemBuilder: (context, index) {
        return _SceneTile(
          scene: scenes[index],
          icon: _getSceneIcon(scenes[index]),
          onTap: () => _activateScene(scenes[index]),
        );
      },
    );
  }

  Future<void> _activateScene(SceneView scene) async {
    await _scenesService?.triggerScene(scene.id);
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openRoleDetail(BuildContext context, LightingRoleData roleData) {
    if (roleData.targets.length == 1) {
      // Single device - open device detail
      final target = roleData.targets.first;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => DeviceDetailPage(
            target.deviceId,
            initialChannelId: target.channelId,
          ),
        ),
      );
    } else {
      // Multiple devices - open role detail page
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => LightRoleDetailPage(
            role: roleData.role,
            roomId: _roomId,
          ),
        ),
      );
    }
  }

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

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  Widget _buildEmptyState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark
          ? AppBgColorDark.page
          : AppBgColorLight.page,
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingLg,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pMd,
            children: [
              Icon(
                MdiIcons.lightbulbOffOutline,
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                size: AppSpacings.scale(64),
              ),
              Text(
                localizations.domain_lights_empty_title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFontSize.extraLarge,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                ),
              ),
              Text(
                localizations.domain_lights_empty_description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// PRIVATE WIDGETS — ROLE CARD
// =============================================================================
// One role tile (main, task, ambient, etc.). Shows name, on/total count,
// optional brightness; [pendingState] overrides for optimistic UI.

class _RoleCard extends StatelessWidget {
  final LightingRoleData role;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;
  final bool isLoading;
  final bool? pendingState; // Optimistic UI override

  const _RoleCard({
    required this.role,
    this.onTap,
    this.onIconTap,
    this.isLoading = false,
    this.pendingState,
  });

  @override
  Widget build(BuildContext context) {
    // Use pending state if available, otherwise use actual state
    final isActive = pendingState ?? role.hasLightsOn;

    return UniversalTile(
      layout: TileLayout.vertical,
      icon: role.icon,
      name: role.name,
      status: role.statusText,
      isActive: isActive,
      onTileTap: onTap,
      onIconTap: isLoading ? null : onIconTap,
      showWarningBadge: false,
    );
  }
}

// =============================================================================
// PRIVATE WIDGETS — LIGHT TILE
// =============================================================================
// Single light in "other lights" list. Vertical or horizontal [UniversalTile];
// tap opens device detail, icon tap toggles via [_toggleLight].

class _LightTile extends StatelessWidget {
  final LightDeviceData light;
  final AppLocalizations localizations;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;
  final bool isVertical;

  const _LightTile({
    required this.light,
    required this.localizations,
    this.onTap,
    this.onIconTap,
    this.isVertical = false,
  });

  String get _localizedStatusText {
    switch (light.state) {
      case LightState.off:
        return localizations.light_state_off;
      case LightState.on:
        return light.brightness != null
            ? '${light.brightness}%'
            : localizations.light_state_on;
      case LightState.offline:
        return localizations.device_status_offline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: isVertical ? TileLayout.vertical : TileLayout.horizontal,
      icon: MdiIcons.lightbulbOutline,
      activeIcon: MdiIcons.lightbulb,
      name: light.name,
      status: _localizedStatusText,
      isActive: light.isOn,
      isOffline: light.isOffline,
      onTileTap: onTap,
      // Disable icon tap (toggle) when device is offline
      onIconTap: light.isOffline ? null : onIconTap,
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

  const _SceneTile({
    required this.scene,
    required this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: TileLayout.vertical,
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
