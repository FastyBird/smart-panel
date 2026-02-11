import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
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
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;
  RoleControlStateRepository? _roleControlStateRepository;
  DeviceControlStateService? _deviceControlStateService;

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
          convergenceChecker: _allBrightnessMatch,
          intentLockChecker: _anyBrightnessLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.brightnessTolerance,
        ),
        LightingConstants.hueChannelId: ControlChannelConfig(
          id: LightingConstants.hueChannelId,
          convergenceChecker: _allHueMatch,
          intentLockChecker: _anyColorLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.hueTolerance,
        ),
        LightingConstants.saturationChannelId: ControlChannelConfig(
          id: LightingConstants.saturationChannelId,
          convergenceChecker: _allSaturationMatch,
          intentLockChecker: _anySaturationLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.saturationTolerance,
        ),
        LightingConstants.temperatureChannelId: ControlChannelConfig(
          id: LightingConstants.temperatureChannelId,
          convergenceChecker: _allTemperatureMatch,
          intentLockChecker: _anyTemperatureLocked,
          settlingWindowMs: LightingConstants.settlingWindowMs,
          tolerance: LightingConstants.temperatureTolerance,
        ),
        LightingConstants.whiteChannelId: ControlChannelConfig(
          id: LightingConstants.whiteChannelId,
          convergenceChecker: _allWhiteMatch,
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

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onSpacesDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDevicesDataChanged));
    if (locator.isRegistered<IntentOverlayService>()) {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
    }
    _roleControlStateRepository = _tryLocator<RoleControlStateRepository>('RoleControlStateRepository');
    _deviceControlStateService = _tryLocator<DeviceControlStateService>('DeviceControlStateService', onSuccess: (s) => s.addListener(_onControlStateChanged));

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
  // Convergence checkers (used by DomainControlStateService for settling → idle)
  // ============================================================================

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
  // Intent lock helpers (detect when another intent holds a property)
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
  // Data listeners (SpacesService, DevicesService, IntentOverlayService)
  // ============================================================================

  void _onIntentChanged() {
    if (!mounted) return;

    final targets = _getTargets();
    for (final channelId in _controlChannelIds) {
      _controlStateService.updateIntentLockStatus(channelId, targets);
    }
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
      for (final channelId in _controlChannelIds) {
        _controlStateService.checkConvergence(channelId, targets);
      }

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
  // Cache management (RoleControlStateRepository for mixed-state persistence)
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
  // Convergence checks (device values vs desired value, within tolerance)
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
  // Mixed state (detect when devices have different values)
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
  // Helpers (targets, channel values, role name, state subtitle)
  // ============================================================================

  /// Creates the command context for device property updates (origin, display, space, role).
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
  // Command methods (backend intents with device fallback)
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
          success = await devicesService.setMultiplePropertyValues(
            properties: properties,
            context: _createCommandContext(),
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
        AppToast.showError(
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
      AppToast.showError(
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
        AppToast.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.showError(
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
        AppToast.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AppToast.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

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
      context: _createCommandContext(),
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
        AppToast.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(
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
        AppToast.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AppToast.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

    return devicesService.setMultiplePropertyValues(
      properties: properties,
      context: _createCommandContext(),
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
        AppToast.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.showError(
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
        AppToast.showWarning(
          context,
          message: localizations.all_devices_offline,
        );
      }
      return false;
    }

    if (properties.isEmpty) return true; // No devices to update

    // Show info if some devices were skipped
    if (offlineCount > 0 && mounted) {
      AppToast.showInfo(
        context,
        message: localizations.devices_offline_skipped(offlineCount),
      );
    }

    return devicesService.setMultiplePropertyValues(
      properties: properties,
      context: _createCommandContext(),
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

    // Force immediate UI update (and refresh channels sheet if open)
    if (mounted) {
      setState(() {});
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

    _lastChannels = List.of(channels);

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
              () => _toggleAllLights(targets),
            ),
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
                  _onSyncAllCallback = onSyncAll;

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
                    // Build additional content (presets only; channels are in the bottom sheet)
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
                              onPowerToggle: () => _toggleAllLights(targets),
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

                  // Portrait layout - build main content
                  final mainContent = Column(
                    spacing: AppSpacings.pMd,
                    children: [
                      // Mode selector
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

  /// Shows the channels bottom sheet (individual light toggles + sync/retry).
  void _showChannelsSheet(List<LightingChannelData> channels) {
    if (channels.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;

    DeckItemSheet.showItemSheetWithUpdates(
      context,
      title: localizations.domain_lights,
      icon: MdiIcons.lightbulbGroup,
      rebuildWhen: _channelsSheetRebuildNotifier,
      getItemCount: () => _lastChannels?.length ?? 0,
      itemBuilder: (c, i) => _buildChannelTileForSheet(c, _lastChannels![i]),
      showCountInHeader: false,
      bottomSection: _currentUiState == LightingState.synced ? null : ListenableBuilder(
        listenable: _channelsSheetRebuildNotifier,
        builder: (ctx, _) => _buildChannelsSheetBottomSection(ctx),
      ),
    );
  }

  /// Builds the bottom section of the channels sheet: Sync all (info) / Retry (warning) FilledButton.
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
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg, vertical: AppSpacings.pMd),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              _onSyncAllCallback?.call();
              _channelsSheetRebuildNotifier.value++;
            },
            child: Text(label),
          ),
        ),
      ),
    );
  }

  /// Builds one channel tile for the channels bottom sheet (horizontal layout).
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
// These widgets are used only by LightRoleDetailPage for the lighting role UI.
// ============================================================================

/// UI state for the lighting control (synced, mixed, or unsynced).
enum LightingState {
  /// All values are synced
  synced,

  /// Values are mixed (different across channels)
  mixed,

  /// Values are not synced with device
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

  /// Get status text for display
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
///
/// For simple devices (power-only), shows a large power button.
/// For other capabilities, shows the appropriate slider or picker.
class LightingMainControl extends StatelessWidget {
  /// Currently selected capability to display
  final LightCapability selectedCapability;

  /// Whether the light is on
  final bool isOn;

  /// Current brightness (0-100)
  final int brightness;

  /// Current color temperature in Kelvin
  final int colorTemp;

  /// Current color
  final Color? color;

  /// Current saturation (0.0-1.0)
  final double saturation;

  /// Current white channel value (0-100)
  final int? whiteChannel;

  /// Set of available capabilities (used to detect simple/power-only devices)
  final Set<LightCapability> capabilities;

  /// Whether to use landscape layout
  final bool isLandscape;

  /// Called when power is toggled
  final VoidCallback? onPowerToggle;

  /// Called when brightness changes
  final ValueChanged<int>? onBrightnessChanged;

  /// Called when color temperature changes
  final ValueChanged<int>? onColorTempChanged;

  /// Called when color changes (color, saturation)
  final Function(Color, double)? onColorChanged;

  /// Called when white channel changes
  final ValueChanged<int>? onWhiteChannelChanged;

  LightingMainControl({
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

  /// Check if this is a simple device (only power capability)
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
                        ? localizations.on_state_on
                        : localizations.on_state_off,
                    style: TextStyle(
                      fontSize: AppSpacings.scale(26),
                      fontWeight: FontWeight.w300,
                      color: isOn ? primaryColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Text(
            infoText,
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary,
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
          isDark: isDark,
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

  _SliderPanel({
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
    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay()),
          _buildVerticalSlider(),
        ],
      );
    } else {
      return Column(
          spacing: AppSpacings.pMd,
          children: [
            Expanded(child: _buildDisplay()),
            _buildHorizontalSlider(),
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

  Widget _buildVerticalSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      width: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - progress);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final progress = (value - minValue) / (maxValue - minValue);

    return SizedBox(
      height: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              final newValue =
                  (minValue + (maxValue - minValue) * clampedProgress).round();
              onChanged(newValue);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: gradientColors,
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: AppSpacings.scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: AppSpacings.scale(8),
            offset: Offset(0, AppSpacings.scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2/3,
          height: size * 2/3,
          decoration: BoxDecoration(
            color: thumbColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
  final bool isDark;
  final double hue;
  final double saturation;
  final Function(double hue, double saturation) onChanged;

  _ColorPanel({
    required this.isLandscape,
    required this.isDark,
    required this.hue,
    required this.saturation,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final color = HSVColor.fromAHSV(1, hue, saturation, 1).toColor();

    if (isLandscape) {
      return Row(
        spacing: AppSpacings.pMd,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildDisplay(color)),
          _buildVerticalHueSlider(),
          _buildVerticalSatSlider(),
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
          _buildHorizontalHueSlider(),
          _buildHorizontalSatSlider(),
        ],
      );
    }
  }

  Widget _buildDisplay(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: AppSpacings.scale(20),
            spreadRadius: AppSpacings.scale(2),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalHueSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      width: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * progress;

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVerticalSatSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      width: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackHeight = math.max(1.0, constraints.maxHeight - thumbSize - padding * 2);
          final thumbOffset = trackHeight * (1 - saturation);

          return GestureDetector(
            onVerticalDragUpdate: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  1 - (details.localPosition.dy - padding - thumbSize / 2) / trackHeight;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [currentColor, AppColors.white],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: padding + thumbOffset,
                    left: padding,
                    right: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalHueSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final progress = hue / 360;

    return SizedBox(
      height: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * progress;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            onTapDown: (details) {
              final newProgress =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              final clampedProgress = newProgress.clamp(0.0, 1.0);
              onChanged(clampedProgress * 360, saturation);
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFF0000),
                    Color(0xFFFFFF00),
                    Color(0xFF00FF00),
                    Color(0xFF00FFFF),
                    Color(0xFF0000FF),
                    Color(0xFFFF00FF),
                    Color(0xFFFF0000),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(
                        thumbSize, HSVColor.fromAHSV(1, hue, 1, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHorizontalSatSlider() {
    final thumbSize = AppSpacings.scale(44);
    final padding = AppSpacings.pSm;
    final currentColor = HSVColor.fromAHSV(1, hue, 1, 1).toColor();

    return SizedBox(
      height: AppSpacings.scale(52),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackWidth = math.max(1.0, constraints.maxWidth - thumbSize - padding * 2);
          final thumbOffset = trackWidth * saturation;

          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            onTapDown: (details) {
              final newSat =
                  (details.localPosition.dx - padding - thumbSize / 2) / trackWidth;
              onChanged(hue, newSat.clamp(0.0, 1.0));
            },
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.white, currentColor],
                ),
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: isDark
                    ? null
                    : Border.all(
                        color: AppBorderColorLight.darker,
                        width: AppSpacings.scale(1),
                      ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: padding + thumbOffset,
                    top: padding,
                    bottom: padding,
                    child: _buildThumb(thumbSize,
                        HSVColor.fromAHSV(1, hue, saturation, 1).toColor()),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildThumb(double size, Color color) {
    final borderColor =
        isDark ? AppTextColorDark.primary : AppBorderColorLight.base;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: AppSpacings.scale(3),
        ),
        boxShadow: [
          BoxShadow(
            color: AppShadowColor.medium,
            blurRadius: AppSpacings.scale(8),
            offset: Offset(0, AppSpacings.scale(2)),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: size * 2/3,
          height: size * 2/3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
        ),
      ),
    );
  }
}

