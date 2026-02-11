import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/lighting_mode_selector.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/lighting_presets_panel.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/control_ui_state.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Detail page for controlling all lights in a specific role.
///
/// Uses [RoleAggregatedState] from the backend as single source of truth
/// for display values, mixed state detection, and convergence checks.
/// Commands are sent exclusively via backend intents ([SpacesService]).
///
/// ## State Machine
///
/// Uses [DomainControlStateService] to track pending/settling/mixed states for each
/// control channel (brightness, hue, temperature, white, onOff). This provides:
/// - Optimistic UI updates during command execution
/// - Convergence detection when backend state syncs to target values
/// - Mixed state indication when convergence times out
class LightRoleDetailPage extends StatefulWidget {
  final LightTargetRole role;
  final String roomId;

  const LightRoleDetailPage({
    super.key,
    required this.role,
    required this.roomId,
  });

  @override
  State<LightRoleDetailPage> createState() => _LightRoleDetailPageState();
}

class _LightRoleDetailPageState extends State<LightRoleDetailPage> {
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentsRepository? _intentsRepository;
  RoleControlStateRepository? _roleControlStateRepository;

  static const List<String> _controlChannelIds = [
    LightingConstants.brightnessChannelId,
    LightingConstants.hueChannelId,
    LightingConstants.saturationChannelId,
    LightingConstants.temperatureChannelId,
    LightingConstants.whiteChannelId,
    LightingConstants.onOffChannelId,
  ];

  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final s = locator<T>();
      onSuccess?.call(s);
      return s;
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get $debugLabel: $e');
      return null;
    }
  }

  // Domain control state service for optimistic UI (role-level)
  late DomainControlStateService<RoleAggregatedState> _controlStateService;

  // Pending on/off state for optimistic UI
  bool? _pendingOnState;
  Timer? _pendingOnStateClearTimer;

  // Cache key for this role
  String get _cacheKey => RoleControlStateRepository.generateKey(
        widget.roomId,
        'lighting',
        widget.role.name,
      );

  /// Last built channels list; used by the channels bottom sheet so it can
  /// rebuild with current state when [_channelsSheetRebuildNotifier] fires.
  List<LightingChannelData>? _lastChannels;

  /// Bump to rebuild the channels bottom sheet (e.g. after toggling a channel).
  final ValueNotifier<int> _channelsSheetRebuildNotifier = ValueNotifier(0);

  /// Sync-all callback for the channels sheet bottom section (set during build).
  VoidCallback? _onSyncAllCallback;

  // Flag to track if we've loaded cached values
  bool _cacheLoaded = false;

  // Selected capability for mode selector
  LightCapability _selectedCapability = LightCapability.brightness;

  // Current UI snapshot for status color resolution
  LightingState _currentUiState = LightingState.synced;
  bool _currentDisplayIsOn = false;

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _hueDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  /// Track if space intent was locked (for detecting unlock → onIntentCompleted).
  bool _wasSpaceLocked = false;

  @override
  void initState() {
    super.initState();

    // Initialize the control state service with lighting-specific config
    _controlStateService = DomainControlStateService<RoleAggregatedState>(
      channelConfigs: {
        LightingConstants.brightnessChannelId: ControlChannelConfig(
          id: LightingConstants.brightnessChannelId,
          convergenceChecker: _checkBrightnessConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.brightnessTolerance,
        ),
        LightingConstants.hueChannelId: ControlChannelConfig(
          id: LightingConstants.hueChannelId,
          convergenceChecker: _checkHueConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.hueTolerance,
        ),
        LightingConstants.saturationChannelId: ControlChannelConfig(
          id: LightingConstants.saturationChannelId,
          convergenceChecker: _checkSaturationConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.saturationTolerance,
        ),
        LightingConstants.temperatureChannelId: ControlChannelConfig(
          id: LightingConstants.temperatureChannelId,
          convergenceChecker: _checkTemperatureConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.temperatureTolerance,
        ),
        LightingConstants.whiteChannelId: ControlChannelConfig(
          id: LightingConstants.whiteChannelId,
          convergenceChecker: _checkWhiteConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.whiteTolerance,
        ),
        LightingConstants.onOffChannelId: ControlChannelConfig(
          id: LightingConstants.onOffChannelId,
          convergenceChecker: _checkOnOffConvergence,
          intentLockChecker: _isSpaceIntentLocked,
          settlingWindowMs: LightingConstants.onOffSettlingWindowMs,
          tolerance: 0.0,
        ),
      },
    );
    _controlStateService.addListener(_onRoleControlStateChanged);

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onSpacesDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDevicesDataChanged));
    _intentsRepository = _tryLocator<IntentsRepository>('IntentsRepository', onSuccess: (s) => s.addListener(_onIntentChanged));
    _roleControlStateRepository = _tryLocator<RoleControlStateRepository>('RoleControlStateRepository');

    // Load cached values
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCachedValues();
    });
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _hueDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _pendingOnStateClearTimer?.cancel();
    _spacesService?.removeListener(_onSpacesDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentsRepository?.removeListener(_onIntentChanged);
    _controlStateService.removeListener(_onRoleControlStateChanged);
    _controlStateService.dispose();
    super.dispose();
  }

  void _onRoleControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  // ============================================================================
  // Convergence checkers (RoleAggregatedState-based)
  // ============================================================================

  bool _checkBrightnessConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.brightness == null) return false;
    return (state.brightness! - desiredValue).abs() <= tolerance;
  }

  bool _checkHueConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final color = _parseHexColor(state.color);
    if (color == null) return false;
    final hue = HSVColor.fromColor(color).hue;
    return (hue - desiredValue).abs() <= tolerance;
  }

  bool _checkSaturationConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final color = _parseHexColor(state.color);
    if (color == null) return false;
    final saturation = HSVColor.fromColor(color).saturation;
    // desiredValue is in 0.0-1.0, tolerance is in 0-100 scale => convert
    return (saturation * 100.0 - desiredValue * 100.0).abs() <= tolerance;
  }

  bool _checkTemperatureConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.colorTemperature == null) return false;
    return (state.colorTemperature! - desiredValue).abs() <= tolerance;
  }

  bool _checkWhiteConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    if (state.white == null) return false;
    return (state.white! - desiredValue).abs() <= tolerance;
  }

  bool _checkOnOffConvergence(
    List<RoleAggregatedState> targets,
    double desiredValue,
    double tolerance,
  ) {
    if (targets.isEmpty) return true;
    final state = targets.first;
    final targetOn = desiredValue > LightingConstants.onOffThreshold;
    return state.isOn == targetOn && !state.isOnMixed;
  }

  // ============================================================================
  // Intent lock (space-level, same approach as climate view)
  // ============================================================================

  bool _isSpaceIntentLocked(List<RoleAggregatedState> targets) {
    return _intentsRepository?.isSpaceLocked(widget.roomId) ?? false;
  }

  // ============================================================================
  // Data listeners
  // ============================================================================

  void _onIntentChanged() {
    if (!mounted) return;

    final isNowLocked = _intentsRepository?.isSpaceLocked(widget.roomId) ?? false;
    final roleState = _getRoleAggregatedState();
    final targets = roleState != null ? [roleState] : <RoleAggregatedState>[];

    // Detect space intent unlock → call onIntentCompleted for all pending channels
    if (_wasSpaceLocked && !isNowLocked) {
      for (final channelId in _controlChannelIds) {
        _controlStateService.onIntentCompleted(channelId, targets);
      }
    }

    _wasSpaceLocked = isNowLocked;
  }

  void _onSpacesDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      final roleState = _getRoleAggregatedState();
      final targets = roleState != null ? [roleState] : <RoleAggregatedState>[];

      // Load cached values if role is mixed and we haven't loaded them yet
      if (roleState != null) {
        final roleMixedState = _buildMixedStateFromRole(roleState);
        if (roleMixedState.isMixed) {
          _loadCachedValuesIfNeeded(roleState, roleMixedState);
        }
      }

      // Check convergence for all channels
      for (final channelId in _controlChannelIds) {
        _controlStateService.checkConvergence(channelId, targets);
      }

      _updateCacheIfSynced(roleState);
      _channelsSheetRebuildNotifier.value++;
      setState(() {});
    });
  }

  void _onDevicesDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _channelsSheetRebuildNotifier.value++;
      setState(() {});
    });
  }

  // ============================================================================
  // RoleAggregatedState helper
  // ============================================================================

  RoleAggregatedState? _getRoleAggregatedState() {
    final stateRole = mapTargetRoleToStateRole(widget.role);
    if (stateRole == null) return null;
    return _spacesService?.getLightingState(widget.roomId)?.getRoleState(stateRole);
  }

  /// Parse a hex color string (#RRGGBB) to a Color, or null if invalid.
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

  // ============================================================================
  // Mixed state (from RoleAggregatedState flags)
  // ============================================================================

  RoleMixedState _buildMixedStateFromRole(RoleAggregatedState roleState) {
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

  // ============================================================================
  // Cache management
  // ============================================================================

  void _loadCachedValues() {
    if (_cacheLoaded) return;
    _cacheLoaded = true;

    final roleState = _getRoleAggregatedState();
    if (roleState == null) return;

    final roleMixedState = _buildMixedStateFromRole(roleState);
    _loadCachedValuesIfNeeded(roleState, roleMixedState);
  }

  void _loadCachedValuesIfNeeded(RoleAggregatedState roleState, RoleMixedState roleMixedState) {
    if (!roleMixedState.isMixed) return;

    final cached = _roleControlStateRepository?.get(_cacheKey);
    if (cached == null) return;
    if (!mounted) return;

    // Use cached values (or role state values as fallback) for mixed state display
    final brightness = cached.brightness ?? roleState.brightness?.toDouble();
    if (brightness != null &&
        _controlStateService.getDesiredValue(LightingConstants.brightnessChannelId) == null) {
      _controlStateService.setMixed(LightingConstants.brightnessChannelId, brightness);
    }

    final hue = cached.hue ?? _extractHueFromRole(roleState);
    if (hue != null &&
        _controlStateService.getDesiredValue(LightingConstants.hueChannelId) == null) {
      _controlStateService.setMixed(LightingConstants.hueChannelId, hue);
    }

    final saturation = cached.saturation ?? _extractSaturationFromRole(roleState);
    if (saturation != null &&
        _controlStateService.getDesiredValue(LightingConstants.saturationChannelId) == null) {
      _controlStateService.setMixed(LightingConstants.saturationChannelId, saturation);
    }

    final temperature = cached.temperature ?? roleState.colorTemperature?.toDouble();
    if (temperature != null &&
        _controlStateService.getDesiredValue(LightingConstants.temperatureChannelId) == null) {
      _controlStateService.setMixed(LightingConstants.temperatureChannelId, temperature);
    }

    final white = cached.white ?? roleState.white?.toDouble();
    if (white != null &&
        _controlStateService.getDesiredValue(LightingConstants.whiteChannelId) == null) {
      _controlStateService.setMixed(LightingConstants.whiteChannelId, white);
    }
  }

  double? _extractHueFromRole(RoleAggregatedState roleState) {
    final color = _parseHexColor(roleState.color);
    if (color == null) return null;
    return HSVColor.fromColor(color).hue;
  }

  double? _extractSaturationFromRole(RoleAggregatedState roleState) {
    final color = _parseHexColor(roleState.color);
    if (color == null) return null;
    return HSVColor.fromColor(color).saturation;
  }

  void _saveToCache({
    double? brightness,
    double? hue,
    double? saturation,
    double? temperature,
    double? white,
  }) {
    _roleControlStateRepository?.set(
      _cacheKey,
      brightness: brightness,
      hue: hue,
      saturation: saturation,
      temperature: temperature,
      white: white,
    );
  }

  void _updateCacheIfSynced(RoleAggregatedState? roleState) {
    if (roleState == null) return;

    final roleMixedState = _buildMixedStateFromRole(roleState);
    if (!roleMixedState.isSynced || roleMixedState.onStateMixed) return;

    // Only cache when role is synced (all devices agree)
    double? commonBrightness;
    double? commonHue;
    double? commonSaturation;
    double? commonTemperature;
    double? commonWhite;

    if (roleState.isOn) {
      commonBrightness = roleState.brightness?.toDouble();
      commonTemperature = roleState.colorTemperature?.toDouble();
      commonWhite = roleState.white?.toDouble();

      final color = _parseHexColor(roleState.color);
      if (color != null) {
        final hsv = HSVColor.fromColor(color);
        commonHue = hsv.hue;
        commonSaturation = hsv.saturation;
      }
    }

    if (commonBrightness != null || commonHue != null ||
        commonSaturation != null || commonTemperature != null || commonWhite != null) {
      _roleControlStateRepository?.updateFromSync(
        _cacheKey,
        brightness: commonBrightness,
        hue: commonHue,
        saturation: commonSaturation,
        temperature: commonTemperature,
        white: commonWhite,
      );
    }
  }

  // ============================================================================
  // Helpers (targets, role name, state subtitle)
  // ============================================================================

  List<LightTargetView> _getTargets() {
    return _spacesService
            ?.getLightTargetsForSpace(widget.roomId)
            .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
            .toList() ??
        [];
  }

  String _getRoleName(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return 'Main';
      case LightTargetRole.task:
        return 'Task';
      case LightTargetRole.ambient:
        return 'Ambient';
      case LightTargetRole.accent:
        return 'Accent';
      case LightTargetRole.night:
        return 'Night';
      case LightTargetRole.other:
        return 'Other';
      case LightTargetRole.hidden:
        return 'Hidden';
    }
  }

  String _getLightStateSubtitle(RoleMixedState mixedState) {
    final total = mixedState.onCount + mixedState.offCount;

    if (_pendingOnState != null) {
      return _pendingOnState! ? 'All lights on' : 'All lights off';
    }

    if (mixedState.allOn) {
      return total == 1 ? '1 light on' : 'All lights on';
    }

    if (mixedState.allOff) {
      return total == 1 ? '1 light off' : 'All lights off';
    }

    final onCount = mixedState.onCount;
    if (onCount == 1) {
      return '1 of $total lights on';
    }
    return '$onCount of $total lights on';
  }

  // ============================================================================
  // Command methods (backend intents only)
  // ============================================================================

  Future<void> _toggleAllLights() async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);
    if (stateRole == null) return;

    try {
      final roleState = _getRoleAggregatedState();
      final anyOn = roleState?.anyOn ?? false;
      final newState = !anyOn;

      _pendingOnStateClearTimer?.cancel();
      _pendingOnStateClearTimer = null;

      _controlStateService.setPending(
        LightingConstants.onOffChannelId,
        newState ? LightingConstants.onValue : LightingConstants.offValue,
      );

      setState(() {
        _pendingOnState = newState;
      });

      _wasSpaceLocked = true;

      final result = newState
          ? await spacesService.turnRoleOn(widget.roomId, stateRole)
          : await spacesService.turnRoleOff(widget.roomId, stateRole);
      final success = result != null;

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      }

      if (!mounted) return;

      if (!success) {
        AppToast.showError(context, message: localizations.action_failed);
        _controlStateService.setIdle(LightingConstants.onOffChannelId);
        setState(() {
          _pendingOnState = null;
        });
      } else {
        _pendingOnStateClearTimer = Timer(
          const Duration(milliseconds: LightingConstants.onOffSettlingWindowMs),
          () {
            if (mounted) {
              setState(() {
                _pendingOnState = null;
              });
            }
          },
        );
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
      _controlStateService.setIdle(LightingConstants.onOffChannelId);
      setState(() {
        _pendingOnState = null;
      });
    }
  }

  Future<void> _setAllLightsOff() async {
    await _setAllLightsPower(false);
  }

  Future<void> _setAllLightsOn() async {
    await _setAllLightsPower(true);
  }

  Future<void> _setAllLightsPower(bool on) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);
    if (stateRole == null) return;

    try {
      _wasSpaceLocked = true;

      final result = on
          ? await spacesService.turnRoleOn(widget.roomId, stateRole)
          : await spacesService.turnRoleOff(widget.roomId, stateRole);
      final success = result != null;

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      }

      if (!mounted) return;

      if (!success) {
        AppToast.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (mounted) {
        AppToast.showError(context, message: localizations.action_failed);
      }
    }
  }

  Future<void> _setSimplePropertyForAll({
    required SimplePropertyType propertyType,
    required num value,
  }) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);
    if (stateRole == null) return;

    try {
      _wasSpaceLocked = true;

      final intValue = value is double ? value.round() : value as int;
      bool success = false;

      switch (propertyType) {
        case SimplePropertyType.brightness:
          final result = await spacesService.setRoleBrightness(
            widget.roomId, stateRole, intValue,
          );
          success = result != null;
          if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          break;
        case SimplePropertyType.temperature:
          final result = await spacesService.setRoleColorTemp(
            widget.roomId, stateRole, intValue,
          );
          success = result != null;
          if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          break;
        case SimplePropertyType.white:
          final result = await spacesService.setRoleWhite(
            widget.roomId, stateRole, intValue,
          );
          success = result != null;
          if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          break;
      }

      if (!mounted) return;

      if (!success) {
        AppToast.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
    }
  }

  Future<void> _setColorForAll(double hue, double saturation) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);
    if (stateRole == null) return;

    try {
      final color = HSVColor.fromAHSV(1.0, hue, saturation, 1.0).toColor();
      final r = (color.r * 255).toInt().toRadixString(16).padLeft(2, '0');
      final g = (color.g * 255).toInt().toRadixString(16).padLeft(2, '0');
      final b = (color.b * 255).toInt().toRadixString(16).padLeft(2, '0');
      final hexColor = '#$r$g$b'.toUpperCase();

      _wasSpaceLocked = true;

      final result = await spacesService.setRoleColor(
        widget.roomId, stateRole, hexColor,
      );
      final success = result != null;

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeeded(context, result);
      }

      if (!mounted) return;

      if (!success) {
        AppToast.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(context, message: localizations.action_failed);
    }
  }

  /// Creates the command context for device property updates (bottom sheet per-device toggle).
  PropertyCommandContext _createCommandContext() {
    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;
    return PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );
  }

  Future<void> _toggleChannel(LightingChannelData channelData) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final targets = _getTargets();
    final target = targets.firstWhere(
      (t) => t.channelId == channelData.id,
      orElse: () => targets.first,
    );

    final device = devicesService.getDevice(target.deviceId);
    if (device is! LightingDeviceView) return;

    final channel = findLightChannel(device, target.channelId);
    if (channel == null) return;

    final newState = !channelData.isOn;

    // Force immediate UI update (and refresh channels sheet if open)
    if (mounted) {
      _channelsSheetRebuildNotifier.value++;
    }

    await devicesService.setMultiplePropertyValues(
      properties: [
        PropertyCommandItem(
          deviceId: target.deviceId,
          channelId: target.channelId,
          propertyId: channel.onProp.id,
          value: newState,
        ),
      ],
      context: _createCommandContext(),
    );
  }

  void _navigateToChannelDetail(LightingChannelData channelData) {
    final targets = _getTargets();
    final target = targets.firstWhere(
      (t) => t.channelId == channelData.id,
      orElse: () => targets.first,
    );

    final device = _devicesService?.getDevice(target.deviceId);
    String? deviceChannelId;
    if (device is LightingDeviceView) {
      final matchedChannel = device.lightChannels.cast<LightChannelView?>().firstWhere(
        (c) => c?.id == target.channelId,
        orElse: () => null,
      );
      if (matchedChannel != null) {
        deviceChannelId = matchedChannel.id;
      } else {
        final namedChannel = device.lightChannels.cast<LightChannelView?>().firstWhere(
          (c) => c?.name.toLowerCase() == channelData.name.toLowerCase(),
          orElse: () => null,
        );
        deviceChannelId = namedChannel?.id;
      }
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          target.deviceId,
          initialChannelId: deviceChannelId ?? channelData.id,
        ),
      ),
    );
  }

  // ============================================================================
  // Build (scaffold, header, orientation-aware layout)
  // ============================================================================

  @override
  Widget build(BuildContext context) {
    final spacesService = _spacesService;
    final devicesService = _devicesService;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;

    if (spacesService == null || devicesService == null) {
      return const Scaffold(
        body: Center(child: Text('Services not available')),
      );
    }

    final targets = _getTargets();
    if (targets.isEmpty) {
      return Scaffold(
        body: Center(child: Text('No devices found for role ${widget.role.name}')),
      );
    }

    // Get role aggregated state from backend
    final roleState = _getRoleAggregatedState();

    // Build channels list (still per-device for bottom sheet)
    final channels = <LightingChannelData>[];
    final allCapabilities = <LightCapability>{};

    final roomName = spacesService.getSpace(widget.roomId)?.name ?? '';

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        channels.add(LightingChannelData(
          id: target.channelId,
          name: getLightTargetDisplayName(target, targets, roomName),
          isOn: channel.on,
          brightness: channel.hasBrightness ? channel.brightness : 100,
          hasBrightness: channel.hasBrightness,
          isOnline: device.isOnline,
        ));

        allCapabilities.add(LightCapability.power);
        if (channel.hasBrightness) allCapabilities.add(LightCapability.brightness);
        if (channel.hasTemperature) allCapabilities.add(LightCapability.colorTemp);
        if (channel.hasColor) allCapabilities.add(LightCapability.color);
        if (channel.hasColorWhite) allCapabilities.add(LightCapability.white);
      }
    }

    _lastChannels = List.of(channels);

    // Display values from RoleAggregatedState (with control state override)
    final baseBrightness = roleState?.brightness?.toInt() ?? 100;
    final baseColorTemp = roleState?.colorTemperature?.toInt() ?? 4000;
    final baseWhite = roleState?.white?.toInt() ?? 100;
    final baseColor = _parseHexColor(roleState?.color);

    // Determine mixed state from backend flags
    final roleMixedState = roleState != null
        ? _buildMixedStateFromRole(roleState)
        : const RoleMixedState();

    // Helper to check channel state from control state service
    bool isChannelMixed(String channelId) {
      final state = _controlStateService.getState(channelId);
      return state?.state == ControlUIState.mixed;
    }

    // Any channel locked (pending or settling) — suppress mixed indicator
    final hasLockedChannel = _controlStateService.hasActiveState;

    final hasSyncError = isChannelMixed(LightingConstants.brightnessChannelId) ||
        isChannelMixed(LightingConstants.hueChannelId) ||
        isChannelMixed(LightingConstants.saturationChannelId) ||
        isChannelMixed(LightingConstants.temperatureChannelId) ||
        isChannelMixed(LightingConstants.whiteChannelId) ||
        isChannelMixed(LightingConstants.onOffChannelId);

    final devicesMixed = roleMixedState.isMixed;

    LightingState state;
    if (hasLockedChannel) {
      state = LightingState.synced;
    } else if (hasSyncError || devicesMixed) {
      state = LightingState.mixed;
    } else {
      state = LightingState.synced;
    }

    // Determine displayed values (use state machine values if locked)
    final displayBrightness = _controlStateService.isLocked(LightingConstants.brightnessChannelId)
        ? (_controlStateService.getDesiredValue(LightingConstants.brightnessChannelId)?.round() ?? baseBrightness)
        : baseBrightness;
    final displayColorTemp = _controlStateService.isLocked(LightingConstants.temperatureChannelId)
        ? (_controlStateService.getDesiredValue(LightingConstants.temperatureChannelId)?.round() ?? baseColorTemp)
        : baseColorTemp;
    final displayWhite = _controlStateService.isLocked(LightingConstants.whiteChannelId)
        ? (_controlStateService.getDesiredValue(LightingConstants.whiteChannelId)?.round() ?? baseWhite)
        : baseWhite;

    // Determine on/off state from role aggregated state
    final anyOn = roleState?.anyOn ?? false;
    final displayIsOn = _pendingOnState ?? anyOn;

    // Get saturation
    double saturation;
    final satDesiredValue =
        _controlStateService.getDesiredValue(LightingConstants.saturationChannelId);
    if (_controlStateService.isLocked(LightingConstants.saturationChannelId) &&
        satDesiredValue != null) {
      saturation = (satDesiredValue as num).toDouble();
    } else if (baseColor != null) {
      saturation = HSVColor.fromColor(baseColor).saturation;
    } else {
      saturation = 1.0;
    }

    // Get hue and convert to color if needed
    Color? displayColor = baseColor;
    final hueDesiredValue =
        _controlStateService.getDesiredValue(LightingConstants.hueChannelId);
    if (_controlStateService.isLocked(LightingConstants.hueChannelId) &&
        hueDesiredValue != null) {
      displayColor =
          HSVColor.fromAHSV(1.0, hueDesiredValue, saturation, 1.0).toColor();
    } else if (_controlStateService.isLocked(LightingConstants.saturationChannelId) &&
        baseColor != null) {
      final baseHue = HSVColor.fromColor(baseColor).hue;
      displayColor =
          HSVColor.fromAHSV(1.0, baseHue, saturation, 1.0).toColor();
    }

    _currentUiState = state;
    _currentDisplayIsOn = displayIsOn;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(
              context,
              isDark,
              roleMixedState,
              channels,
              () => _toggleAllLights(),
            ),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  final isLandscape = orientation == Orientation.landscape;

                  void onBrightnessChanged(int value) {
                    _controlStateService.setPending(
                      LightingConstants.brightnessChannelId,
                      value.toDouble(),
                    );
                    _saveToCache(brightness: value.toDouble());
                    _brightnessDebounceTimer?.cancel();
                    _brightnessDebounceTimer = Timer(
                      const Duration(milliseconds: LightingConstants.sliderDebounceMs),
                      () {
                        if (!mounted) return;
                        _setSimplePropertyForAll(
                          propertyType: SimplePropertyType.brightness,
                          value: value,
                        );
                      },
                    );
                  }

                  void onColorTempChanged(int value) {
                    _controlStateService.setPending(
                      LightingConstants.temperatureChannelId,
                      value.toDouble(),
                    );
                    _saveToCache(temperature: value.toDouble());
                    _temperatureDebounceTimer?.cancel();
                    _temperatureDebounceTimer = Timer(
                      const Duration(milliseconds: LightingConstants.sliderDebounceMs),
                      () {
                        if (!mounted) return;
                        _setSimplePropertyForAll(
                          propertyType: SimplePropertyType.temperature,
                          value: value,
                        );
                      },
                    );
                  }

                  void onColorChanged(Color color, double saturationValue) {
                    final hsv = HSVColor.fromColor(color);
                    final hue = hsv.hue;
                    _controlStateService.setPending(
                      LightingConstants.hueChannelId,
                      hue,
                    );
                    _controlStateService.setPending(
                      LightingConstants.saturationChannelId,
                      saturationValue,
                    );
                    _saveToCache(hue: hue, saturation: saturationValue);
                    _hueDebounceTimer?.cancel();
                    _hueDebounceTimer = Timer(
                      const Duration(milliseconds: LightingConstants.sliderDebounceMs),
                      () {
                        if (!mounted) return;
                        _setColorForAll(hue, saturationValue);
                      },
                    );
                  }

                  void onWhiteChannelChanged(int value) {
                    _controlStateService.setPending(
                      LightingConstants.whiteChannelId,
                      value.toDouble(),
                    );
                    _saveToCache(white: value.toDouble());
                    _whiteDebounceTimer?.cancel();
                    _whiteDebounceTimer = Timer(
                      const Duration(milliseconds: LightingConstants.sliderDebounceMs),
                      () {
                        if (!mounted) return;
                        _setSimplePropertyForAll(
                          propertyType: SimplePropertyType.white,
                          value: value,
                        );
                      },
                    );
                  }

                  void onSyncAll() {
                    if (!displayIsOn) {
                      _setAllLightsOff();
                      return;
                    }
                    _setAllLightsOn();
                    if (allCapabilities.contains(LightCapability.brightness)) {
                      _setSimplePropertyForAll(
                        propertyType: SimplePropertyType.brightness,
                        value: displayBrightness,
                      );
                    }
                    if (allCapabilities.contains(LightCapability.colorTemp)) {
                      _setSimplePropertyForAll(
                        propertyType: SimplePropertyType.temperature,
                        value: displayColorTemp,
                      );
                    }
                    if (allCapabilities.contains(LightCapability.color) && baseColor != null) {
                      final hue = _controlStateService.getDesiredValue(LightingConstants.hueChannelId) ??
                          HSVColor.fromColor(baseColor).hue;
                      _setColorForAll(hue, saturation);
                    }
                    if (allCapabilities.contains(LightCapability.white)) {
                      _setSimplePropertyForAll(
                        propertyType: SimplePropertyType.white,
                        value: displayWhite,
                      );
                    }
                  }
                  _onSyncAllCallback = onSyncAll;

                  final isSimple = allCapabilities.length == 1 &&
                      allCapabilities.contains(LightCapability.power);

                  final enabledCapabilities = [
                    LightCapability.brightness,
                    LightCapability.colorTemp,
                    LightCapability.color,
                    LightCapability.white,
                  ].where((cap) => allCapabilities.contains(cap)).toList();

                  if (enabledCapabilities.isNotEmpty &&
                      !enabledCapabilities.contains(_selectedCapability)) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        setState(() => _selectedCapability = enabledCapabilities.first);
                      }
                    });
                  }

                  final showModeSelector = !isSimple && enabledCapabilities.length > 1;
                  final showPresets = !isSimple;

                  if (isLandscape) {
                    final additionalContent = showPresets
                        ? LightingPresetsPanel(
                            selectedCapability: _selectedCapability,
                            brightness: displayBrightness,
                            colorTemp: displayColorTemp,
                            color: displayColor,
                            whiteChannel: displayWhite,
                            isLandscape: true,
                            onBrightnessChanged: onBrightnessChanged,
                            onColorTempChanged: onColorTempChanged,
                            onColorChanged: onColorChanged,
                            onWhiteChannelChanged: onWhiteChannelChanged,
                          )
                        : null;

                    return LandscapeViewLayout(
                      mainContentPadding: EdgeInsets.only(
                        left: AppSpacings.pMd,
                        bottom: AppSpacings.pMd,
                      ),
                      mainContent: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: LightingMainControl(
                              selectedCapability: _selectedCapability,
                              isOn: displayIsOn,
                              brightness: displayBrightness,
                              colorTemp: displayColorTemp,
                              color: displayColor,
                              saturation: saturation,
                              whiteChannel: displayWhite,
                              capabilities: allCapabilities,
                              isLandscape: true,
                              onPowerToggle: () => _toggleAllLights(),
                              onBrightnessChanged: onBrightnessChanged,
                              onColorTempChanged: onColorTempChanged,
                              onColorChanged: onColorChanged,
                              onWhiteChannelChanged: onWhiteChannelChanged,
                            ),
                          ),
                          if (showModeSelector)
                            SizedBox(
                              width: AppSpacings.scale(64.0),
                              child: Padding(
                                padding: EdgeInsets.only(
                                  left: AppSpacings.pMd,
                                ),
                                child: LightingModeSelector(
                                  capabilities: allCapabilities,
                                  selectedCapability: _selectedCapability,
                                  onCapabilityChanged: (value) {
                                    setState(
                                        () => _selectedCapability = value);
                                  },
                                  isVertical: true,
                                ),
                              ),
                            ),
                        ],
                      ),
                      additionalContent: additionalContent,
                    );
                  }

                  // Portrait layout
                  final mainContent = Column(
                    spacing: AppSpacings.pMd,
                    children: [
                      if (showModeSelector)
                        LightingModeSelector(
                          capabilities: allCapabilities,
                          selectedCapability: _selectedCapability,
                          onCapabilityChanged: (value) {
                            setState(() => _selectedCapability = value);
                          },
                          isVertical: false,
                        ),
                      Expanded(
                        child: LightingMainControl(
                          selectedCapability: _selectedCapability,
                          isOn: displayIsOn,
                          brightness: displayBrightness,
                          colorTemp: displayColorTemp,
                          color: displayColor,
                          saturation: saturation,
                          whiteChannel: displayWhite,
                          capabilities: allCapabilities,
                          isLandscape: false,
                          onPowerToggle: () => _toggleAllLights(),
                          onBrightnessChanged: onBrightnessChanged,
                          onColorTempChanged: onColorTempChanged,
                          onColorChanged: onColorChanged,
                          onWhiteChannelChanged: onWhiteChannelChanged,
                        ),
                      ),
                      if (showPresets)
                        LightingPresetsPanel(
                          selectedCapability: _selectedCapability,
                          brightness: displayBrightness,
                          colorTemp: displayColorTemp,
                          color: displayColor,
                          whiteChannel: displayWhite,
                          isLandscape: false,
                          onBrightnessChanged: onBrightnessChanged,
                          onColorTempChanged: onColorTempChanged,
                          onColorChanged: onColorChanged,
                          onWhiteChannelChanged: onWhiteChannelChanged,
                        ),
                    ],
                  );

                  return PortraitViewLayout(
                    scrollable: false,
                    content: mainContent,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // Status colors and icons (synced/mixed/unsynced)
  // ============================================================================

  ThemeColors _getStatusColor() {
    switch (_currentUiState) {
      case LightingState.unsynced:
        return ThemeColors.warning;
      case LightingState.mixed:
        return ThemeColors.info;
      case LightingState.synced:
        return _currentDisplayIsOn ? ThemeColors.primary : ThemeColors.neutral;
    }
  }

  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor());

  IconData _getChannelsSectionIcon() {
    switch (_currentUiState) {
      case LightingState.mixed:
        return MdiIcons.tune;
      case LightingState.unsynced:
        return MdiIcons.alert;
      case LightingState.synced:
        return MdiIcons.lightbulbGroup;
    }
  }

  Widget _buildHeader(
    BuildContext context,
    bool isDark,
    RoleMixedState roleMixedState,
    List<LightingChannelData> channels,
    VoidCallback onPowerToggle,
  ) {
    final statusColorFamily = _getStatusColorFamily(context);
    final statusColor = _getStatusColor();
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final subtitleColor =
        statusColor == ThemeColors.neutral ? secondaryColor : statusColorFamily.base;

    return PageHeader(
      title: _getRoleName(widget.role),
      subtitle: _getLightStateSubtitle(roleMixedState),
      subtitleColor: subtitleColor,
      leading: Row(
        spacing: AppSpacings.pMd,
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.pop(context),
          ),
          HeaderMainIcon(
            icon: getLightRoleIcon(widget.role),
            color: statusColor,
          ),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (channels.isNotEmpty)
            HeaderIconButton(
              icon: _getChannelsSectionIcon(),
              onTap: () => _showChannelsSheet(channels),
              color: _getStatusColor(),
            ),
          if (channels.isNotEmpty) AppSpacings.spacingSmHorizontal,
          HeaderIconButton(
            icon: MdiIcons.power,
            onTap: onPowerToggle,
            color: _currentDisplayIsOn ? ThemeColors.primary : ThemeColors.neutral,
          ),
        ],
      ),
    );
  }

  /// Shows the channels sheet (individual light toggles + sync/retry).
  ///
  /// In portrait mode opens a bottom sheet via [DeckItemSheet]; in landscape
  /// mode opens a right-side drawer via [showAppRightDrawer].
  void _showChannelsSheet(List<LightingChannelData> channels) {
    if (channels.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    final bottomSection = _currentUiState == LightingState.synced
        ? null
        : ListenableBuilder(
            listenable: _channelsSheetRebuildNotifier,
            builder: (ctx, _) => _buildChannelsSheetBottomSection(ctx),
          );

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.domain_lights,
        titleIcon: MdiIcons.lightbulbGroup,
        scrollable: false,
        content: ListenableBuilder(
          listenable: _channelsSheetRebuildNotifier,
          builder: (ctx, _) {
            final items = _lastChannels ?? [];
            return VerticalScrollWithGradient(
              gradientHeight: AppSpacings.pMd,
              itemCount: items.length,
              separatorHeight: AppSpacings.pSm,
              backgroundColor: drawerBgColor,
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pLg,
                vertical: AppSpacings.pMd,
              ),
              itemBuilder: (c, i) => _buildChannelTileForSheet(c, items[i]),
            );
          },
        ),
        footerSection: bottomSection,
      );
    } else {
      DeckItemSheet.showItemSheetWithUpdates(
        context,
        title: localizations.domain_lights,
        icon: MdiIcons.lightbulbGroup,
        rebuildWhen: _channelsSheetRebuildNotifier,
        getItemCount: () => _lastChannels?.length ?? 0,
        itemBuilder: (c, i) => _buildChannelTileForSheet(c, _lastChannels![i]),
        showCountInHeader: false,
        bottomSection: bottomSection,
      );
    }
  }

  Widget _buildChannelsSheetBottomSection(BuildContext context) {
    if (_currentUiState == LightingState.synced) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final filledTheme = _currentUiState == LightingState.mixed
        ? (isDark ? AppFilledButtonsDarkThemes.info : AppFilledButtonsLightThemes.info)
        : (isDark ? AppFilledButtonsDarkThemes.warning : AppFilledButtonsLightThemes.warning);
    final label = _currentUiState == LightingState.mixed
        ? localizations.button_sync_all
        : localizations.button_retry;

    return Theme(
      data: Theme.of(context).copyWith(filledButtonTheme: filledTheme),
      child: SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            _onSyncAllCallback?.call();
            _channelsSheetRebuildNotifier.value++;
            Navigator.of(context).pop();
          },
          child: Text(label),
        ),
      ),
    );
  }

  Widget _buildChannelTileForSheet(
    BuildContext context,
    LightingChannelData channel,
  ) {
    final localizations = AppLocalizations.of(context)!;
    return HorizontalTileStretched(
      icon: MdiIcons.lightbulbOutline,
      activeIcon: MdiIcons.lightbulb,
      name: channel.name,
      status: channel.getStatusText(localizations),
      isActive: channel.isOn && channel.isOnline,
      isOffline: !channel.isOnline,
      isSelected: channel.isSelected,
      onTileTap: () {
        Navigator.of(context).pop();
        _navigateToChannelDetail(channel);
      },
      onIconTap: channel.isOnline ? () => _toggleChannel(channel) : null,
      showSelectionIndicator: true,
      showWarningBadge: true,
    );
  }
}

// ============================================================================
// Lighting widgets (role-detail specific)
// ============================================================================

/// UI state for the lighting control (synced, mixed, or unsynced).
enum LightingState {
  synced,
  mixed,
  unsynced,
}

/// Data model for a lighting channel displayed in the channels sheet tiles.
class LightingChannelData {
  final String id;
  final String name;
  final bool isOn;
  final int brightness;
  final bool hasBrightness;
  final bool isOnline;
  final bool isSelected;

  const LightingChannelData({
    required this.id,
    required this.name,
    required this.isOn,
    this.brightness = 100,
    this.hasBrightness = true,
    this.isOnline = true,
    this.isSelected = false,
  });

  String getStatusText(AppLocalizations localizations) {
    if (!isOnline) return localizations.device_status_offline;
    if (isOn) {
      return hasBrightness ? '$brightness%' : localizations.on_state_on;
    }
    return localizations.on_state_off;
  }
}

/// Main lighting control widget.
///
/// Displays the appropriate control (slider, color picker, or power button)
/// based on the selected capability.
class LightingMainControl extends StatelessWidget {
  final LightCapability selectedCapability;
  final bool isOn;
  final int brightness;
  final int colorTemp;
  final Color? color;
  final double saturation;
  final int? whiteChannel;
  final Set<LightCapability> capabilities;
  final bool isLandscape;
  final VoidCallback? onPowerToggle;
  final ValueChanged<int>? onBrightnessChanged;
  final ValueChanged<int>? onColorTempChanged;
  final Function(Color, double)? onColorChanged;
  final ValueChanged<int>? onWhiteChannelChanged;

  const LightingMainControl({
    super.key,
    required this.selectedCapability,
    required this.isOn,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.saturation = 1.0,
    this.whiteChannel,
    required this.capabilities,
    this.isLandscape = false,
    this.onPowerToggle,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
  });

  bool get _isSimple =>
      capabilities.length == 1 && capabilities.contains(LightCapability.power);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isSimple) {
      return _buildPowerButton(context, isDark);
    }

    return _buildControlPanel(context, isDark);
  }

  Widget _buildPowerButton(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final inactiveColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final infoText = isOn
        ? localizations.power_hint_tap_to_turn_off
        : localizations.power_hint_tap_to_turn_on;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pLg,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              onPowerToggle?.call();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: AppSpacings.scale(160),
              height: AppSpacings.scale(160),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOn ? primaryBgColor : inactiveBgColor,
                border: Border.all(
                  color: isOn
                      ? primaryColor
                      : (isDark
                          ? AppColors.blank
                          : AppBorderColorLight.darker),
                  width: isOn ? AppSpacings.scale(4) : AppSpacings.scale(1),
                ),
                boxShadow: isOn
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
                    color: isOn ? primaryColor : inactiveColor,
                  ),
                  Text(
                    isOn
                        ? localizations.on_state_on.toUpperCase()
                        : localizations.on_state_off.toUpperCase(),
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w600,
                      color: isOn ? primaryColor : inactiveColor,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Text(
            infoText,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlPanel(BuildContext context, bool isDark) {
    switch (selectedCapability) {
      case LightCapability.brightness:
        return _BrightnessPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: brightness,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onBrightnessChanged?.call(value);
          },
        );
      case LightCapability.colorTemp:
        return _ColorTempPanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: colorTemp,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onColorTempChanged?.call(value);
          },
        );
      case LightCapability.color:
        final currentColor = color ?? Colors.red;
        final hsv = HSVColor.fromColor(currentColor);
        return _ColorPanel(
          isLandscape: isLandscape,
          hue: hsv.hue,
          saturation: saturation,
          onChanged: (hue, sat) {
            final newColor = HSVColor.fromAHSV(1, hue, sat, 1).toColor();
            onColorChanged?.call(newColor, sat);
          },
        );
      case LightCapability.white:
        return _WhitePanel(
          isLandscape: isLandscape,
          isDark: isDark,
          value: whiteChannel ?? 80,
          onChanged: (value) {
            HapticFeedback.selectionClick();
            onWhiteChannelChanged?.call(value);
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// ============================================================================
// Slider panels (brightness, color temp, white channel)
// ============================================================================

class _BrightnessPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _BrightnessPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

class _ColorTempPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _ColorTempPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  Color _getColorTempColor(int temp) {
    final t = (temp - 2700) / (6500 - 2700);
    if (t < 0.33) {
      return Color.lerp(
          const Color(0xFFFF9800), const Color(0xFFFFFAF0), t / 0.33)!;
    } else if (t < 0.66) {
      return Color.lerp(
          const Color(0xFFFFFAF0), const Color(0xFFE3F2FD), (t - 0.33) / 0.33)!;
    } else {
      return Color.lerp(
          const Color(0xFFE3F2FD), const Color(0xFF64B5F6), (t - 0.66) / 0.34)!;
    }
  }

  String _getColorTempName(int temp) {
    if (temp <= 2700) return 'Candle';
    if (temp <= 3200) return 'Warm White';
    if (temp <= 4000) return 'Neutral';
    if (temp <= 5000) return 'Daylight';
    return 'Cool White';
  }

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 2700,
      maxValue: 6500,
      displayValue: '${value}K',
      sublabel: _getColorTempName(value),
      gradientColors: const [
        Color(0xFFFF9800),
        Color(0xFFFFFAF0),
        Color(0xFFE3F2FD),
        Color(0xFF64B5F6),
      ],
      thumbColor: _getColorTempColor(value),
      onChanged: onChanged,
    );
  }
}

class _WhitePanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final ValueChanged<int> onChanged;

  const _WhitePanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SliderPanel(
      isLandscape: isLandscape,
      isDark: isDark,
      value: value,
      minValue: 0,
      maxValue: 100,
      displayValue: '$value%',
      gradientColors: [
        isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
        AppColors.white,
      ],
      thumbColor: AppColors.white,
      onChanged: onChanged,
    );
  }
}

// ============================================================================
// Generic slider panel (shared by brightness, color temp, white)
// ============================================================================

class _SliderPanel extends StatelessWidget {
  final bool isLandscape;
  final bool isDark;
  final int value;
  final int minValue;
  final int maxValue;
  final String displayValue;
  final String? sublabel;
  final List<Color> gradientColors;
  final Color thumbColor;
  final ValueChanged<int> onChanged;

  const _SliderPanel({
    required this.isLandscape,
    required this.isDark,
    required this.value,
    required this.minValue,
    required this.maxValue,
    required this.displayValue,
    this.sublabel,
    required this.gradientColors,
    this.thumbColor = AppColors.white,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final normalizedValue = (value - minValue) / (maxValue - minValue);

    final slider = SliderWithSteps(
      themeColor: ThemeColors.neutral,
      value: normalizedValue,
      vertical: isLandscape,
      trackGradientColors: gradientColors,
      thumbFillColor: thumbColor,
      showSteps: false,
      onChanged: (v) {
        final newValue =
            (minValue + (maxValue - minValue) * v).round();
        onChanged(newValue);
      },
    );

    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay()),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pLg,
            ),
            child: SizedBox(
              width: AppSpacings.scale(52),
              child: slider,
            ),
          ),
        ],
      );
    } else {
      return Column(
          spacing: AppSpacings.pMd,
          children: [
            Expanded(child: _buildDisplay()),
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pLg,
                vertical: AppSpacings.pMd,
              ),
              child: slider,
            ),
          ],
      );
    }
  }

  Widget _buildDisplay() {
    final match = RegExp(r'^(\d+)(.*)$').firstMatch(displayValue);
    final valueText = match?.group(1) ?? displayValue;
    final unitText = match?.group(2) ?? '';

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: isDark
            ? null
            : Border.all(
                color: AppBorderColorLight.darker,
                width: AppSpacings.scale(1),
              ),
      ),
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: AppSpacings.pSm,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    valueText,
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: AppSpacings.scale(60),
                      fontWeight: FontWeight.w100,
                      height: 1.0,
                      color: isDark
                          ? AppTextColorDark.regular
                          : AppTextColorLight.regular,
                    ),
                  ),
                  if (unitText.isNotEmpty)
                    Text(
                      unitText,
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: AppSpacings.scale(25),
                        fontWeight: FontWeight.w100,
                        height: 1.0,
                        color: isDark
                            ? AppTextColorDark.regular
                            : AppTextColorLight.regular,
                      ),
                    ),
                ],
              ),
              if (sublabel != null)
                Text(
                  sublabel!,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraLarge,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// Color panel (hue + saturation sliders)
// ============================================================================

class _ColorPanel extends StatelessWidget {
  final bool isLandscape;
  final double hue;
  final double saturation;
  final Function(double hue, double saturation) onChanged;

  const _ColorPanel({
    required this.isLandscape,
    required this.hue,
    required this.saturation,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();
    final currentHueColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    final hueSlider = SliderWithSteps(
      themeColor: ThemeColors.neutral,
      value: 1 - hue / 360,
      vertical: isLandscape,
      trackGradientColors: const [
        Color(0xFFFF0000),
        Color(0xFFFF00FF),
        Color(0xFF0000FF),
        Color(0xFF00FFFF),
        Color(0xFF00FF00),
        Color(0xFFFFFF00),
        Color(0xFFFF0000),
      ],
      thumbFillColor: AppColors.white,
      thumbBorderColor: currentHueColor,
      showSteps: false,
      onChanged: (v) => onChanged((1 - v) * 360, saturation),
    );

    final satSlider = SliderWithSteps(
      themeColor: ThemeColors.neutral,
      value: saturation,
      vertical: isLandscape,
      trackGradientColors: [AppColors.white, currentHueColor],
      thumbFillColor: AppColors.white,
      thumbBorderColor:
          HSVColor.fromAHSV(1, hue, saturation, 1).toColor(),
      showSteps: false,
      onChanged: (v) => onChanged(hue, v),
    );

    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay(color)),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pLg,
            ),
            child: SizedBox(
              width: AppSpacings.scale(52),
              child: hueSlider,
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pLg,
            ),
            child: SizedBox(
              width: AppSpacings.scale(52),
              child: satSlider,
            ),
          ),
        ],
      );
    } else {
      return Column(
        spacing: AppSpacings.pLg,
        children: [
          Expanded(
            flex: 2,
            child: _buildDisplay(color),
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pLg,
              vertical: AppSpacings.pMd,
            ),
            child: hueSlider,
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pLg,
              vertical: AppSpacings.pMd,
            ),
            child: satSlider,
          ),
        ],
      );
    }
  }

  Widget _buildDisplay(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        boxShadow: isLandscape
            ? null
            : [
                BoxShadow(
                  color: color.withValues(alpha: 0.4),
                  blurRadius: AppSpacings.scale(20),
                  spreadRadius: AppSpacings.scale(2),
                ),
              ],
      ),
    );
  }
}
