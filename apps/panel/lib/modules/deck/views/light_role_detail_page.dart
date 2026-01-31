import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/deck/services/domain_control_state_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/control_ui_state.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Detail page for controlling all lights in a specific role.
///
/// Uses the [LightingControlPanel] widget for the UI while maintaining
/// the state machine logic for optimistic UI updates.
///
/// ## Backend Intent vs Direct Device Control
///
/// This page implements a two-tier control strategy for reliability:
///
/// 1. **Primary: Backend Intents** - When [SpacesService] is available and the role
///    maps to a valid [LightingStateRole], commands are sent via backend intents
///    (e.g., [SpacesService.setRoleBrightness], [SpacesService.setRoleColor]).
///    This allows the backend to orchestrate complex multi-device operations.
///
/// 2. **Fallback: Direct Device Control** - When backend intents are unavailable
///    (service not registered, role unmapped, or specific capability not supported),
///    commands are sent directly to individual devices via [DevicesService.setMultiplePropertyValues].
///    This ensures functionality even without backend support.
///
/// The fallback is implemented in methods like [_setPropertyViaDevices] and
/// [_setColorViaDevices], which iterate over all targets and build property
/// command lists for batch execution.
///
/// ## State Machine
///
/// Uses [DomainControlStateService] to track pending/settling/mixed states for each
/// control channel (brightness, hue, temperature, white, onOff). This provides:
/// - Optimistic UI updates during command execution
/// - Convergence detection when devices sync to target values
/// - Mixed state indication when devices fail to converge
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
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;
  RoleControlStateRepository? _roleControlStateRepository;
  DeviceControlStateService? _deviceControlStateService;

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  // Domain control state service for optimistic UI (role-level)
  late DomainControlStateService<LightTargetView> _controlStateService;

  // Pending on/off state for optimistic UI
  bool? _pendingOnState;
  Timer? _pendingOnStateClearTimer;

  // Cache key for this role
  String get _cacheKey => RoleControlStateRepository.generateKey(
        widget.roomId,
        'lighting',
        widget.role.name,
      );

  // Flag to track if we've loaded cached values
  bool _cacheLoaded = false;

  // Selected capability for mode selector
  LightCapability _selectedCapability = LightCapability.brightness;

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _hueDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Memoization cache for mixed state
  RoleMixedState? _cachedMixedState;
  String? _mixedStateCacheKey;

  @override
  void initState() {
    super.initState();

    // Initialize the control state service with lighting-specific config
    _controlStateService = DomainControlStateService<LightTargetView>(
      channelConfigs: {
        LightingConstants.brightnessChannelId: ControlChannelConfig(
          id: LightingConstants.brightnessChannelId,
          convergenceChecker: _checkBrightnessConvergence,
          intentLockChecker: _anyBrightnessLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.brightnessTolerance,
        ),
        LightingConstants.hueChannelId: ControlChannelConfig(
          id: LightingConstants.hueChannelId,
          convergenceChecker: _checkHueConvergence,
          intentLockChecker: _anyColorLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.hueTolerance,
        ),
        LightingConstants.saturationChannelId: ControlChannelConfig(
          id: LightingConstants.saturationChannelId,
          convergenceChecker: _checkSaturationConvergence,
          intentLockChecker: _anySaturationLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.saturationTolerance,
        ),
        LightingConstants.temperatureChannelId: ControlChannelConfig(
          id: LightingConstants.temperatureChannelId,
          convergenceChecker: _checkTemperatureConvergence,
          intentLockChecker: _anyTemperatureLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.temperatureTolerance,
        ),
        LightingConstants.whiteChannelId: ControlChannelConfig(
          id: LightingConstants.whiteChannelId,
          convergenceChecker: _checkWhiteConvergence,
          intentLockChecker: _anyWhiteLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.whiteTolerance,
        ),
        LightingConstants.onOffChannelId: ControlChannelConfig(
          id: LightingConstants.onOffChannelId,
          convergenceChecker: _checkOnOffConvergence,
          intentLockChecker: _anyOnOffLocked,
          settlingWindowMs: LightingConstants.onOffSettlingWindowMs,
          tolerance: 0.0, // On/off is exact match
        ),
      },
    );
    _controlStateService.addListener(_onRoleControlStateChanged);

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onSpacesDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get SpacesService: $e');
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get DevicesService: $e');
    }

    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    }

    try {
      _roleControlStateRepository = locator<RoleControlStateRepository>();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get RoleControlStateRepository: $e');
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get DeviceControlStateService: $e');
    }

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
    _intentOverlayService?.removeListener(_onIntentChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    _controlStateService.removeListener(_onRoleControlStateChanged);
    _controlStateService.dispose();
    super.dispose();
  }

  void _onControlStateChanged() {
    // Device control state changed - rebuild to reflect optimistic UI state
    if (mounted) {
      setState(() {});
    }
  }

  void _onRoleControlStateChanged() {
    // Role control state changed - rebuild to reflect optimistic UI state
    if (mounted) {
      setState(() {});
    }
  }

  // ============================================================================
  // DomainControlStateService Convergence Checkers
  // ============================================================================

  /// Wrapper for brightness convergence check (adapts _allBrightnessMatch signature).
  bool _checkBrightnessConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    return _allBrightnessMatch(targets, desiredValue, tolerance);
  }

  /// Wrapper for hue convergence check (adapts _allHueMatch signature).
  bool _checkHueConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    return _allHueMatch(targets, desiredValue, tolerance);
  }

  /// Wrapper for saturation convergence check (adapts _allSaturationMatch signature).
  bool _checkSaturationConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    return _allSaturationMatch(targets, desiredValue, tolerance);
  }

  /// Wrapper for temperature convergence check (adapts _allTemperatureMatch signature).
  bool _checkTemperatureConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    return _allTemperatureMatch(targets, desiredValue, tolerance);
  }

  /// Wrapper for white convergence check (adapts _allWhiteMatch signature).
  bool _checkWhiteConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    return _allWhiteMatch(targets, desiredValue, tolerance);
  }

  /// Check if on/off state has converged to desired value.
  bool _checkOnOffConvergence(
    List<LightTargetView> targets,
    double desiredValue,
    double tolerance,
  ) {
    final targetOn = desiredValue > LightingConstants.onOffThreshold;
    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel != null && channel.on != targetOn) {
          return false;
        }
      }
    }
    return true;
  }

  /// Check if any on/off property is locked by an intent.
  bool _anyOnOffLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        final onProp = channel.onProp;
        if (service.isPropertyLocked(target.deviceId, target.channelId, onProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================================
  // Intent Lock Tracking Helpers
  // ============================================================================

  bool _anyBrightnessLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      if (!target.hasBrightness) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        final brightnessProp = channel.brightnessProp;
        if (brightnessProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, brightnessProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  bool _anyColorLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        if (!channel.hasColor) continue;

        final hueProp = channel.hueProp;
        if (hueProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, hueProp.id)) {
          return true;
        }

        final redProp = channel.colorRedProp;
        if (redProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, redProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  bool _anySaturationLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        if (!channel.hasColor) continue;

        // Check HSV saturation property
        final satProp = channel.saturationProp;
        if (satProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, satProp.id)) {
          return true;
        }

        // For RGB mode, saturation is encoded in RGB values - check if any RGB property is locked
        // This is consistent with _anyColorLocked which checks both modes
        final redProp = channel.colorRedProp;
        if (redProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, redProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  bool _anyTemperatureLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      if (!target.hasColorTemp) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        final tempProp = channel.temperatureProp;
        if (tempProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, tempProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  bool _anyWhiteLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;
        if (!channel.hasColorWhite) continue;
        final whiteProp = channel.colorWhiteProp;
        if (whiteProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, whiteProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================================
  // Data Listeners
  // ============================================================================

  void _onIntentChanged() {
    if (!mounted) return;

    final targets = _getTargets();

    // Update intent lock status for all channels - this automatically
    // detects unlocks and triggers settling via the control state service
    _controlStateService.updateIntentLockStatus(
      LightingConstants.brightnessChannelId,
      targets,
    );
    _controlStateService.updateIntentLockStatus(
      LightingConstants.hueChannelId,
      targets,
    );
    _controlStateService.updateIntentLockStatus(
      LightingConstants.saturationChannelId,
      targets,
    );
    _controlStateService.updateIntentLockStatus(
      LightingConstants.temperatureChannelId,
      targets,
    );
    _controlStateService.updateIntentLockStatus(
      LightingConstants.whiteChannelId,
      targets,
    );
    _controlStateService.updateIntentLockStatus(
      LightingConstants.onOffChannelId,
      targets,
    );
  }

  void _onSpacesDataChanged() {
    if (mounted) {
      final targets = _getTargets();

      // Load cached values if devices are mixed and we haven't loaded them yet
      // or if they became mixed after initial load
      final roleMixedState = _getRoleMixedState(targets);
      if (roleMixedState.isMixed) {
        _loadCachedValuesIfNeeded(targets, roleMixedState);
      }

      // Check convergence for all channels - the service handles state transitions
      _controlStateService.checkConvergence(
        LightingConstants.brightnessChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        LightingConstants.hueChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        LightingConstants.saturationChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        LightingConstants.temperatureChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        LightingConstants.whiteChannelId,
        targets,
      );
      _controlStateService.checkConvergence(
        LightingConstants.onOffChannelId,
        targets,
      );

      _updateCacheIfSynced(targets);
      setState(() {});
    }
  }

  void _onDevicesDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  void _loadCachedValues() {
    if (_cacheLoaded) return;
    _cacheLoaded = true;

    final targets = _getTargets();
    if (targets.isEmpty) return;

    final roleMixedState = _getRoleMixedState(targets);
    _loadCachedValuesIfNeeded(targets, roleMixedState);
  }

  /// Load cached values when devices are in a mixed state.
  /// This can be called multiple times - it only sets values if they're not already set.
  void _loadCachedValuesIfNeeded(List<LightTargetView> targets, RoleMixedState roleMixedState) {
    if (!roleMixedState.isMixed) return;

    // Load cached values from repository
    final cached = _roleControlStateRepository?.get(_cacheKey);
    if (cached == null) return;

    // Get initial values from devices as fallback
    double? initialBrightness;
    double? initialHue;
    double? initialSaturation;
    double? initialTemperature;
    double? initialWhite;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        if (initialBrightness == null && channel.hasBrightness) {
          initialBrightness = channel.brightness.toDouble();
        }
        if (initialHue == null && channel.hasColor) {
          initialHue = _getChannelHue(channel);
        }
        if (initialSaturation == null && channel.hasColor) {
          final sat = _getChannelSaturation(channel);
          if (sat != null) {
            // Convert from 0-100 scale to 0.0-1.0 scale for cache
            initialSaturation = sat / 100.0;
          }
        }
        if (initialTemperature == null && channel.hasTemperature) {
          final tempProp = channel.temperatureProp;
          if (tempProp?.value is NumberValueType) {
            initialTemperature = (tempProp!.value as NumberValueType).value.toDouble();
          }
        }
        if (initialWhite == null && channel.hasColorWhite) {
          initialWhite = channel.colorWhite.toDouble();
        }

        if (initialBrightness != null && initialHue != null &&
            initialSaturation != null && initialTemperature != null && initialWhite != null) {
          break;
        }
      }
    }

    if (!mounted) return;

    // Set cached values (or initial values as fallback) in control state service
    // This ensures they're displayed when devices are in a mixed state
    // Only set if not already set (don't overwrite user actions)
    final brightness = cached.brightness ?? initialBrightness;
    if (brightness != null &&
        _controlStateService.getDesiredValue(LightingConstants.brightnessChannelId) == null) {
      _controlStateService.setMixed(
        LightingConstants.brightnessChannelId,
        brightness,
      );
    }

    final hue = cached.hue ?? initialHue;
    if (hue != null &&
        _controlStateService.getDesiredValue(LightingConstants.hueChannelId) == null) {
      _controlStateService.setMixed(
        LightingConstants.hueChannelId,
        hue,
      );
    }

    final saturation = cached.saturation ?? initialSaturation;
    if (saturation != null &&
        _controlStateService.getDesiredValue(LightingConstants.saturationChannelId) == null) {
      _controlStateService.setMixed(
        LightingConstants.saturationChannelId,
        saturation,
      );
    }

    final temperature = cached.temperature ?? initialTemperature;
    if (temperature != null &&
        _controlStateService.getDesiredValue(LightingConstants.temperatureChannelId) == null) {
      _controlStateService.setMixed(
        LightingConstants.temperatureChannelId,
        temperature,
      );
    }

    final white = cached.white ?? initialWhite;
    if (white != null &&
        _controlStateService.getDesiredValue(LightingConstants.whiteChannelId) == null) {
      _controlStateService.setMixed(
        LightingConstants.whiteChannelId,
        white,
      );
    }
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

  void _updateCacheIfSynced(List<LightTargetView> targets) {
    final roleMixedState = _getRoleMixedState(targets);

    if (roleMixedState.isSynced && !roleMixedState.onStateMixed) {
      double? commonBrightness;
      double? commonHue;
      double? commonSaturation;
      double? commonTemperature;
      double? commonWhite;

      for (final target in targets) {
        final device = _devicesService?.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          if (channel.on) {
            if (channel.hasBrightness) {
              commonBrightness = channel.brightness.toDouble();
            }
            if (channel.hasColor) {
              commonHue = _getChannelHue(channel);
              final sat = _getChannelSaturation(channel);
              if (sat != null) {
                // Convert from 0-100 scale to 0.0-1.0 scale for cache
                commonSaturation = sat / 100.0;
              }
            }
            if (channel.hasTemperature) {
              final tempProp = channel.temperatureProp;
              if (tempProp?.value is NumberValueType) {
                commonTemperature = (tempProp!.value as NumberValueType).value.toDouble();
              }
            }
            if (channel.hasColorWhite) {
              commonWhite = channel.colorWhite.toDouble();
            }
            break;
          }
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
  }

  // ============================================================================
  // Convergence Checks
  // ============================================================================

  bool _allBrightnessMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      if (!target.hasBrightness) continue;

      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasBrightness) {
          totalCount++;
          if ((channel.brightness - targetValue).abs() <= tolerance) {
            matchCount++;
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  bool _allHueMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColor && channel.on) {
          final hue = _getChannelHue(channel);
          if (hue != null) {
            totalCount++;
            if ((hue - targetValue).abs() <= tolerance) {
              matchCount++;
            }
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  bool _allSaturationMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    // targetValue is in 0.0-1.0 scale, device saturation is 0-100
    final targetSat = targetValue * 100.0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColor && channel.on) {
          final sat = _getChannelSaturation(channel);
          if (sat != null) {
            totalCount++;
            if ((sat - targetSat).abs() <= tolerance) {
              matchCount++;
            }
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  bool _allTemperatureMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasTemperature && channel.on) {
          final tempProp = channel.temperatureProp;
          if (tempProp != null && tempProp.value is NumberValueType) {
            totalCount++;
            final temp = (tempProp.value as NumberValueType).value.toDouble();
            if ((temp - targetValue).abs() <= tolerance) {
              matchCount++;
            }
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  bool _allWhiteMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColorWhite && channel.on) {
          totalCount++;
          if ((channel.colorWhite - targetValue).abs() <= tolerance) {
            matchCount++;
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  // ============================================================================
  // Mixed State
  // ============================================================================

  String _buildMixedStateCacheKey(List<LightTargetView> targets) {
    final parts = <String>[];
    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        parts.add('${target.channelId}:${channel.on}:${channel.brightness}');
      }
    }
    return parts.join('|');
  }

  RoleMixedState _getRoleMixedState(List<LightTargetView> targets) {
    final cacheKey = _buildMixedStateCacheKey(targets);
    if (cacheKey == _mixedStateCacheKey && _cachedMixedState != null) {
      return _cachedMixedState!;
    }

    bool? firstOnState;
    int? firstBrightness;
    double? firstHue;
    double? firstTemperature;
    int? firstWhite;

    bool onStateMixed = false;
    bool brightnessMixed = false;
    bool hueMixed = false;
    bool temperatureMixed = false;
    bool whiteMixed = false;
    int onCount = 0;
    int offCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        if (channel.on) {
          onCount++;
        } else {
          offCount++;
        }

        // Check on/off state
        if (firstOnState == null) {
          firstOnState = channel.on;
        } else if (channel.on != firstOnState) {
          onStateMixed = true;
        }

        // Only compare values for ON devices
        if (!channel.on) continue;

        // Check brightness
        if (channel.hasBrightness) {
          if (firstBrightness == null) {
            firstBrightness = channel.brightness;
          } else if ((channel.brightness - firstBrightness).abs() > LightingConstants.brightnessTolerance) {
            brightnessMixed = true;
          }
        }

        // Check hue
        if (channel.hasColor) {
          final hue = _getChannelHue(channel);
          if (hue != null) {
            if (firstHue == null) {
              firstHue = hue;
            } else if ((hue - firstHue).abs() > LightingConstants.hueTolerance) {
              hueMixed = true;
            }
          }
        }

        // Check temperature
        if (channel.hasTemperature) {
          final tempProp = channel.temperatureProp;
          if (tempProp != null && tempProp.value is NumberValueType) {
            final temp = (tempProp.value as NumberValueType).value.toDouble();
            if (firstTemperature == null) {
              firstTemperature = temp;
            } else if ((temp - firstTemperature).abs() > LightingConstants.temperatureTolerance) {
              temperatureMixed = true;
            }
          }
        }

        // Check white
        if (channel.hasColorWhite) {
          if (firstWhite == null) {
            firstWhite = channel.colorWhite;
          } else if ((channel.colorWhite - firstWhite).abs() > LightingConstants.whiteTolerance) {
            whiteMixed = true;
          }
        }
      }
    }

    final result = RoleMixedState(
      onStateMixed: onStateMixed,
      brightnessMixed: brightnessMixed,
      hueMixed: hueMixed,
      temperatureMixed: temperatureMixed,
      whiteMixed: whiteMixed,
      onCount: onCount,
      offCount: offCount,
    );

    _mixedStateCacheKey = cacheKey;
    _cachedMixedState = result;

    return result;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  List<LightTargetView> _getTargets() {
    return _spacesService
            ?.getLightTargetsForSpace(widget.roomId)
            .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
            .toList() ??
        [];
  }

  double? _getChannelHue(LightChannelView channel) {
    if (channel.hasHue) {
      final hueProp = channel.hueProp;
      if (hueProp?.value is NumberValueType) {
        return (hueProp!.value as NumberValueType).value.toDouble();
      }
    }
    if (channel.hasColorRed) {
      final color = _getChannelColorSafe(channel);
      if (color != null) {
        return ColorUtils.toHSV(color).hue;
      }
    }
    return null;
  }

  double? _getChannelSaturation(LightChannelView channel) {
    if (channel.hasSaturation) {
      return channel.saturation.toDouble();
    }
    if (channel.hasColorRed) {
      final color = _getChannelColorSafe(channel);
      if (color != null) {
        return HSVColor.fromColor(color).saturation * 100.0;
      }
    }
    return null;
  }

  Color? _getChannelColorSafe(LightChannelView channel) {
    try {
      if (channel.hasColorRed) {
        return ColorUtils.fromRGB(
          channel.colorRed,
          channel.colorGreen,
          channel.colorBlue,
        );
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Error getting color: $e');
    }
    return null;
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

    // Handle pending state for optimistic UI
    if (_pendingOnState != null) {
      return _pendingOnState! ? 'All lights on' : 'All lights off';
    }

    // All lights on
    if (mixedState.allOn) {
      return total == 1 ? '1 light on' : 'All lights on';
    }

    // All lights off
    if (mixedState.allOff) {
      return total == 1 ? '1 light off' : 'All lights off';
    }

    // Mixed state
    final onCount = mixedState.onCount;
    if (onCount == 1) {
      return '1 of $total lights on';
    }
    return '$onCount of $total lights on';
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  Future<void> _toggleAllLights(List<LightTargetView> targets) async {
    final devicesService = _devicesService;
    final spacesService = _spacesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);

    try {
      bool anyOn = false;
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = findLightChannel(device, target.channelId);
          if (channel != null && channel.on) {
            anyOn = true;
            break;
          }
        }
      }

      final newState = !anyOn;

      _pendingOnStateClearTimer?.cancel();
      _pendingOnStateClearTimer = null;

      // Set pending state using control state service
      _controlStateService.setPending(
        LightingConstants.onOffChannelId,
        newState ? LightingConstants.onValue : LightingConstants.offValue,
      );

      setState(() {
        _pendingOnState = newState;
      });

      // Set optimistic UI state for all devices
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = findLightChannel(device, target.channelId);
          if (channel == null) continue;

          final onProp = channel.onProp;
          _deviceControlStateService?.setPending(
            target.deviceId,
            target.channelId,
            onProp.id,
            newState,
          );
          _intentOverlayService?.createLocalOverlay(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: onProp.id,
            value: newState,
            ttlMs: 5000,
          );
        }
      }

      // Force immediate UI update
      if (mounted) setState(() {});

      // Use backend intent if available
      bool success = false;
      if (spacesService != null && stateRole != null) {
        final result = newState
            ? await spacesService.turnRoleOn(widget.roomId, stateRole)
            : await spacesService.turnRoleOff(widget.roomId, stateRole);
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      } else {
        // Fallback to direct device control
        final List<PropertyCommandItem> properties = [];
        for (final target in targets) {
          final device = devicesService.getDevice(target.deviceId);
          if (device is LightingDeviceView) {
            final channel = findLightChannel(device, target.channelId);
            if (channel == null) continue;
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.onProp.id,
              value: newState,
            ));
          }
        }
        if (properties.isNotEmpty) {
          final displayRepository = locator<DisplayRepository>();
          final displayId = displayRepository.display?.id;
          final commandContext = PropertyCommandContext(
            origin: 'panel.system.room',
            displayId: displayId,
            spaceId: widget.roomId,
            roleKey: widget.role.name,
          );
          success = await devicesService.setMultiplePropertyValues(
            properties: properties,
            context: commandContext,
          );
        } else {
          // No devices needed state change - this is not an error
          success = true;
        }
      }

      // Transition to settling state after command is sent
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = findLightChannel(device, target.channelId);
          if (channel == null) continue;
          _deviceControlStateService?.setSettling(
            target.deviceId,
            target.channelId,
            channel.onProp.id,
          );
        }
      }

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
        // Reset on error
        _controlStateService.setIdle(LightingConstants.onOffChannelId);
        setState(() {
          _pendingOnState = null;
        });
      } else {
        // Start settling via the control state service
        // The intent changed listener will handle the transition
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
      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
      _controlStateService.setIdle(LightingConstants.onOffChannelId);
      setState(() {
        _pendingOnState = null;
      });
    }
  }

  Future<void> _setAllLightsOff(List<LightTargetView> targets) async {
    await _setAllLightsPower(targets, false);
  }

  Future<void> _setAllLightsOn(List<LightTargetView> targets) async {
    await _setAllLightsPower(targets, true);
  }

  Future<void> _setAllLightsPower(List<LightTargetView> targets, bool on) async {
    final devicesService = _devicesService;
    final spacesService = _spacesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);

    try {
      // Use backend intent if available
      bool success = false;
      if (spacesService != null && stateRole != null) {
        final result = on
            ? await spacesService.turnRoleOn(widget.roomId, stateRole)
            : await spacesService.turnRoleOff(widget.roomId, stateRole);
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      } else {
        // Fallback to direct device control
        success = await _setPowerViaDevices(targets, on);
      }

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    }
  }

  /// Fallback method to set power directly on individual devices.
  ///
  /// Used when backend intents are unavailable:
  /// - [SpacesService] not registered
  /// - Role doesn't map to a [LightingStateRole]
  ///
  /// Returns `true` if command was sent successfully (or no devices needed update).
  Future<bool> _setPowerViaDevices(List<LightTargetView> targets, bool on) async {
    final devicesService = _devicesService;
    if (devicesService == null) return false;

    final localizations = AppLocalizations.of(context)!;
    final List<PropertyCommandItem> properties = [];
    int offlineCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        // Skip offline devices
        if (!device.isOnline) {
          offlineCount++;
          continue;
        }

        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;

        final onProp = channel.onProp;
        properties.add(PropertyCommandItem(
          deviceId: target.deviceId,
          channelId: target.channelId,
          propertyId: onProp.id,
          value: on,
        ));
      }
    }

    // If all devices are offline, show warning
    if (properties.isEmpty && offlineCount > 0) {
      if (mounted) {
        AlertBar.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AlertBar.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );

    // Set pending state for immediate optimistic UI
    for (final property in properties) {
      _deviceControlStateService?.setPending(
        property.deviceId,
        property.channelId,
        property.propertyId,
        property.value,
      );
      _intentOverlayService?.createLocalOverlay(
        deviceId: property.deviceId,
        channelId: property.channelId,
        propertyId: property.propertyId,
        value: property.value,
        ttlMs: 5000,
      );
    }

    // Force immediate UI update
    if (mounted) setState(() {});

    final success = await devicesService.setMultiplePropertyValues(
      properties: properties,
      context: commandContext,
    );

    // Transition to settling state after command is sent
    for (final property in properties) {
      _deviceControlStateService?.setSettling(
        property.deviceId,
        property.channelId,
        property.propertyId,
      );
    }

    return success;
  }

  Future<void> _setSimplePropertyForAll({
    required List<LightTargetView> targets,
    required SimplePropertyType propertyType,
    required num value,
  }) async {
    final devicesService = _devicesService;
    final spacesService = _spacesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);

    try {
      // Use backend intent if available
      bool success = false;
      if (spacesService != null && stateRole != null) {
        final intValue = value is double ? value.round() : value as int;
        switch (propertyType) {
          case SimplePropertyType.brightness:
            final result = await spacesService.setRoleBrightness(
              widget.roomId,
              stateRole,
              intValue,
            );
            success = result != null;
            if (mounted) {
              IntentResultHandler.showOfflineAlertIfNeeded(context, result);
            }
            break;
          case SimplePropertyType.temperature:
            final result = await spacesService.setRoleColorTemp(
              widget.roomId,
              stateRole,
              intValue,
            );
            success = result != null;
            if (mounted) {
              IntentResultHandler.showOfflineAlertIfNeeded(context, result);
            }
            break;
          case SimplePropertyType.white:
            // White channel not yet implemented in backend intents, use fallback
            success = await _setPropertyViaDevices(targets, propertyType, value);
            break;
        }
      } else {
        // Fallback to direct device control
        success = await _setPropertyViaDevices(targets, propertyType, value);
      }

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }
  }

  /// Fallback method to set a simple property (brightness/temperature/white)
  /// directly on individual devices.
  ///
  /// Used when backend intents are unavailable:
  /// - [SpacesService] not registered
  /// - Role doesn't map to a [LightingStateRole]
  /// - Specific property type not supported by backend (e.g., white channel)
  ///
  /// Iterates over all [targets], checks device capabilities, and builds a
  /// batch command list for [DevicesService.setMultiplePropertyValues].
  ///
  /// Returns `true` if command was sent successfully (or no devices needed update).
  Future<bool> _setPropertyViaDevices(
    List<LightTargetView> targets,
    SimplePropertyType propertyType,
    num value,
  ) async {
    final devicesService = _devicesService;
    if (devicesService == null) return false;

    final localizations = AppLocalizations.of(context)!;
    final List<PropertyCommandItem> properties = [];
    int offlineCount = 0;

    for (final target in targets) {
      final hasCapability = switch (propertyType) {
        SimplePropertyType.brightness => target.hasBrightness,
        SimplePropertyType.temperature => target.hasColorTemp,
        SimplePropertyType.white => true,
      };
      if (!hasCapability) continue;

      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        // Skip offline devices
        if (!device.isOnline) {
          offlineCount++;
          continue;
        }

        final channel = findLightChannel(device, target.channelId);
        if (channel == null) continue;

        final prop = switch (propertyType) {
          SimplePropertyType.brightness => channel.brightnessProp,
          SimplePropertyType.temperature => channel.temperatureProp,
          SimplePropertyType.white => channel.colorWhiteProp,
        };

        if (prop != null) {
          properties.add(PropertyCommandItem(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: prop.id,
            value: value is double ? value.round() : value,
          ));
        }
      }
    }

    // If all devices are offline, show warning
    if (properties.isEmpty && offlineCount > 0) {
      if (mounted) {
        AlertBar.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AlertBar.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );

    return devicesService.setMultiplePropertyValues(
      properties: properties,
      context: commandContext,
    );
  }

  Future<void> _setHueForAll(List<LightTargetView> targets, double hue, double saturation) async {
    await _setColorForAll(targets, hue, saturation);
  }

  Future<void> _setColorForAll(
      List<LightTargetView> targets, double hue, double saturation) async {
    final devicesService = _devicesService;
    final spacesService = _spacesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context)!;
    final stateRole = mapTargetRoleToStateRole(widget.role);

    try {
      // Convert hue + saturation to hex color for backend intent
      final color = HSVColor.fromAHSV(1.0, hue, saturation, 1.0).toColor();
      final r = (color.r * 255).toInt().toRadixString(16).padLeft(2, '0');
      final g = (color.g * 255).toInt().toRadixString(16).padLeft(2, '0');
      final b = (color.b * 255).toInt().toRadixString(16).padLeft(2, '0');
      final hexColor = '#$r$g$b'.toUpperCase();

      // Use backend intent if available
      bool success = false;
      if (spacesService != null && stateRole != null) {
        final result = await spacesService.setRoleColor(
          widget.roomId,
          stateRole,
          hexColor,
        );
        success = result != null;
        if (mounted) {
          IntentResultHandler.showOfflineAlertIfNeeded(context, result);
        }
      } else {
        // Fallback to direct device control
        success = await _setColorViaDevices(targets, hue, saturation);
      }

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }
  }

  /// Fallback method to set color directly on individual devices.
  ///
  /// Used when backend intents are unavailable (see class documentation).
  ///
  /// Handles two color representations:
  /// - **HSV**: If device supports hue property, sets hue and saturation directly
  /// - **RGB**: Otherwise, converts hue + saturation to RGB and sets red/green/blue properties
  ///
  /// Returns `true` if command was sent successfully (or no devices needed update).
  Future<bool> _setColorViaDevices(
      List<LightTargetView> targets, double hue, double saturation) async {
    final devicesService = _devicesService;
    if (devicesService == null) return false;

    final localizations = AppLocalizations.of(context)!;
    final List<PropertyCommandItem> properties = [];
    int offlineCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        // Skip offline devices
        if (!device.isOnline) {
          offlineCount++;
          continue;
        }

        final channel = findLightChannel(device, target.channelId);
        if (channel == null || !channel.hasColor) continue;

        // Prefer HSV hue/saturation if available
        final hueProp = channel.hueProp;
        final satProp = channel.saturationProp;
        if (hueProp != null) {
          properties.add(PropertyCommandItem(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: hueProp.id,
            value: hue.round(),
          ));
          // Also set saturation if device supports it
          if (satProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: satProp.id,
              value: (saturation * 100).round(),
            ));
          }
        } else if (channel.hasColorRed) {
          // Convert hue + saturation to RGB
          final color = HSVColor.fromAHSV(1.0, hue, saturation, 1.0).toColor();

          final redProp = channel.colorRedProp;
          final greenProp = channel.colorGreenProp;
          final blueProp = channel.colorBlueProp;

          if (redProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: redProp.id,
              value: (color.r * 255).toInt(),
            ));
          }
          if (greenProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: greenProp.id,
              value: (color.g * 255).toInt(),
            ));
          }
          if (blueProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: blueProp.id,
              value: (color.b * 255).toInt(),
            ));
          }
        }
      }
    }

    // If all devices are offline, show warning
    if (properties.isEmpty && offlineCount > 0) {
      if (mounted) {
        AlertBar.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AlertBar.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );

    return devicesService.setMultiplePropertyValues(
      properties: properties,
      context: commandContext,
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

    // Use overlay value if exists (for rapid taps), otherwise use actual state
    final currentOverlay = _intentOverlayService?.getOverlayValue(
      target.deviceId,
      target.channelId,
      channel.onProp.id,
    );
    final currentState = currentOverlay is bool ? currentOverlay : channel.on;
    final newState = !currentState;

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );

    // Set pending state for immediate optimistic UI (DeviceControlStateService)
    _deviceControlStateService?.setPending(
      target.deviceId,
      target.channelId,
      channel.onProp.id,
      newState,
    );

    // Create overlay for optimistic UI (IntentOverlayService - backup/settling)
    _intentOverlayService?.createLocalOverlay(
      deviceId: target.deviceId,
      channelId: target.channelId,
      propertyId: channel.onProp.id,
      value: newState,
      ttlMs: 5000,
    );

    // Force immediate UI update
    if (mounted) setState(() {});

    await devicesService.setMultiplePropertyValues(
      properties: [
        PropertyCommandItem(
          deviceId: target.deviceId,
          channelId: target.channelId,
          propertyId: channel.onProp.id,
          value: newState,
        ),
      ],
      context: commandContext,
    );

    // Transition to settling state after command is sent
    _deviceControlStateService?.setSettling(
      target.deviceId,
      target.channelId,
      channel.onProp.id,
    );
  }

  void _navigateToChannelDetail(LightingChannelData channelData) {
    final targets = _getTargets();
    final target = targets.firstWhere(
      (t) => t.channelId == channelData.id,
      orElse: () => targets.first,
    );

    // Get the actual device to find the correct channel ID from the devices module
    // (spaces module's channelId might differ from devices module's channel.id)
    final device = _devicesService?.getDevice(target.deviceId);
    String? deviceChannelId;
    if (device is LightingDeviceView) {
      // First try exact match with target.channelId
      final matchedChannel = device.lightChannels.cast<LightChannelView?>().firstWhere(
        (c) => c?.id == target.channelId,
        orElse: () => null,
      );
      if (matchedChannel != null) {
        deviceChannelId = matchedChannel.id;
      } else {
        // Fallback: try to find by name match
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
  // Build Methods
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

    // Build channels list
    final channels = <LightingChannelData>[];
    final allCapabilities = <LightCapability>{};
    bool anyOn = false;

    // Get room name for stripping from light names
    final roomName = spacesService.getSpace(widget.roomId)?.name ?? '';

    // Use first device's value for each capability (not average)
    // This avoids confusing users with values that don't match any real device
    int? firstBrightness;
    int? firstColorTemp;
    Color? firstColor;
    int? firstWhite;
    int? firstSaturation;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        // Use DeviceControlStateService first for optimistic UI (most reliable)
        // Fall back to IntentOverlayService, then actual device state
        bool isOn = channel.on;
        final controlStateService = _deviceControlStateService;
        final onProp = channel.onProp;

        if (controlStateService != null &&
            controlStateService.isLocked(target.deviceId, target.channelId, onProp.id)) {
          // Use desired value from control state service (immediate, no listener delay)
          final desiredValue = controlStateService.getDesiredValue(
            target.deviceId,
            target.channelId,
            onProp.id,
          );
          if (desiredValue is bool) {
            isOn = desiredValue;
          }
        } else if (_intentOverlayService != null &&
            _intentOverlayService!.isPropertyLocked(target.deviceId, target.channelId, onProp.id)) {
          // Fall back to intent overlay service
          final overlayValue = _intentOverlayService!.getOverlayValue(
            target.deviceId,
            target.channelId,
            onProp.id,
          );
          if (overlayValue is bool) {
            isOn = overlayValue;
          }
        }

        channels.add(LightingChannelData(
          id: target.channelId,
          name: getLightTargetDisplayName(target, targets, roomName),
          isOn: isOn,
          brightness: channel.hasBrightness ? channel.brightness : 100,
          hasBrightness: channel.hasBrightness,
          isOnline: device.isOnline,
        ));

        // Collect capabilities
        allCapabilities.add(LightCapability.power);
        if (channel.hasBrightness) allCapabilities.add(LightCapability.brightness);
        if (channel.hasTemperature) allCapabilities.add(LightCapability.colorTemp);
        if (channel.hasColor) allCapabilities.add(LightCapability.color);
        if (channel.hasColorWhite) allCapabilities.add(LightCapability.white);

        // Track if any device is on (use optimistic value)
        if (isOn) {
          anyOn = true;
        }

        // Use first device's value for each capability
        if (channel.hasBrightness && firstBrightness == null) {
          firstBrightness = channel.brightness;
        }

        if (channel.hasTemperature && firstColorTemp == null) {
          final tempProp = channel.temperatureProp;
          if (tempProp?.value is NumberValueType) {
            firstColorTemp = (tempProp!.value as NumberValueType).value.toInt();
          }
        }

        if (channel.hasColor && firstColor == null) {
          firstColor = _getChannelColorSafe(channel);
        }

        if (channel.hasColorWhite && firstWhite == null) {
          firstWhite = channel.colorWhite;
        }

        if (channel.hasSaturation && firstSaturation == null) {
          firstSaturation = channel.saturation;
        }
      }
    }

    // Use first device values (with defaults if no device has the capability)
    final baseBrightness = firstBrightness ?? 100;
    final baseColorTemp = firstColorTemp ?? 4000;
    final baseColor = firstColor;
    final baseWhite = firstWhite ?? 100;
    final baseSaturation = firstSaturation ?? 100;

    // Determine state based on device values and state machine
    final roleMixedState = _getRoleMixedState(targets);

    // Helper to check channel state from control state service
    bool isChannelSettling(String channelId) {
      final state = _controlStateService.getState(channelId);
      return state?.state == ControlUIState.settling;
    }

    bool isChannelMixed(String channelId) {
      final state = _controlStateService.getState(channelId);
      return state?.state == ControlUIState.mixed;
    }

    // Check if we're actively settling (waiting for device sync)
    final isSettling = isChannelSettling(LightingConstants.brightnessChannelId) ||
        isChannelSettling(LightingConstants.hueChannelId) ||
        isChannelSettling(LightingConstants.saturationChannelId) ||
        isChannelSettling(LightingConstants.temperatureChannelId) ||
        isChannelSettling(LightingConstants.whiteChannelId) ||
        isChannelSettling(LightingConstants.onOffChannelId);

    // Check if any role control state shows a sync error
    // (settling timer expired without convergence - only happens after user made a role command)
    final hasSyncError = isChannelMixed(LightingConstants.brightnessChannelId) ||
        isChannelMixed(LightingConstants.hueChannelId) ||
        isChannelMixed(LightingConstants.saturationChannelId) ||
        isChannelMixed(LightingConstants.temperatureChannelId) ||
        isChannelMixed(LightingConstants.whiteChannelId) ||
        isChannelMixed(LightingConstants.onOffChannelId);

    // Device values are mixed (some lights have different values)
    final devicesMixed = roleMixedState.isMixed;

    // State determination:
    // - synced: while actively settling, or all devices have same values
    // - unsynced: user made a role command and settling expired without convergence
    // - mixed: devices have different values (informational)
    LightingState state;
    if (isSettling) {
      state = LightingState.synced;
    } else if (hasSyncError) {
      state = LightingState.unsynced;
    } else if (devicesMixed) {
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

    // Determine on/off state (use pending state if available)
    final displayIsOn = _pendingOnState ?? anyOn;

    // Get saturation - check pending state first, then device property, then extract from RGB color
    double saturation;
    final satDesiredValue =
        _controlStateService.getDesiredValue(LightingConstants.saturationChannelId);
    if (_controlStateService.isLocked(LightingConstants.saturationChannelId) &&
        satDesiredValue != null) {
      // Use pending saturation value (already in 0.0-1.0 scale from callback)
      saturation = (satDesiredValue as num).toDouble();
    } else if (firstSaturation != null) {
      // HSV mode: use saturation property (0-100 scale, convert to 0.0-1.0)
      saturation = baseSaturation / 100.0;
    } else if (baseColor != null) {
      // RGB mode: extract saturation from the current color
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
      // Saturation changed but not hue - rebuild color with new saturation
      final baseHue = HSVColor.fromColor(baseColor).hue;
      displayColor =
          HSVColor.fromAHSV(1.0, baseHue, saturation, 1.0).toColor();
    }

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark, displayIsOn, roleMixedState, () => _toggleAllLights(targets)),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  final isLandscape = orientation == Orientation.landscape;

                  // Callbacks for value changes
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
                          targets: targets,
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
                          targets: targets,
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
                        _setColorForAll(targets, hue, saturationValue);
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
                          targets: targets,
                          propertyType: SimplePropertyType.white,
                          value: value,
                        );
                      },
                    );
                  }

                  void onSyncAll() {
                    if (!displayIsOn) {
                      _setAllLightsOff(targets);
                      return;
                    }
                    _setAllLightsOn(targets);
                    if (allCapabilities.contains(LightCapability.brightness)) {
                      _setSimplePropertyForAll(
                        targets: targets,
                        propertyType: SimplePropertyType.brightness,
                        value: displayBrightness,
                      );
                    }
                    if (allCapabilities.contains(LightCapability.colorTemp)) {
                      _setSimplePropertyForAll(
                        targets: targets,
                        propertyType: SimplePropertyType.temperature,
                        value: displayColorTemp,
                      );
                    }
                    if (allCapabilities.contains(LightCapability.color) && baseColor != null) {
                      final hue = _controlStateService.getDesiredValue(LightingConstants.hueChannelId) ??
                          HSVColor.fromColor(baseColor).hue;
                      _setHueForAll(targets, hue, saturation);
                    }
                    if (allCapabilities.contains(LightCapability.white)) {
                      _setSimplePropertyForAll(
                        targets: targets,
                        propertyType: SimplePropertyType.white,
                        value: displayWhite,
                      );
                    }
                  }

                  // Helper to check if simple device (power only)
                  final isSimple = allCapabilities.length == 1 &&
                      allCapabilities.contains(LightCapability.power);

                  // Get enabled capabilities (excluding power)
                  final enabledCapabilities = [
                    LightCapability.brightness,
                    LightCapability.colorTemp,
                    LightCapability.color,
                    LightCapability.white,
                  ].where((cap) => allCapabilities.contains(cap)).toList();

                  // Ensure selected capability is valid
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
                    // Build additional content (presets + channels)
                    final additionalContent = Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (showPresets)
                          LightingPresetsPanel(
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
                          ),
                        if (showPresets) SizedBox(height: AppSpacings.pLg),
                        LightingChannelsList(
                          channels: channels,
                          state: state,
                          isLandscape: true,
                          onChannelIconTap: (channel) => _toggleChannel(channel),
                          onChannelTileTap: (channel) => _navigateToChannelDetail(channel),
                          onSyncAll: onSyncAll,
                        ),
                      ],
                    );

                    return LandscapeViewLayout(
                      mainContentPadding: EdgeInsets.zero,
                      mainContent: LightingMainControl(
                        selectedCapability: _selectedCapability,
                        isOn: displayIsOn,
                        brightness: displayBrightness,
                        colorTemp: displayColorTemp,
                        color: displayColor,
                        saturation: saturation,
                        whiteChannel: displayWhite,
                        capabilities: allCapabilities,
                        isLandscape: true,
                        onPowerToggle: () => _toggleAllLights(targets),
                        onBrightnessChanged: onBrightnessChanged,
                        onColorTempChanged: onColorTempChanged,
                        onColorChanged: onColorChanged,
                        onWhiteChannelChanged: onWhiteChannelChanged,
                      ),
                      modeSelector: showModeSelector
                          ? LightingModeSelector(
                              capabilities: allCapabilities,
                              selectedCapability: _selectedCapability,
                              onCapabilityChanged: (value) {
                                setState(() => _selectedCapability = value);
                              },
                              isVertical: true,
                            )
                          : null,
                      additionalContent: additionalContent,
                    );
                  }

                  // Portrait layout - build main content
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
                      // Main control
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
                          onPowerToggle: () => _toggleAllLights(targets),
                          onBrightnessChanged: onBrightnessChanged,
                          onColorTempChanged: onColorTempChanged,
                          onColorChanged: onColorChanged,
                          onWhiteChannelChanged: onWhiteChannelChanged,
                        ),
                      ),
                      // Presets
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
                    contentPadding: AppSpacings.paddingLg,
                    scrollable: false,
                    content: mainContent,
                    stickyBottom: LightingChannelsList(
                      channels: channels,
                      state: state,
                      isLandscape: false,
                      onChannelIconTap: (channel) => _toggleChannel(channel),
                      onChannelTileTap: (channel) => _navigateToChannelDetail(channel),
                      onSyncAll: onSyncAll,
                    ),
                    useStickyBottomPadding: false,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    bool isDark,
    bool isOn,
    RoleMixedState roleMixedState,
    VoidCallback onPowerToggle,
  ) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final inactiveBgColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final inactiveIconColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _getRoleName(widget.role),
      subtitle: _getLightStateSubtitle(roleMixedState),
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.pop(context),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: isOn ? primaryBgColor : inactiveBgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              getLightRoleIcon(widget.role),
              color: isOn ? primaryColor : inactiveIconColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: GestureDetector(
        onTap: onPowerToggle,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: _scale(48),
          height: _scale(32),
          decoration: BoxDecoration(
            color: isOn
                ? primaryColor
                : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
            borderRadius: BorderRadius.circular(AppBorderRadius.round),
            border: (!isOn && !isDark)
                ? Border.all(color: AppBorderColorLight.base, width: _scale(1))
                : null,
          ),
          child: Icon(
            MdiIcons.power,
            size: _scale(18),
            color: isOn
                ? AppColors.white
                : (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
          ),
        ),
      ),
    );
  }
}
