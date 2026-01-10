import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
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

/// Detail page for controlling all lights in a specific role
///
/// Uses the new LightingControlPanel widget for the UI while maintaining
/// the state machine logic for optimistic UI updates.
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

  // Role control states for each control type
  RoleControlState _brightnessState = const RoleControlState();
  RoleControlState _hueState = const RoleControlState();
  RoleControlState _temperatureState = const RoleControlState();
  RoleControlState _whiteState = const RoleControlState();
  RoleControlState _onOffState = const RoleControlState();

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

  // Debounce timers for sliders
  Timer? _brightnessDebounceTimer;
  Timer? _hueDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Track which control types had active intents
  bool _brightnessWasLocked = false;
  bool _colorWasLocked = false;
  bool _temperatureWasLocked = false;
  bool _whiteWasLocked = false;

  // Memoization cache for mixed state
  RoleMixedState? _cachedMixedState;
  String? _mixedStateCacheKey;

  @override
  void initState() {
    super.initState();

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

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
      _updateLockTrackingState();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get IntentOverlayService: $e');
    }

    try {
      _roleControlStateRepository = locator<RoleControlStateRepository>();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightRoleDetail] Failed to get RoleControlStateRepository: $e');
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
    _brightnessState.cancelTimer();
    _hueState.cancelTimer();
    _temperatureState.cancelTimer();
    _whiteState.cancelTimer();
    _onOffState.cancelTimer();
    _spacesService?.removeListener(_onSpacesDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  // ============================================================================
  // State Machine Helpers
  // ============================================================================

  void _startSettlingState(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (currentState.state != RoleUIState.pending) return;
    if (currentState.desiredValue == null) return;

    currentState.cancelTimer();

    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      updateState(const RoleControlState(state: RoleUIState.idle));
      return;
    }

    final timer = Timer(const Duration(milliseconds: LightingConstants.settlingWindowMs), () {
      if (!mounted) return;
      _onSettlingTimeout(currentState, updateState, targets, convergenceCheck, tolerance);
    });

    updateState(currentState.copyWith(
      state: RoleUIState.settling,
      settlingTimer: timer,
      settlingStartedAt: DateTime.now(),
    ));
  }

  void _onSettlingTimeout(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (!mounted) return;
    if (currentState.desiredValue == null) return;

    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      if (!mounted) return;
      setState(() {
        updateState(const RoleControlState(state: RoleUIState.idle));
      });
    } else {
      if (!mounted) return;
      setState(() {
        updateState(currentState.copyWith(
          state: RoleUIState.mixed,
          clearSettlingTimer: true,
          clearSettlingStartedAt: true,
        ));
      });
    }
  }

  void _checkConvergenceDuringSettling(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (currentState.state != RoleUIState.settling) return;
    if (currentState.desiredValue == null) return;

    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      currentState.cancelTimer();
      updateState(const RoleControlState(state: RoleUIState.idle));
    }
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

  void _updateLockTrackingState() {
    final targets = _getTargets();
    _brightnessWasLocked = _anyBrightnessLocked(targets);
    _colorWasLocked = _anyColorLocked(targets);
    _temperatureWasLocked = _anyTemperatureLocked(targets);
    _whiteWasLocked = _anyWhiteLocked(targets);
  }

  // ============================================================================
  // Data Listeners
  // ============================================================================

  void _onIntentChanged() {
    if (!mounted) return;

    final targets = _getTargets();

    final brightnessNowLocked = _anyBrightnessLocked(targets);
    final hueNowLocked = _anyColorLocked(targets);
    final temperatureNowLocked = _anyTemperatureLocked(targets);
    final whiteNowLocked = _anyWhiteLocked(targets);

    setState(() {
      if (_brightnessWasLocked && !brightnessNowLocked &&
          _brightnessState.state == RoleUIState.pending) {
        _startSettlingState(
          _brightnessState,
          (s) => _brightnessState = s,
          targets,
          _allBrightnessMatch,
          LightingConstants.brightnessTolerance,
        );
      }

      if (_colorWasLocked && !hueNowLocked &&
          _hueState.state == RoleUIState.pending) {
        _startSettlingState(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          LightingConstants.hueTolerance,
        );
      }

      if (_temperatureWasLocked && !temperatureNowLocked &&
          _temperatureState.state == RoleUIState.pending) {
        _startSettlingState(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          LightingConstants.temperatureTolerance,
        );
      }

      if (_whiteWasLocked && !whiteNowLocked &&
          _whiteState.state == RoleUIState.pending) {
        _startSettlingState(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          LightingConstants.whiteTolerance,
        );
      }
    });

    _brightnessWasLocked = brightnessNowLocked;
    _colorWasLocked = hueNowLocked;
    _temperatureWasLocked = temperatureNowLocked;
    _whiteWasLocked = whiteNowLocked;
  }

  void _onSpacesDataChanged() {
    if (mounted) {
      final targets = _getTargets();

      setState(() {
        _checkConvergenceDuringSettling(
          _brightnessState,
          (s) => _brightnessState = s,
          targets,
          _allBrightnessMatch,
          LightingConstants.brightnessTolerance,
        );
        _checkConvergenceDuringSettling(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          LightingConstants.hueTolerance,
        );
        _checkConvergenceDuringSettling(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          LightingConstants.temperatureTolerance,
        );
        _checkConvergenceDuringSettling(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          LightingConstants.whiteTolerance,
        );

        // Clear MIXED state if devices converge
        if (_brightnessState.state == RoleUIState.mixed &&
            _brightnessState.desiredValue != null &&
            _allBrightnessMatch(targets, _brightnessState.desiredValue!, LightingConstants.brightnessTolerance)) {
          _brightnessState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_hueState.state == RoleUIState.mixed &&
            _hueState.desiredValue != null &&
            _allHueMatch(targets, _hueState.desiredValue!, LightingConstants.hueTolerance)) {
          _hueState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_temperatureState.state == RoleUIState.mixed &&
            _temperatureState.desiredValue != null &&
            _allTemperatureMatch(targets, _temperatureState.desiredValue!, LightingConstants.temperatureTolerance)) {
          _temperatureState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_whiteState.state == RoleUIState.mixed &&
            _whiteState.desiredValue != null &&
            _allWhiteMatch(targets, _whiteState.desiredValue!, LightingConstants.whiteTolerance)) {
          _whiteState = const RoleControlState(state: RoleUIState.idle);
        }

        _updateCacheIfSynced(targets);
      });
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
    if (!roleMixedState.isMixed) return;

    final cached = _roleControlStateRepository?.get(_cacheKey);

    double? initialBrightness;
    double? initialHue;
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
            initialTemperature != null && initialWhite != null) {
          break;
        }
      }
    }

    if (!mounted) return;

    setState(() {
      final brightness = cached?.brightness ?? initialBrightness;
      if (brightness != null) {
        _brightnessState = RoleControlState(
          state: RoleUIState.idle,
          desiredValue: brightness,
        );
      }

      final hue = cached?.hue ?? initialHue;
      if (hue != null) {
        _hueState = RoleControlState(
          state: RoleUIState.idle,
          desiredValue: hue,
        );
      }

      final temperature = cached?.temperature ?? initialTemperature;
      if (temperature != null) {
        _temperatureState = RoleControlState(
          state: RoleUIState.idle,
          desiredValue: temperature,
        );
      }

      final white = cached?.white ?? initialWhite;
      if (white != null) {
        _whiteState = RoleControlState(
          state: RoleUIState.idle,
          desiredValue: white,
        );
      }
    });
  }

  void _saveToCache({
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    _roleControlStateRepository?.set(
      _cacheKey,
      brightness: brightness,
      hue: hue,
      temperature: temperature,
      white: white,
    );
  }

  void _updateCacheIfSynced(List<LightTargetView> targets) {
    final roleMixedState = _getRoleMixedState(targets);

    if (roleMixedState.isSynced && !roleMixedState.onStateMixed) {
      double? commonBrightness;
      double? commonHue;
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
          commonTemperature != null || commonWhite != null) {
        _roleControlStateRepository?.updateFromSync(
          _cacheKey,
          brightness: commonBrightness,
          hue: commonHue,
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


  // ============================================================================
  // Command Methods
  // ============================================================================

  Future<void> _toggleAllLights(List<LightTargetView> targets) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context);

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

      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = findLightChannel(device, target.channelId);
          if (channel == null) continue;

          final onProp = channel.onProp;
          properties.add(PropertyCommandItem(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: onProp.id,
            value: newState,
          ));
        }
      }

      if (properties.isEmpty) return;

      _pendingOnStateClearTimer?.cancel();
      _pendingOnStateClearTimer = null;
      _onOffState.cancelTimer();

      setState(() {
        _pendingOnState = newState;
        _onOffState = RoleControlState(
          state: RoleUIState.pending,
          desiredValue: newState ? 1.0 : 0.0,
        );
      });

      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      for (final property in properties) {
        _intentOverlayService?.createLocalOverlay(
          deviceId: property.deviceId,
          channelId: property.channelId,
          propertyId: property.propertyId,
          value: property.value,
          ttlMs: 5000,
        );
      }

      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to toggle lights',
      );
    } finally {
      if (mounted) {
        _onOffState.cancelTimer();

        final settlingTimer = Timer(const Duration(milliseconds: LightingConstants.onOffSettlingWindowMs), () {
          if (!mounted) {
            _pendingOnState = null;
            _onOffState = const RoleControlState();
            return;
          }

          final targets = _getTargets();
          final roleMixedState = _getRoleMixedState(targets);

          setState(() {
            _pendingOnState = null;
            if (roleMixedState.onStateMixed) {
              _onOffState = RoleControlState(
                state: RoleUIState.mixed,
                desiredValue: _onOffState.desiredValue,
              );
            } else {
              _onOffState = const RoleControlState();
            }
          });
        });

        setState(() {
          _onOffState = RoleControlState(
            state: RoleUIState.settling,
            desiredValue: _onOffState.desiredValue,
            settlingTimer: settlingTimer,
            settlingStartedAt: DateTime.now(),
          );
        });
      } else {
        _pendingOnState = null;
        _onOffState = const RoleControlState();
      }
    }
  }

  Future<void> _setSimplePropertyForAll({
    required List<LightTargetView> targets,
    required SimplePropertyType propertyType,
    required num value,
  }) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context);
    final propertyName = propertyType.name;

    try {
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final hasCapability = switch (propertyType) {
          SimplePropertyType.brightness => target.hasBrightness,
          SimplePropertyType.temperature => target.hasColorTemp,
          SimplePropertyType.white => true,
        };
        if (!hasCapability) continue;

        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
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

      if (properties.isEmpty) return;

      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to set $propertyName',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to set $propertyName',
      );
    }
  }

  Future<void> _setHueForAll(List<LightTargetView> targets, double hue) async {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final localizations = AppLocalizations.of(context);

    try {
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = findLightChannel(device, target.channelId);
          if (channel == null || !channel.hasColor) continue;

          // Prefer HSV hue if available
          final hueProp = channel.hueProp;
          if (hueProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: hueProp.id,
              value: hue.round(),
            ));
          } else if (channel.hasColorRed) {
            // Convert hue to RGB
            final color = HSVColor.fromAHSV(1.0, hue, 1.0, 1.0).toColor();

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

      if (properties.isEmpty) return;

      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to set color',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to set color',
      );
    }
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

    final newState = !channel.on;

    final displayRepository = locator<DisplayRepository>();
    final displayId = displayRepository.display?.id;

    final commandContext = PropertyCommandContext(
      origin: 'panel.system.room',
      displayId: displayId,
      spaceId: widget.roomId,
      roleKey: widget.role.name,
    );

    _intentOverlayService?.createLocalOverlay(
      deviceId: target.deviceId,
      channelId: target.channelId,
      propertyId: channel.onProp.id,
      value: newState,
      ttlMs: 5000,
    );

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
  }

  void _navigateToChannelDetail(LightingChannelData channelData) {
    final targets = _getTargets();
    final target = targets.firstWhere(
      (t) => t.channelId == channelData.id,
      orElse: () => targets.first,
    );

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(target.deviceId),
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
    int totalBrightness = 0;
    int brightnessCount = 0;
    int totalColorTemp = 0;
    int colorTempCount = 0;
    Color? avgColor;
    int totalWhite = 0;
    int whiteCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        channels.add(LightingChannelData(
          id: target.channelId,
          name: target.channelName,
          isOn: channel.on,
          brightness: channel.hasBrightness ? channel.brightness : 100,
          isOnline: device.isOnline,
        ));

        // Collect capabilities
        allCapabilities.add(LightCapability.power);
        if (channel.hasBrightness) allCapabilities.add(LightCapability.brightness);
        if (channel.hasTemperature) allCapabilities.add(LightCapability.colorTemp);
        if (channel.hasColor) allCapabilities.add(LightCapability.color);
        if (channel.hasColorWhite) allCapabilities.add(LightCapability.white);

        // Aggregate values from ON devices
        if (channel.on) {
          anyOn = true;

          if (channel.hasBrightness) {
            totalBrightness += channel.brightness;
            brightnessCount++;
          }

          if (channel.hasTemperature) {
            final tempProp = channel.temperatureProp;
            if (tempProp?.value is NumberValueType) {
              totalColorTemp += (tempProp!.value as NumberValueType).value.toInt();
              colorTempCount++;
            }
          }

          if (channel.hasColor) {
            final color = _getChannelColorSafe(channel);
            if (color != null) {
              avgColor = color; // Use first ON device's color for now
            }
          }

          if (channel.hasColorWhite) {
            totalWhite += channel.colorWhite;
            whiteCount++;
          }
        }
      }
    }

    // Calculate averages
    final avgBrightness = brightnessCount > 0 ? (totalBrightness / brightnessCount).round() : 100;
    final avgColorTemp = colorTempCount > 0 ? (totalColorTemp / colorTempCount).round() : 4000;
    final avgWhite = whiteCount > 0 ? (totalWhite / whiteCount).round() : 100;

    // Determine state based on state machine and mixed state
    final roleMixedState = _getRoleMixedState(targets);

    // Priority: SETTLING > MIXED (error) > device mixed (intentional)
    final isSettling = _brightnessState.isSettling ||
        _hueState.isSettling ||
        _temperatureState.isSettling ||
        _whiteState.isSettling ||
        _onOffState.isSettling;
    final isUnsynced = _brightnessState.isMixed ||
        _hueState.isMixed ||
        _temperatureState.isMixed ||
        _whiteState.isMixed ||
        _onOffState.isMixed;
    final isMixed = roleMixedState.isMixed;

    LightingState state;
    if (isSettling) {
      state = LightingState.synced; // Show as synced while settling
    } else if (isUnsynced) {
      state = LightingState.unsynced; // Settling timeout error
    } else if (isMixed) {
      state = LightingState.mixed; // Intentionally different values
    } else {
      state = LightingState.synced;
    }

    // Determine displayed values (use state machine values if locked)
    final displayBrightness = _brightnessState.isLocked
        ? (_brightnessState.desiredValue?.round() ?? avgBrightness)
        : avgBrightness;
    final displayColorTemp = _temperatureState.isLocked
        ? (_temperatureState.desiredValue?.round() ?? avgColorTemp)
        : avgColorTemp;
    final displayWhite = _whiteState.isLocked
        ? (_whiteState.desiredValue?.round() ?? avgWhite)
        : avgWhite;

    // Determine on/off state (use pending state if available)
    final displayIsOn = _pendingOnState ?? anyOn;

    // Get hue and convert to color if needed
    Color? displayColor = avgColor;
    double saturation = 1.0;
    if (_hueState.isLocked && _hueState.desiredValue != null) {
      displayColor = HSVColor.fromAHSV(1.0, _hueState.desiredValue!, 1.0, 1.0).toColor();
    }

    return LightingControlPanel(
      // Header
      title: _getRoleName(widget.role),
      subtitle: '${channels.length} ${channels.length == 1 ? 'channel' : 'channels'}',
      icon: getLightRoleIcon(widget.role),
      onBack: () => Navigator.pop(context),

      // Current values
      isOn: displayIsOn,
      brightness: displayBrightness,
      colorTemp: displayColorTemp,
      color: displayColor,
      saturation: saturation,
      whiteChannel: displayWhite,

      // Configuration
      capabilities: allCapabilities,
      state: state,
      channels: channels,

      // Callbacks
      onPowerToggle: () => _toggleAllLights(targets),
      onBrightnessChanged: (value) {
        setState(() {
          _brightnessState.cancelTimer();
          _brightnessState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value.toDouble(),
          );
        });
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
      },
      onColorTempChanged: (value) {
        setState(() {
          _temperatureState.cancelTimer();
          _temperatureState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value.toDouble(),
          );
        });
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
      },
      onColorChanged: (color, saturation) {
        final hue = HSVColor.fromColor(color).hue;
        setState(() {
          _hueState.cancelTimer();
          _hueState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: hue,
          );
        });
        _saveToCache(hue: hue);
        _hueDebounceTimer?.cancel();
        _hueDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () {
            if (!mounted) return;
            _setHueForAll(targets, hue);
          },
        );
      },
      onWhiteChannelChanged: (value) {
        setState(() {
          _whiteState.cancelTimer();
          _whiteState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value.toDouble(),
          );
        });
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
      },
      onChannelIconTap: (channel) => _toggleChannel(channel),
      onChannelTileTap: (channel) => _navigateToChannelDetail(channel),
      onSyncAll: () {
        // Sync all devices to current aggregated values
        final brightness = _brightnessState.desiredValue ?? avgBrightness.toDouble();
        _setSimplePropertyForAll(
          targets: targets,
          propertyType: SimplePropertyType.brightness,
          value: brightness.round(),
        );
      },
    );
  }
}
