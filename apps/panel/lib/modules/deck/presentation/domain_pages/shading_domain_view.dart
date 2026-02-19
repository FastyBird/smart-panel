// Shading domain view: room-level control for window coverings in a single space.
//
// **Purpose:** One screen per room showing a hero card for the selected cover role
// (primary, blackout, sheer, outdoor) with position %, slider, and quick actions
// (open / stop / close). A role selector below lets the user switch between roles.
// Mode selector (open, daylight, privacy, closed) and a devices bottom sheet are
// available from the header.
//
// **AI / Tooling:** When editing this file, preserve the rendered UI. Do not
// change widget trees, layout parameters, or visual behavior. Section headers
// (e.g. "// DATA MODELS", "// LIFECYCLE") are stable anchors for navigation.
//
// **Data flow:**
// - [SpacesService] provides covers targets and [CoversStateModel] for the room.
// - [DevicesService] provides [WindowCoveringDeviceView] / [WindowCoveringChannelView]
//   used to build [_CoverRoleData], [_CoverDeviceData], and to open device detail.
// - Optimistic UI: [DomainControlStateService] for mode and hero position;
//   [IntentsRepository] notifies when intents complete so pending state can settle.
//
// **Key concepts:**
// - [_CoverRoleData] = one role's targets and position (role target from backend);
//   [_CoverDeviceData] = one device/channel row for the devices sheet.
// - Role position uses [RoleCoversState] from backend (like lights) — the role
//   target stored by backend. When devices are mixed, we show the role target
//   (e.g. 50%), not the device average (e.g. 62.5%).
// - Hero card shows the selected role's position, slider, and quick actions.
//   Role selector below allows switching roles via [_selectedRole].
// - Portrait: hero card + horizontal role selector. Landscape: hero card on right,
//   vertical role selector on left in [LandscapeViewLayout].
//
// **File structure (for humans and AI):**
// Search for the exact section header (e.g. "// DATA MODELS", "// LIFECYCLE")
// to jump to that part of the file. Sections appear in this order:
//
// - **DATA MODELS** — [_CoverRoleData], [_CoverDeviceData].
// - **SHADING DOMAIN VIEW PAGE** — [ShadingDomainViewPage] and state class:
//   - STATE & DEPENDENCIES: _roomId, [_tryLocator], optional services.
//   - CONVERGENCE CHECKERS: [_checkModeConvergence], [_checkHeroPositionConvergence], [_isSpaceIntentLocked].
//   - ROLE & STATE RESOLUTION: [_getEffectiveRoleFromTargets], [_groupTargetsByRole], [_getRolePosition].
//   - LIFECYCLE: initState (services, listeners, fetch), dispose, [_onDataChanged].
//   - DATA BUILDING: [_buildRoleDataList], [_buildDeviceDataList], role/cover type helpers.
//   - INTENT METHODS: [_setRolePosition], [_stopCovers], [_setCoversMode], [_showActionFailed].
//   - HEADER: [_buildHeader].
//   - LANDSCAPE / PORTRAIT LAYOUT: [_buildLandscapeLayout], [_buildPortraitLayout].
//   - ROLE SELECTOR: [_buildRoleSelector].
//   - MODE SELECTOR: [_getCoversModeOptions], popup content builders.
//   - DEVICES BOTTOM SHEET: [_showShadingDevicesSheet], device tile builders.
//   - NAVIGATION: [_openDeviceDetail].
//   - HELPERS: [_getPositionThemeColor], [_getPositionColorFamily], [_computeTargetsHealth], [_getRoleStatusIcon].
//   - EMPTY STATE: [_buildEmptyState].
// - **PRIVATE WIDGETS** — [_ShadingHeroCard].

import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/covers_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// =============================================================================
// DATA MODELS
// =============================================================================

// View models for the shading domain. [_CoverRoleData] groups targets by role;
// [_CoverDeviceData] is one device/channel row for the devices bottom sheet.

/// Aggregated data for a group of covers with the same role (primary, blackout, etc.).
class _CoverRoleData {
  final CoversTargetRole role;
  final String name;
  final IconData icon;
  final int deviceCount;
  final int averagePosition;
  final List<CoversTargetView> targets;

  const _CoverRoleData({
    required this.role,
    required this.name,
    required this.icon,
    required this.deviceCount,
    required this.averagePosition,
    required this.targets,
  });
}

/// Represents individual cover device data for UI display.
class _CoverDeviceData {
  final String deviceId;
  final String channelId;
  final String name;
  final String typeName;
  final IconData typeIcon;
  final int position;
  final bool isOnline;

  const _CoverDeviceData({
    required this.deviceId,
    required this.channelId,
    required this.name,
    required this.typeName,
    required this.typeIcon,
    required this.position,
    this.isOnline = true,
  });

  bool get isActive => isOnline && position > 0;
}

// =============================================================================
// SHADING DOMAIN VIEW PAGE
// =============================================================================
// Stateful page for one room's shading. State class: holds [DomainControlStateService]
// for mode and hero, optional services, [_selectedRole]; listens to Spaces, Devices,
// Intents.

class ShadingDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const ShadingDomainViewPage({super.key, required this.viewItem});

  @override
  State<ShadingDomainViewPage> createState() => _ShadingDomainViewPageState();
}

class _ShadingDomainViewPageState extends State<ShadingDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  EventBus? _eventBus;
  IntentsRepository? _intentsRepository;
  RoleControlStateRepository? _roleControlStateRepository;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;
  bool _isLoading = true;
  bool _hasError = false;

  CoversTargetRole? _selectedRole;

  Timer? _heroPositionDebounceTimer;

  /// Per-role pending position for landscape tile icon tap optimistic UI.
  final Map<CoversTargetRole, int> _roleTilePendingPositions = {};
  final Map<CoversTargetRole, Timer> _roleTilePendingTimers = {};

  late DomainControlStateService<CoversStateModel> _modeControlStateService;
  late DomainControlStateService<RoleCoversState> _heroControlStateService;

  bool _heroWasSpaceLocked = false;
  bool _modeWasLocked = false;

  /// Tracks whether the user has changed a role position since the last mode
  /// intent. When true, the mode is considered overridden even if the backend
  /// still reports [isModeFromIntent] = true.
  bool _modeOverriddenByManualChange = false;

  /// The [lastAppliedAt] timestamp at the moment [_modeOverriddenByManualChange]
  /// was set. Used to distinguish stale backend state from a genuinely new intent.
  DateTime? _lastAppliedAtWhenOverridden;

  Map<CoversTargetRole, List<CoversTargetView>>? _cachedRoleGroups;
  int _cachedTargetsHash = 0;

  static const List<String> _heroControlChannelIds = [
    ShadingConstants.positionChannelId,
  ];

  final ValueNotifier<int> _sheetNotifier = ValueNotifier<int>(0);

  String get _roomId => widget.viewItem.roomId;

  CoversStateModel? get _coversState => _spacesService?.getCoversState(_roomId);

  List<CoversTargetView> get _coversTargets =>
      _spacesService?.getCoversTargetsForSpace(_roomId) ?? [];

  /// Resolved position for a role: locked/optimistic value or backend average.
  int _getRolePosition(_CoverRoleData roleData, CoversTargetRole? effectiveRole) {
    if (_heroControlStateService.isLocked(ShadingConstants.positionChannelId)) {
      final desired = _heroControlStateService.getDesiredValue(ShadingConstants.positionChannelId);
      if (desired != null && roleData.role == effectiveRole) return desired.round();
    }
    return roleData.averagePosition;
  }

  /// Intent lock checker for [DomainControlStateService]. Targets param unused (space-level lock).
  bool _isSpaceIntentLocked<T>(List<T> _) =>
      _intentsRepository?.isSpaceLocked(_roomId) ?? false;

  // --------------------------------------------------------------------------
  // CONVERGENCE CHECKERS (for DomainControlStateService)
  // --------------------------------------------------------------------------

  bool _checkModeConvergence(
    List<CoversStateModel> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final desiredModeIndex = desiredValue.toInt();
    if (desiredModeIndex < 0 || desiredModeIndex >= CoversMode.values.length) return true;
    final desiredMode = CoversMode.values[desiredModeIndex];
    final backendMode = state.detectedMode;
    if (backendMode == null) return false;
    return backendMode == desiredMode && state.isModeFromIntent;
  }

  bool _checkHeroPositionConvergence(
    List<RoleCoversState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.position == null) return false;
    return (state.position! - desiredValue).abs() <= tolerance;
  }

  // --------------------------------------------------------------------------
  // ROLE & STATE RESOLUTION
  // --------------------------------------------------------------------------

  CoversTargetRole? _getEffectiveRoleFromTargets() {
    if (_selectedRole != null) return _selectedRole;
    final targets = _coversTargets;
    if (targets.isEmpty) return null;
    final groups = _groupTargetsByRole(targets);
    for (final r in CoversTargetRole.values) {
      if (r != CoversTargetRole.hidden && groups.containsKey(r)) return r;
    }
    return null;
  }

  RoleCoversState? _getHeroRoleState() {
    final role = _getEffectiveRoleFromTargets();
    if (role == null) return null;
    final stateRole = _toStateRole(role);
    if (stateRole == null) return null;
    return _coversState?.getRoleState(stateRole);
  }

  String _heroCacheKey(CoversTargetRole role) =>
      RoleControlStateRepository.generateKey(_roomId, 'shading', role.name);

  Map<CoversTargetRole, List<CoversTargetView>> _groupTargetsByRole(List<CoversTargetView> targets) {
    final currentHash = _computeTargetsHash(targets);
    if (_cachedRoleGroups != null && currentHash == _cachedTargetsHash) {
      return _cachedRoleGroups!;
    }
    final result = <CoversTargetRole, List<CoversTargetView>>{};
    for (final target in targets) {
      final role = target.role;
      // Skip targets without a role (not configured) or hidden
      if (role == null || role == CoversTargetRole.hidden) continue;
      result.putIfAbsent(role, () => []).add(target);
    }
    _cachedRoleGroups = result;
    _cachedTargetsHash = currentHash;
    return result;
  }

  int _computeTargetsHash(List<CoversTargetView> targets) {
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
    final intentsRepo = _intentsRepository;
    if (intentsRepo == null) return;

    final isNowLocked = intentsRepo.isSpaceLocked(_roomId);
    final coversState = _coversState;
    final modeTargets = coversState != null ? [coversState] : <CoversStateModel>[];

    if (_modeWasLocked && !isNowLocked) {
      _modeControlStateService.onIntentCompleted(
        ShadingConstants.modeChannelId,
        modeTargets,
      );
    }

    if (_heroWasSpaceLocked && !isNowLocked) {
      final heroRoleState = _getHeroRoleState();
      final heroTargets = heroRoleState != null ? [heroRoleState] : <RoleCoversState>[];
      for (final channelId in _heroControlChannelIds) {
        _heroControlStateService.onIntentCompleted(channelId, heroTargets);
      }
    }

    if (_modeWasLocked) _modeWasLocked = isNowLocked;
    if (_heroWasSpaceLocked) _heroWasSpaceLocked = isNowLocked;
  }

  /// Maps [CoversTargetRole] to [CoversStateRole] for SpacesService API calls.
  CoversStateRole? _toStateRole(CoversTargetRole role) {
    switch (role) {
      case CoversTargetRole.primary:
        return CoversStateRole.primary;
      case CoversTargetRole.blackout:
        return CoversStateRole.blackout;
      case CoversTargetRole.sheer:
        return CoversStateRole.sheer;
      case CoversTargetRole.outdoor:
        return CoversStateRole.outdoor;
      case CoversTargetRole.hidden:
        return CoversStateRole.hidden;
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  // initState: resolve services, add listeners (Spaces, Devices), fetch covers
  // data. dispose: remove listeners.

  /// Resolves optional service from locator; registers listener on success.
  /// Returns null and logs in debug mode if resolution fails.
  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final service = locator<T>();
      onSuccess?.call(service);
      return service;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to get $debugLabel: $e');
      }
      return null;
    }
  }

  @override
  void initState() {
    super.initState();

    _modeControlStateService = DomainControlStateService<CoversStateModel>(
      channelConfigs: {
        ShadingConstants.modeChannelId: ControlChannelConfig(
          id: ShadingConstants.modeChannelId,
          convergenceChecker: _checkModeConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: ShadingConstants.modeSettlingWindowMs,
          tolerance: 0.0,
        ),
      },
    );
    _modeControlStateService.addListener(_onControlStateChanged);

    _heroControlStateService = DomainControlStateService<RoleCoversState>(
      channelConfigs: {
        ShadingConstants.positionChannelId: ControlChannelConfig(
          id: ShadingConstants.positionChannelId,
          convergenceChecker: _checkHeroPositionConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: ShadingConstants.settlingWindowMs,
          tolerance: ShadingConstants.positionTolerance,
        ),
      },
    );
    _heroControlStateService.addListener(_onControlStateChanged);

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _intentsRepository = _tryLocator<IntentsRepository>('IntentsRepository', onSuccess: (s) => s.addListener(_onIntentChanged));
    _eventBus = _tryLocator<EventBus>('EventBus');
    _bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');
    _roleControlStateRepository = _tryLocator<RoleControlStateRepository>('RoleControlStateRepository');

    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    // Defer fetch to after initState so inherited widgets (AppLocalizations,
    // Theme) are accessible when data is already cached and the method runs
    // synchronously through _registerModeConfig.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fetchCoversData();
    });
  }

  Future<void> _fetchCoversData() async {
    try {
      // Check if data is already available (cached) before fetching
      final existingTargets = _coversTargets;
      final existingState = _coversState;

      // Only fetch if data is not already available
      if (existingTargets.isEmpty || existingState == null) {
        // Fetch covers targets and state in parallel
        await Future.wait([
          _spacesService?.fetchCoversTargetsForSpace(_roomId) ?? Future.value(),
          _spacesService?.fetchCoversState(_roomId) ?? Future.value(),
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
        debugPrint('[ShadingDomainView] Failed to fetch covers data: $e');
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
    await _fetchCoversData();
  }

  @override
  void dispose() {
    _heroPositionDebounceTimer?.cancel();
    for (final timer in _roleTilePendingTimers.values) {
      timer.cancel();
    }
    _pageActivatedSubscription?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    _intentsRepository?.removeListener(_onIntentChanged);
    _modeControlStateService.removeListener(_onControlStateChanged);
    _modeControlStateService.dispose();
    _heroControlStateService.removeListener(_onControlStateChanged);
    _heroControlStateService.dispose();
    _sheetNotifier.dispose();
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
      // Refresh covers state so we have latest role targets (e.g. after returning
      // from device detail or when another panel changed covers).
      _spacesService?.fetchCoversState(_roomId);
    }
  }

  void _registerModeConfig({CoversMode? modeOverride}) {
    if (!_isActivePage || _isLoading) return;

    final targets = _coversTargets;
    final hasConfiguredCovers = targets.any((t) =>
        t.role != null && t.role != CoversTargetRole.hidden);
    if (!ShadingConstants.useBackendIntents || !hasConfiguredCovers) {
      _bottomNavModeNotifier?.clear();
      return;
    }

    final localizations = AppLocalizations.of(context)!;
    final modeOptions = _getCoversModeOptions(localizations);
    final (activeValue, matchedValue, lastIntentValue) = _getCoverModeSelectorValues();
    final currentMode = modeOverride ?? activeValue ?? matchedValue ?? lastIntentValue ?? CoversMode.open;

    final currentOption = modeOptions.firstWhere(
      (o) => o.value == currentMode,
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
    final modes = _getCoversModeOptions(localizations);
    final (activeValue, matchedValue, lastIntentValue) = _getCoverModeSelectorValues();
    final isModeLocked = _modeControlStateService.isLocked(ShadingConstants.modeChannelId);

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
              _setCoversMode(mode.value);
              _registerModeConfig(modeOverride: mode.value);
              dismiss();
            },
          ),
      ],
    );
  }

  Widget _buildPopupModeItem(
    BuildContext context, {
    required ModeOption<CoversMode> mode,
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

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      // If backend confirms a new mode intent (lastAppliedAt changed),
      // clear the local manual override flag. We compare timestamps to
      // avoid clearing the flag when the backend still reflects the old
      // intent before manual-change invalidation has propagated.
      if (_modeOverriddenByManualChange &&
          _coversState?.isModeFromIntent == true) {
        final backendAt = _coversState?.lastAppliedAt;
        if (backendAt != null && backendAt != _lastAppliedAtWhenOverridden) {
          _modeOverriddenByManualChange = false;
          _lastAppliedAtWhenOverridden = null;
        }
      }

      final coversState = _coversState;
      if (coversState != null) {
        _modeControlStateService.checkConvergence(
          ShadingConstants.modeChannelId,
          [coversState],
        );
      }

      final heroRoleState = _getHeroRoleState();
      if (heroRoleState != null) {
        final heroTargets = [heroRoleState];
        for (final channelId in _heroControlChannelIds) {
          _heroControlStateService.checkConvergence(channelId, heroTargets);
        }
        _loadHeroCachedValuesIfNeeded(heroRoleState);
        _updateHeroCacheIfSynced(heroRoleState);
      }

      setState(() {});
      _sheetNotifier.value++;
      _registerModeConfig();
    });
    // Ensure a frame is scheduled so the post-frame callback runs promptly
    // (addPostFrameCallback alone does not schedule a frame).
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _loadHeroCachedValuesIfNeeded(RoleCoversState roleState) {
    final effectiveRole = _getEffectiveRoleFromTargets();
    if (effectiveRole == null) return;
    if (!roleState.isPositionMixed) return;

    final cached = _roleControlStateRepository?.get(_heroCacheKey(effectiveRole));
    final position = cached?.position;
    if (position != null &&
        _heroControlStateService.getDesiredValue(ShadingConstants.positionChannelId) == null) {
      _heroControlStateService.setMixed(ShadingConstants.positionChannelId, position);
    }
  }

  void _updateHeroCacheIfSynced(RoleCoversState roleState) {
    final effectiveRole = _getEffectiveRoleFromTargets();
    if (effectiveRole == null) return;
    if (roleState.isPositionMixed) return;

    final pos = roleState.position;
    if (pos != null) {
      _roleControlStateRepository?.updateFromSync(
        _heroCacheKey(effectiveRole),
        position: pos.toDouble(),
      );
    }
  }



  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
        domainName: localizations.domain_shading,
        child: const SizedBox.shrink(),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final targets = _coversTargets;
        final roleDataList = targets.isNotEmpty ? _buildRoleDataList(targets) : <_CoverRoleData>[];

        // No configured roles — show not-configured state with header
        if (roleDataList.isEmpty) {
          return Scaffold(
            backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
            body: SafeArea(
              child: Column(
                children: [
                  PageHeader(
                    title: localizations.domain_shading,
                    subtitle: localizations.domain_not_configured_subtitle,
                    leading: HeaderMainIcon(
                      icon: MdiIcons.blindsHorizontalClosed,
                    ),
                  ),
                  Expanded(
                    child: DomainStateView(
                      state: DomainLoadState.notConfigured,
                      onRetry: _retryLoad,
                      domainName: localizations.domain_shading,
                      notConfiguredIcon: MdiIcons.blindsHorizontalClosed,
                      notConfiguredTitle: localizations.domain_shading_empty_title,
                      notConfiguredDescription: localizations.domain_shading_empty_description,
                      child: const SizedBox.shrink(),
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        final totalDevices = roleDataList.fold<int>(0, (sum, r) => sum + r.deviceCount);

        // Clear stale selection if the role no longer exists in data
        if (_selectedRole != null &&
            !roleDataList.any((r) => r.role == _selectedRole)) {
          _selectedRole = null;
        }

        final effectiveRole = _selectedRole ?? roleDataList.first.role;

        return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, totalDevices, roleDataList, effectiveRole),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  final isLandscape = orientation == Orientation.landscape;
                  return isLandscape
                      ? _buildLandscapeLayout(context, roleDataList, effectiveRole)
                      : _buildPortraitLayout(context, roleDataList, effectiveRole);
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
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(
    BuildContext context,
    int totalDevices,
    List<_CoverRoleData> roleDataList,
    CoversTargetRole effectiveRole,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final roleData = roleDataList.firstWhere(
      (r) => r.role == effectiveRole,
      orElse: () => roleDataList.first,
    );
    final position = _getRolePosition(roleData, effectiveRole);
    final positionColorFamily = _getPositionColorFamily(context, position);

    // Build subtitle: intent-aware mode name or position-based text
    String subtitle;
    final isModeLocked = _modeControlStateService.isLocked(ShadingConstants.modeChannelId);
    final state = _coversState;

    if (isModeLocked) {
      // Optimistic UI: show locked mode name
      final desiredIndex = _modeControlStateService
          .getDesiredValue(ShadingConstants.modeChannelId)
          ?.toInt();
      if (desiredIndex != null &&
          desiredIndex >= 0 &&
          desiredIndex < CoversMode.values.length) {
        final lockedMode = CoversMode.values[desiredIndex];
        subtitle = '${_getCoversModeName(lockedMode, localizations)} \u2022 $totalDevices';
      } else {
        subtitle = '$totalDevices';
      }
    } else if (state != null &&
        state.isModeFromIntent &&
        !_modeOverriddenByManualChange &&
        state.detectedMode != null) {
      // Intent active and matching: show detected mode name
      subtitle = '${_getCoversModeName(state.detectedMode!, localizations)} \u2022 $totalDevices';
    } else if (state?.lastAppliedMode != null) {
      // Intent exists but overridden: show "Custom"
      subtitle = '${localizations.domain_mode_custom} \u2022 $totalDevices';
    } else {
      // No intent ever set: show position-based text
      if (position == 100) {
        subtitle = '${localizations.shading_state_open} \u2022 $totalDevices';
      } else if (position == 0) {
        subtitle = '${localizations.shading_state_closed} \u2022 $totalDevices';
      } else {
        subtitle = '$position% \u2022 $totalDevices';
      }
    }

    final showDevicesButton = totalDevices > 0;

    return PageHeader(
      title: localizations.domain_shading,
      subtitle: subtitle,
      subtitleColor: position > 0 ? positionColorFamily.base : null,
      leading: HeaderMainIcon(
        icon: position > 0 ? MdiIcons.blindsHorizontal : MdiIcons.blindsHorizontalClosed,
        color: _getPositionThemeColor(position),
      ),
      landscapeAction: const DeckModeChip(),
      trailing: showDevicesButton
          ? HeaderIconButton(
              icon: MdiIcons.windowShutterSettings,
              onTap: _showShadingDevicesSheet,
            )
          : null,
    );
  }

  /// Get localized name for covers mode
  String _getCoversModeName(CoversMode mode, AppLocalizations localizations) {
    switch (mode) {
      case CoversMode.open:
        return localizations.covers_mode_open;
      case CoversMode.closed:
        return localizations.covers_mode_closed;
      case CoversMode.privacy:
        return localizations.covers_mode_privacy;
      case CoversMode.daylight:
        return localizations.covers_mode_daylight;
    }
  }

  // --------------------------------------------------------------------------
  // DATA BUILDING
  // --------------------------------------------------------------------------
  // [_buildRoleDataList] groups targets by role and computes average position
  // from DevicesService. [_buildDeviceDataList] builds rows for the devices sheet.

  /// Builds role data list from covers targets (grouped by role).
  ///
  /// Uses [RoleCoversState] from backend for position (role target) when
  /// available — matching lights domain. The backend stores role state (e.g. in
  /// Influx) and propagates via API/WebSocket. When devices are mixed (e.g.
  /// one manually set to 75% while role target is 50%), we show the role target
  /// (50%), not the device average. Fallback to device average when backend
  /// position is null.
  List<_CoverRoleData> _buildRoleDataList(List<CoversTargetView> targets) {
    final grouped = _groupTargetsByRole(targets);
    final coversState = _coversState;
    final List<_CoverRoleData> roles = [];

    for (final role in CoversTargetRole.values) {
      if (role == CoversTargetRole.hidden) continue;
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      // Prefer backend role target (position) — correct when devices are mixed.
      final stateRole = _toStateRole(role);
      final roleState = stateRole != null ? coversState?.getRoleState(stateRole) : null;

      int position;
      if (roleState?.position != null) {
        position = roleState!.position!;
      } else {
        // Fallback: device average when backend has no position yet
        int totalPosition = 0;
        int deviceCount = 0;
        for (final target in roleTargets) {
          final device = _devicesService?.getDevice(target.deviceId);
          if (device is WindowCoveringDeviceView) {
            totalPosition += device.isWindowCoveringPercentage;
            deviceCount++;
          }
        }
        position = deviceCount > 0 ? (totalPosition / deviceCount).round() : 0;
      }

      roles.add(_CoverRoleData(
        role: role,
        name: _getRoleName(role),
        icon: _getRoleIcon(role),
        deviceCount: roleTargets.length,
        averagePosition: position,
        targets: roleTargets,
      ));
    }

    return roles;
  }

  /// Device/channel rows for the devices sheet; multi-channel devices use channel name.
  List<_CoverDeviceData> _buildDeviceDataList(List<CoversTargetView> targets) {
    final List<_CoverDeviceData> devices = [];
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

    // Filter out targets without a role (not configured) or hidden
    final visibleTargets = targets.where((t) => t.role != null && t.role != CoversTargetRole.hidden).toList();

    for (final target in visibleTargets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! WindowCoveringDeviceView) continue;

      final channel = device.channels
          .whereType<WindowCoveringChannelView>()
          .where((c) => c.id == target.channelId)
          .firstOrNull;
      if (channel == null) continue;

      final name = getCoverTargetDisplayName(target, visibleTargets, roomName);

      devices.add(_CoverDeviceData(
        deviceId: target.deviceId,
        channelId: target.channelId,
        name: name,
        typeName: _getCoverTypeName(target.coverType),
        typeIcon: _getCoverTypeIcon(target.coverType),
        position: channel.position,
        isOnline: device.isOnline,
      ));
    }

    return devices;
  }

  /// Localized label for a covers role (primary, blackout, sheer, outdoor).
  String _getRoleName(CoversTargetRole role) {
    final localizations = AppLocalizations.of(context)!;
    switch (role) {
      case CoversTargetRole.primary:
        return localizations.covers_role_primary;
      case CoversTargetRole.blackout:
        return localizations.covers_role_blackout;
      case CoversTargetRole.sheer:
        return localizations.covers_role_sheer;
      case CoversTargetRole.outdoor:
        return localizations.covers_role_outdoor;
      case CoversTargetRole.hidden:
        return localizations.covers_role_hidden;
    }
  }

  /// Icon for a covers role.
  IconData _getRoleIcon(CoversTargetRole role) {
    switch (role) {
      case CoversTargetRole.primary:
        return MdiIcons.blindsHorizontal;
      case CoversTargetRole.blackout:
        return MdiIcons.blindsHorizontalClosed;
      case CoversTargetRole.sheer:
        return MdiIcons.curtains;
      case CoversTargetRole.outdoor:
        return MdiIcons.blindsVerticalClosed;
      case CoversTargetRole.hidden:
        return MdiIcons.eyeOff;
    }
  }

  /// Localized cover type name (curtain, blind, roller, etc.).
  String _getCoverTypeName(String? coverType) {
    final localizations = AppLocalizations.of(context)!;
    switch (coverType) {
      case 'curtain':
        return localizations.cover_type_curtain;
      case 'blind':
        return localizations.cover_type_blind;
      case 'roller':
        return localizations.cover_type_roller;
      case 'outdoorBlind':
        return localizations.cover_type_outdoor_blind;
      default:
        return localizations.cover_type_cover;
    }
  }

  /// Icon for cover type.
  IconData _getCoverTypeIcon(String? coverType) {
    switch (coverType) {
      case 'curtain':
        return MdiIcons.curtains;
      case 'blind':
        return MdiIcons.blindsHorizontal;
      case 'roller':
        return MdiIcons.rollerShade;
      case 'outdoorBlind':
        return MdiIcons.blindsVerticalClosed;
      default:
        return MdiIcons.blindsHorizontal;
    }
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
    CoversTargetRole effectiveRole,
  ) {
    final roleData = roleDataList.firstWhere(
      (r) => r.role == effectiveRole,
      orElse: () => roleDataList.first,
    );
    final position = _getRolePosition(roleData, effectiveRole);

    return LandscapeViewLayout(
      mainContentPadding: EdgeInsets.only(
        right: AppSpacings.pMd,
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      mainContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _ShadingHeroCard(
              roleName: roleData.name,
              roleIcon: roleData.icon,
              deviceCount: roleData.deviceCount,
              position: position,
              positionThemeColor: _getPositionThemeColor(position),
              screenService: _screenService,
              statusIcon: _getRoleStatusIcon(roleData),
              onPositionChanged: (value) => _onHeroPositionChanged(roleData.role, (value * 100).round()),
              onOpen: () => _setRolePositionImmediate(roleData.role, 100),
              onStop: _stopCovers,
              onClose: () => _setRolePositionImmediate(roleData.role, 0),
              onShowDevices: () => _showShadingDevicesSheet(role: roleData.role, roleTargets: roleData.targets),
            ),
          ),
        ],
      ),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: roleDataList.length > 1
          ? _buildLandscapeRolesCard(
              context, roleDataList,
              effectiveRole: effectiveRole,
            )
          : null,
    );
  }

  Widget _buildLandscapeRolesCard(
    BuildContext context,
    List<_CoverRoleData> roleDataList, {
    CoversTargetRole? effectiveRole,
  }) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return Column(
      spacing: AppSpacings.pSm,
      children: roleDataList
          .map((roleData) => _buildRoleTileHorizontal(
                context, roleData, tileHeight,
                effectiveRole: effectiveRole,
              ))
          .toList(),
    );
  }

  Widget _buildRoleTileHorizontal(
    BuildContext context,
    _CoverRoleData roleData,
    double height, {
    CoversTargetRole? effectiveRole,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final basePosition = _getRolePosition(roleData, effectiveRole);
    final position = _roleTilePendingPositions[roleData.role] ?? basePosition;
    final positionColor = _getPositionThemeColor(position);

    final valueText = position == 100
        ? localizations.shading_state_open
        : position == 0
            ? localizations.shading_state_closed
            : '$position%';

    return SizedBox(
      height: height,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: roleData.icon,
        name: valueText,
        status: roleData.name,
        iconAccentColor: position > 0 ? positionColor : null,
        isActive: roleData.role == effectiveRole,
        activeColor: positionColor,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        onIconTap: () {
          // Toggle: if position >= 50 → close, if < 50 → open
          final targetPosition = position >= 50 ? 0 : 100;
          _roleTilePendingTimers[roleData.role]?.cancel();
          setState(() {
            _roleTilePendingPositions[roleData.role] = targetPosition;
          });
          _roleTilePendingTimers[roleData.role] = Timer(
            const Duration(milliseconds: ShadingConstants.settlingWindowMs),
            () {
              if (mounted) {
                setState(() {
                  _roleTilePendingPositions.remove(roleData.role);
                });
              }
            },
          );
          if (roleData.role == effectiveRole) {
            _setRolePositionImmediate(roleData.role, targetPosition);
          } else {
            // Non-selected role: skip hero state update to avoid leaking
            _modeOverriddenByManualChange = true;
            _lastAppliedAtWhenOverridden = _coversState?.lastAppliedAt;
            _setRolePosition(roleData.role, targetPosition);
          }
        },
        onTileTap: () {
          _heroControlStateService.clear(ShadingConstants.positionChannelId);
          setState(() {
            _selectedRole = roleData.role;
          });
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
    CoversTargetRole effectiveRole,
  ) {
    final roleData = roleDataList.firstWhere(
      (r) => r.role == effectiveRole,
      orElse: () => roleDataList.first,
    );
    final position = _getRolePosition(roleData, effectiveRole);
    final hasMultipleRoles = roleDataList.length > 1;

    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ShadingHeroCard(
            roleName: roleData.name,
            roleIcon: roleData.icon,
            deviceCount: roleData.deviceCount,
            position: position,
            positionThemeColor: _getPositionThemeColor(position),
            screenService: _screenService,
            isPortrait: true,
            statusIcon: _getRoleStatusIcon(roleData),
            onPositionChanged: (value) => _onHeroPositionChanged(roleData.role, (value * 100).round()),
            onOpen: () => _setRolePositionImmediate(roleData.role, 100),
            onStop: _stopCovers,
            onClose: () => _setRolePositionImmediate(roleData.role, 0),
            onShowDevices: () => _showShadingDevicesSheet(role: roleData.role, roleTargets: roleData.targets),
          ),
          if (hasMultipleRoles) ...[
            AppSpacings.spacingMdVertical,
            _buildRoleSelector(context, roleDataList, effectiveRole: effectiveRole),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // ROLE SELECTOR
  // --------------------------------------------------------------------------

  Widget _buildRoleSelector(
    BuildContext context,
    List<_CoverRoleData> roleDataList, {
    CoversTargetRole? effectiveRole,
  }) {
    final localizations = AppLocalizations.of(context)!;

    // Build status icons for roles with open covers
    final Map<CoversTargetRole, (IconData, Color)> statusIcons = {};
    for (final roleData in roleDataList) {
      final position = _getRolePosition(roleData, effectiveRole);
      if (position > 0) {
        final colorFamily = _getPositionColorFamily(context, position);
        statusIcons[roleData.role] = (Icons.circle, colorFamily.base);
      }
    }

    return ModeSelector<CoversTargetRole>(
      modes: roleDataList.map((roleData) {
        final position = _getRolePosition(roleData, effectiveRole);
        final valueText = position == 100
            ? localizations.shading_state_open
            : position == 0
                ? localizations.shading_state_closed
                : '$position%';

        return ModeOption<CoversTargetRole>(
          value: roleData.role,
          icon: roleData.icon,
          label: roleData.name,
          color: _getPositionThemeColor(position),
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
        _heroControlStateService.clear(ShadingConstants.positionChannelId);
        setState(() {
          _selectedRole = role;
        });
      },
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.top,
      color: ThemeColors.primary,
      statusIcons: statusIcons,
    );
  }

  // --------------------------------------------------------------------------
  // INTENT METHODS
  // --------------------------------------------------------------------------
  // [_setRolePosition], [_stopCovers], [_setCoversMode] call SpacesService;
  // [_showActionFailed] shows toast and optionally clears pending position.

  void _showActionFailed({bool clearHeroPosition = false}) {
    if (!mounted) return;
    final localizations = AppLocalizations.of(context)!;
    AppToast.showError(context, message: localizations.action_failed);
    if (clearHeroPosition) {
      _heroControlStateService.setIdle(ShadingConstants.positionChannelId);
      setState(() {});
    }
  }

  void _onHeroPositionChanged(CoversTargetRole role, int position) {
    _heroControlStateService.setPending(ShadingConstants.positionChannelId, position.toDouble());
    _roleControlStateRepository?.set(_heroCacheKey(role), position: position.toDouble());
    _modeOverriddenByManualChange = true;
    _lastAppliedAtWhenOverridden = _coversState?.lastAppliedAt;
    _heroPositionDebounceTimer?.cancel();
    _heroPositionDebounceTimer = Timer(
      const Duration(milliseconds: ShadingConstants.sliderDebounceMs),
      () => _setRolePosition(role, position),
    );
    setState(() {});
  }

  void _setRolePositionImmediate(CoversTargetRole role, int position) {
    _heroControlStateService.setPending(ShadingConstants.positionChannelId, position.toDouble());
    _roleControlStateRepository?.set(_heroCacheKey(role), position: position.toDouble());
    _modeOverriddenByManualChange = true;
    _lastAppliedAtWhenOverridden = _coversState?.lastAppliedAt;
    _heroPositionDebounceTimer?.cancel();
    _setRolePosition(role, position);
  }

  Future<void> _setRolePosition(CoversTargetRole role, int position) async {
    if (!mounted) return;
    final stateRole = _toStateRole(role);
    if (stateRole == null) return;

    try {
      _heroWasSpaceLocked = true;
      final result = await _spacesService?.setRolePosition(_roomId, stateRole, position);

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
      }

      if (result == null && mounted) {
        _showActionFailed(clearHeroPosition: true);
      }

      _sheetNotifier.value++;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set role position: $e');
      }
      if (mounted) _showActionFailed(clearHeroPosition: true);
    }
  }

  /// Stop all covers movement in the space
  Future<void> _stopCovers() async {
    try {
      final result = await _spacesService?.stopCovers(_roomId);

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
      }

      if (result == null && mounted) _showActionFailed();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to stop covers: $e');
      }
      if (mounted) _showActionFailed();
    }
  }

  Future<void> _setCoversMode(CoversMode mode) async {
    // Guard against concurrent execution
    if (_modeControlStateService.isLocked(ShadingConstants.modeChannelId)) return;

    _modeControlStateService.setPending(
      ShadingConstants.modeChannelId,
      mode.index.toDouble(),
    );
    _modeWasLocked = true;
    _modeOverriddenByManualChange = false;
    _lastAppliedAtWhenOverridden = null;
    setState(() {});

    try {
      final result = await _spacesService?.setCoversMode(_roomId, mode);
      final success = result != null;

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
      }

      if (success && mounted) {
        // If intents repository is not available, manually trigger completion
        // to start the settling process. Otherwise, rely on _onIntentChanged.
        if (_intentsRepository == null) {
          if (kDebugMode) {
            debugPrint(
              '[ShadingDomainView] IntentsRepository unavailable, manually triggering completion for mode',
            );
          }
          final coversState = _coversState;
          final modeTargets = coversState != null
              ? [coversState]
              : <CoversStateModel>[];
          _modeControlStateService.onIntentCompleted(
            ShadingConstants.modeChannelId,
            modeTargets,
          );
          _modeWasLocked = false;
        }
      } else if (!success && mounted) {
        _showActionFailed();
        _modeControlStateService.setIdle(ShadingConstants.modeChannelId);
        _modeWasLocked = false;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set covers mode: $e');
      }
      if (mounted) {
        _showActionFailed();
        _modeControlStateService.setIdle(ShadingConstants.modeChannelId);
        _modeWasLocked = false;
      }
    }
  }

  // --------------------------------------------------------------------------
  // MODE SELECTOR
  // --------------------------------------------------------------------------

  (CoversMode?, CoversMode?, CoversMode?) _getCoverModeSelectorValues() {
    final isLocked = _modeControlStateService.isLocked(ShadingConstants.modeChannelId);
    CoversMode? lockedValue;
    if (isLocked) {
      final desiredIndex = _modeControlStateService
          .getDesiredValue(ShadingConstants.modeChannelId)
          ?.toInt();
      if (desiredIndex != null &&
          desiredIndex >= 0 &&
          desiredIndex < CoversMode.values.length) {
        lockedValue = CoversMode.values[desiredIndex];
      }
    }

    final state = _coversState;

    return computeIntentModeStatus<CoversMode>(
      selectedIntent: state?.lastAppliedMode,
      currentState: state?.detectedMode,
      isCurrentStateFromIntent: (state?.isModeFromIntent ?? false) && !_modeOverriddenByManualChange,
      isLocked: isLocked,
      lockedValue: lockedValue,
    ).toTuple();
  }

  /// Mode options for [ModeSelector] (open, daylight, privacy, closed).
  List<ModeOption<CoversMode>> _getCoversModeOptions(
    AppLocalizations localizations,
  ) {
    return [
      ModeOption(
        value: CoversMode.open,
        icon: MdiIcons.blindsHorizontal,
        label: localizations.covers_mode_open,
        color: ThemeColors.primary,
      ),
      ModeOption(
        value: CoversMode.daylight,
        icon: MdiIcons.weatherSunny,
        label: localizations.covers_mode_daylight,
        color: ThemeColors.warning,
      ),
      ModeOption(
        value: CoversMode.privacy,
        icon: MdiIcons.eyeOff,
        label: localizations.covers_mode_privacy,
        color: ThemeColors.info,
      ),
      ModeOption(
        value: CoversMode.closed,
        icon: MdiIcons.blindsHorizontalClosed,
        label: localizations.covers_mode_closed,
        color: ThemeColors.neutral,
      ),
    ];
  }

  // --------------------------------------------------------------------------
  // DEVICES BOTTOM SHEET
  // --------------------------------------------------------------------------
  // [_showShadingDevicesSheet] opens bottom sheet (portrait) / right drawer
  // (landscape) with device tiles; tap opens detail.

  /// Localized status text for a device (offline / open / closed / %).
  String _getDeviceStatus(_CoverDeviceData device, AppLocalizations localizations) {
    if (!device.isOnline) return localizations.device_status_offline;
    if (device.position == 100) return localizations.shading_state_open;
    if (device.position == 0) return localizations.shading_state_closed;
    return '${device.position}%';
  }

  void _showShadingDevicesSheet({CoversTargetRole? role, List<CoversTargetView>? roleTargets}) {
    final targets = roleTargets ?? _coversTargets;
    final initialDeviceDataList = _buildDeviceDataList(targets);
    if (initialDeviceDataList.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    final sheetTitle = role != null ? _getRoleName(role) : localizations.shading_devices_title;

    final bottomSection = role != null ? _buildDevicesSheetFooter(context, role) : null;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: sheetTitle,
        titleIcon: MdiIcons.windowShutterSettings,
        scrollable: false,
        content: ListenableBuilder(
          listenable: _sheetNotifier,
          builder: (ctx, _) {
            final deviceDataList = _buildDeviceDataList(targets);
            return Column(
              children: [
                Expanded(
                  child: VerticalScrollWithGradient(
                    gradientHeight: AppSpacings.pMd,
                    itemCount: deviceDataList.length,
                    separatorHeight: AppSpacings.pSm,
                    backgroundColor: drawerBgColor,
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pLg,
                      vertical: AppSpacings.pMd,
                    ),
                    itemBuilder: (context, index) =>
                        _buildShadingDeviceTile(context, deviceDataList[index]),
                  ),
                ),
                if (bottomSection != null) bottomSection,
              ],
            );
          },
        ),
      );
    } else {
      DeckItemSheet.showItemSheetWithUpdates(
        context,
        title: sheetTitle,
        icon: MdiIcons.windowShutterSettings,
        rebuildWhen: _sheetNotifier,
        getItemCount: () => _buildDeviceDataList(targets).length,
        itemBuilder: (context, index) {
          final deviceDataList = _buildDeviceDataList(targets);
          return _buildShadingDeviceTile(context, deviceDataList[index]);
        },
        bottomSection: bottomSection,
      );
    }
  }

  /// Footer for the devices sheet: shows "Retry" (offline) or "Sync All"
  /// (mixed positions) button, matching the lighting domain's sheet footer.
  ///
  /// Checks device-level state for offline / position-mixed within this role.
  /// Includes its own top-border so it collapses to [SizedBox.shrink] cleanly.
  Widget _buildDevicesSheetFooter(BuildContext context, CoversTargetRole role) {
    // Null-role targets treated as primary (matching _buildRoleDataList).
    final targets = _coversTargets
        .where((t) => (t.role ?? CoversTargetRole.primary) == role)
        .toList();
    final health = _computeTargetsHealth(targets);
    if (!health.isPositionMixed && !health.hasOffline) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final borderColor =
        isDark ? AppBorderColorDark.darker : AppBorderColorLight.darker;
    final filledTheme = health.hasOffline
        ? (isDark
            ? AppFilledButtonsDarkThemes.warning
            : AppFilledButtonsLightThemes.warning)
        : (isDark
            ? AppFilledButtonsDarkThemes.info
            : AppFilledButtonsLightThemes.info);
    final label = health.hasOffline
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
                // Re-send the current position for this role
                final roleDataList = _buildRoleDataList(_coversTargets);
                final roleData = roleDataList.where((r) => r.role == role).firstOrNull;
                if (roleData != null) {
                  final position = _getRolePosition(roleData, role);
                  _setRolePositionImmediate(role, position);
                }
                Navigator.of(context).pop();
              },
              child: Text(label),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildShadingDeviceTile(
    BuildContext context,
    _CoverDeviceData device,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: device.typeIcon,
        activeIcon: device.typeIcon,
        name: device.name,
        status: _getDeviceStatus(device, localizations),
        isActive: device.isActive,
        isOffline: !device.isOnline,
        showWarningBadge: true,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        activeColor: device.isActive ? _getPositionThemeColor(device.position) : null,
        onTileTap: () {
          Navigator.of(context).pop();
          _openDeviceDetail(context, device);
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openDeviceDetail(BuildContext context, _CoverDeviceData device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          device.deviceId,
          initialChannelId: device.channelId,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HELPERS (THEME, POSITION, ROLE HEALTH)
  // --------------------------------------------------------------------------
  // [_getPositionThemeColor], [_getPositionColorFamily]: position-based theming.
  // [_computeTargetsHealth]: offline/mixed check for footer and status icon.

  /// Theme color for position (success=open, info=closed, warning=partial).
  ThemeColors _getPositionThemeColor(int position) {
    if (position == 100) return ThemeColors.success;
    if (position == 0) return ThemeColors.info;
    return ThemeColors.warning;
  }

  /// Color family for position (header subtitle, role icons).
  ThemeColorFamily _getPositionColorFamily(BuildContext context, int position) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getPositionThemeColor(position));

  /// Computes offline and position-mixed state for a list of targets.
  /// Used by [_getRoleStatusIcon] and [_buildDevicesSheetFooter].
  ({bool hasOffline, bool isPositionMixed}) _computeTargetsHealth(List<CoversTargetView> targets) {
    final devicesService = _devicesService;
    if (devicesService == null) return (hasOffline: false, isPositionMixed: false);

    bool hasOffline = false;
    int? firstPosition;
    bool isPositionMixed = false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is! WindowCoveringDeviceView) continue;

      if (!device.isOnline) {
        hasOffline = true;
        continue;
      }

      final pos = device.isWindowCoveringPercentage;
      if (firstPosition == null) {
        firstPosition = pos;
      } else if ((pos - firstPosition).abs() > 5) {
        isPositionMixed = true;
      }
    }

    return (hasOffline: hasOffline, isPositionMixed: isPositionMixed);
  }

  /// Status icon for a role: offline → alert, mixed positions → tune, synced → settings.
  ///
  /// Matches the lighting domain's hero card status icon pattern.
  IconData _getRoleStatusIcon(_CoverRoleData roleData) {
    final health = _computeTargetsHealth(roleData.targets);
    if (health.hasOffline) return MdiIcons.alert;
    if (health.isPositionMixed) return MdiIcons.tune;
    return MdiIcons.windowShutterSettings;
  }

  // --------------------------------------------------------------------------
}

// =============================================================================
// PRIVATE WIDGETS
// =============================================================================

/// Hero card for the selected shading role. Shows badge row, giant position
/// number, position slider, and quick action buttons (open/stop/close).
class _ShadingHeroCard extends StatelessWidget {
  final String roleName;
  final IconData roleIcon;
  final int deviceCount;
  final int position;
  final ThemeColors positionThemeColor;
  final ScreenService screenService;
  final bool isPortrait;
  final ValueChanged<double> onPositionChanged;
  final VoidCallback onOpen;
  final VoidCallback onStop;
  final VoidCallback onClose;
  final IconData statusIcon;
  final VoidCallback onShowDevices;

  const _ShadingHeroCard({
    required this.roleName,
    required this.roleIcon,
    required this.deviceCount,
    required this.position,
    required this.positionThemeColor,
    required this.screenService,
    this.isPortrait = false,
    required this.statusIcon,
    required this.onPositionChanged,
    required this.onOpen,
    required this.onStop,
    required this.onClose,
    required this.onShowDevices,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = this.screenService;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light, positionThemeColor);
    final localizations = AppLocalizations.of(context)!;

    return HeroCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompactFont = screenService.isPortrait
              ? screenService.isSmallScreen
              : screenService.isSmallScreen || screenService.isMediumScreen;
          final fontSize = isCompactFont
              ? (constraints.maxHeight * 0.25).clamp(AppSpacings.scale(48), AppSpacings.scale(160))
              : (constraints.maxHeight * 0.35).clamp(AppSpacings.scale(48), AppSpacings.scale(160));

          final hidePositionLabel = !isPortrait &&
              (screenService.isSmallScreen || screenService.isMediumScreen);

          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildHeroRow(isDark, colorFamily, fontSize),
              if (!hidePositionLabel) ...[
                AppSpacings.spacingMdVertical,
                Text(
                  position == 100
                      ? localizations.shading_state_open.toUpperCase()
                      : position == 0
                          ? localizations.shading_state_closed.toUpperCase()
                          : localizations.shading_state_partial(position).toUpperCase(),
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                  ),
                ),
              ],
              AppSpacings.spacingMdVertical,
              _buildPositionSlider(isDark, localizations),
              AppSpacings.spacingLgVertical,
              _buildQuickActions(
                context,
                localizations,
                isCompact: isPortrait
                    ? screenService.isSmallScreen
                    : screenService.isSmallScreen ||
                        screenService.isMediumScreen,
              ),
              AppSpacings.spacingLgVertical,
              _buildPresets(isDark, colorFamily, localizations),
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
      spacing: AppSpacings.pSm,
      children: [
        _buildBadge(isDark, colorFamily),
        _buildGiantValue(isDark, fontSize),
      ],
    );
  }

  // ── Badge (split: left = role name, right = device count → sheet) ──

  Widget _buildBadge(bool isDark, ThemeColorFamily colorFamily) {
    final screenService = this.screenService;
    final useBaseFontSize = screenService.isLandscape
        ? screenService.isLargeScreen
        : !screenService.isSmallScreen;
    final fontSize =
        useBaseFontSize ? AppFontSize.base : AppFontSize.small;

    final activeColor = colorFamily.base;
    final activeBg = colorFamily.light9;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Left part: role icon + role name → show devices sheet
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onShowDevices,
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
              spacing: AppSpacings.pSm,
              children: [
                Icon(
                  roleIcon,
                  size: fontSize,
                  color: activeColor,
                ),
                Text(
                  roleName.toUpperCase(),
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
        // Right part: settings icon + count circle → show devices sheet
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onShowDevices,
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
              spacing: AppSpacings.pSm,
              children: [
                Icon(
                  statusIcon,
                  size: fontSize,
                  color: activeColor,
                ),
                Container(
                  width: fontSize,
                  height: fontSize,
                  decoration: BoxDecoration(
                    color: activeColor,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '$deviceCount',
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

  // ── Giant Value (position number with icon at top-right) ──

  Widget _buildGiantValue(bool isDark, double fontSize) {
    final unitFontSize = fontSize * 0.27;
    final textColor =
        isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
    final unitColor =
        isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Text(
          '$position',
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
          child: Text(
            '%',
            style: TextStyle(
              fontSize: unitFontSize,
              fontWeight: FontWeight.w300,
              color: unitColor,
            ),
          ),
        ),
      ],
    );
  }

  // ── Position Slider ──

  Widget _buildPositionSlider(bool isDark, AppLocalizations localizations) {
    final normalizedValue = position / 100.0;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
      ),
      child: SliderWithSteps(
        value: normalizedValue,
        themeColor: ThemeColors.neutral,
        trackGradientColors: [
          isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
          AppColors.white,
        ],
        steps: [
          localizations.shading_state_closed,
          '25%',
          '50%',
          '75%',
          localizations.shading_state_open,
        ],
        onChanged: onPositionChanged,
      ),
    );
  }

  // ── Quick Action Buttons (Open / Stop / Close) ──

  Widget _buildQuickActions(
    BuildContext context,
    AppLocalizations localizations, {
    bool isCompact = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: AppSpacings.pSm,
      children: [
        Expanded(
          child: _buildQuickActionButton(
            isDark,
            label: localizations.shading_action_open,
            icon: MdiIcons.chevronUp,
            isActive: position == 100,
            onTap: onOpen,
            isCompact: isCompact,
          ),
        ),
        Expanded(
          child: _buildQuickActionButton(
            isDark,
            label: localizations.shading_action_stop,
            icon: MdiIcons.stop,
            isActive: false,
            onTap: onStop,
            isCompact: isCompact,
          ),
        ),
        Expanded(
          child: _buildQuickActionButton(
            isDark,
            label: localizations.shading_action_close,
            icon: MdiIcons.chevronDown,
            isActive: position == 0,
            onTap: onClose,
            isCompact: isCompact,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickActionButton(
    bool isDark, {
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
    bool isCompact = false,
  }) {
    final themeData = isActive
        ? ThemeData(
            filledButtonTheme: isDark
                ? AppFilledButtonsDarkThemes.primary
                : AppFilledButtonsLightThemes.primary)
        : ThemeData(
            filledButtonTheme: isDark
                ? AppFilledButtonsDarkThemes.neutral
                : AppFilledButtonsLightThemes.neutral);
    final iconColor = isActive
        ? (isDark
            ? AppFilledButtonsDarkThemes.primaryForegroundColor
            : AppFilledButtonsLightThemes.primaryForegroundColor)
        : (isDark
            ? AppFilledButtonsDarkThemes.neutralForegroundColor
            : AppFilledButtonsLightThemes.neutralForegroundColor);

    return SizedBox(
      width: double.infinity,
      child: Theme(
        data: themeData,
        child: FilledButton.icon(
          onPressed: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          icon: Icon(
            icon,
            size: isCompact ? AppFontSize.small : AppFontSize.base,
            color: iconColor,
          ),
          label: Text(
            label,
            style: TextStyle(
              fontSize: isCompact ? AppFontSize.small : AppFontSize.base,
            ),
          ),
          style: FilledButton.styleFrom(
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? AppSpacings.pSm : AppSpacings.pMd,
              vertical: isCompact ? AppSpacings.pSm : AppSpacings.pMd,
            ),
          ),
        ),
      ),
    );
  }

  // ── Presets ──

  Widget _buildPresets(
      bool isDark, ThemeColorFamily colorFamily, AppLocalizations localizations) {
    final textSecondary =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final surfaceDim =
        isDark ? AppFillColorDark.base : AppFillColorLight.lighter;
    final cardColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.blank;

    final presets = [
      (label: localizations.shading_state_closed, value: 0),
      (label: '10%', value: 10),
      (label: '25%', value: 25),
      (label: '50%', value: 50),
      (label: '75%', value: 75),
      (label: '90%', value: 90),
      (label: localizations.shading_state_open, value: 100),
    ];

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
      child: HorizontalScrollWithGradient(
        height: AppSpacings.scale(20),
        layoutPadding: AppSpacings.pLg,
        itemCount: presets.length,
        separatorWidth: AppSpacings.pMd,
        backgroundColor: cardColor,
        itemBuilder: (context, index) {
          final preset = presets[index];
          final isActive = position == preset.value;

          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onPositionChanged(preset.value / 100.0);
            },
            child: Container(
              width: AppSpacings.scale(62),
              height: AppSpacings.scale(20),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isActive ? colorFamily.light9 : surfaceDim,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
                border: Border.all(
                  color: isActive
                      ? colorFamily.base
                      : (isDark
                          ? AppBorderColorDark.darker
                          : AppBorderColorLight.darker),
                  width: AppSpacings.scale(1),
                ),
              ),
              child: Text(
                preset.label,
                style: TextStyle(
                  fontSize: AppFontSize.extraExtraSmall,
                  fontWeight: FontWeight.w600,
                  color: isActive ? colorFamily.base : textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
