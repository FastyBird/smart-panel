import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for fan channel with optimistic UI support.
///
/// Wraps [FanChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
///
/// Usage:
/// ```dart
/// final controller = FanChannelController(
///   deviceId: device.id,
///   channel: device.fanChannel,
///   controlState: deviceControlStateService,
///   devicesService: devicesService,
/// );
///
/// // Read values (returns optimistic value when locked)
/// final isOn = controller.isOn;
///
/// // Execute commands (automatically handles optimistic UI)
/// controller.setPower(true);
/// ```
class FanChannelController {
  final String deviceId;
  final FanChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  FanChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether the fan is on (optimistic-aware).
  bool get isOn {
    if (_controlState.isLocked(deviceId, channel.id, channel.onProp.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, channel.onProp.id)
              as bool?;
      if (value != null) return value;
    }
    return channel.on;
  }

  /// Whether swing is enabled (optimistic-aware).
  bool get swing {
    final prop = channel.swingProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id) as bool?;
      if (value != null) return value;
    }
    return channel.swing;
  }

  /// Current speed value (optimistic-aware, for numeric speed).
  double get speed {
    final prop = channel.speedProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toDouble();
    }
    return channel.speed;
  }

  /// Current speed level (optimistic-aware, for enum-based speed).
  FanSpeedLevelValue? get speedLevel {
    final prop = channel.speedProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && FanSpeedLevelValue.contains(value)) {
        return FanSpeedLevelValue.fromValue(value);
      }
    }
    return channel.speedLevel;
  }

  /// Current direction (optimistic-aware).
  FanDirectionValue? get direction {
    final prop = channel.directionProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && FanDirectionValue.contains(value)) {
        return FanDirectionValue.fromValue(value);
      }
    }
    return channel.direction;
  }

  /// Current mode (optimistic-aware).
  FanModeValue? get mode {
    final prop = channel.modeProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && FanModeValue.contains(value)) {
        return FanModeValue.fromValue(value);
      }
    }
    return channel.mode;
  }

  /// Whether child lock is enabled (optimistic-aware).
  bool get locked {
    final prop = channel.lockedProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id) as bool?;
      if (value != null) return value;
    }
    return channel.locked;
  }

  /// Whether natural breeze is enabled (optimistic-aware).
  bool get naturalBreeze {
    final prop = channel.naturalBreezeProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id) as bool?;
      if (value != null) return value;
    }
    return channel.naturalBreeze;
  }

  /// Current timer value in minutes (optimistic-aware, for numeric timer).
  int get timer {
    final prop = channel.timerProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.timer;
  }

  /// Current timer preset (optimistic-aware, for enum-based timer).
  FanTimerPresetValue? get timerPreset {
    final prop = channel.timerProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && FanTimerPresetValue.contains(value)) {
        return FanTimerPresetValue.fromValue(value);
      }
    }
    return channel.timerPreset;
  }

  // ===========================================================================
  // PASSTHROUGH GETTERS (no optimistic state needed)
  // ===========================================================================

  bool get hasSwing => channel.hasSwing;
  bool get hasSpeed => channel.hasSpeed;
  bool get isSpeedNumeric => channel.isSpeedNumeric;
  bool get isSpeedEnum => channel.isSpeedEnum;
  double get minSpeed => channel.minSpeed;
  double get maxSpeed => channel.maxSpeed;
  double get speedStep => channel.speedStep;
  List<FanSpeedLevelValue> get availableSpeedLevels =>
      channel.availableSpeedLevels;
  bool get hasDirection => channel.hasDirection;
  bool get hasMode => channel.hasMode;
  List<FanModeValue> get availableModes => channel.availableModes;
  bool get hasLocked => channel.hasLocked;
  bool get hasNaturalBreeze => channel.hasNaturalBreeze;
  bool get hasTimer => channel.hasTimer;
  bool get isTimerNumeric => channel.isTimerNumeric;
  bool get isTimerEnum => channel.isTimerEnum;
  int get minTimer => channel.minTimer;
  int get maxTimer => channel.maxTimer;
  int get timerStep => channel.timerStep;
  List<FanTimerPresetValue> get availableTimerPresets =>
      channel.availableTimerPresets;

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /// Set power state with optimistic UI.
  void setPower(bool value) {
    final prop = channel.onProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Toggle power state with optimistic UI.
  void togglePower() {
    setPower(!isOn);
  }

  /// Set swing state with optimistic UI.
  void setSwing(bool value) {
    final prop = channel.swingProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set numeric speed with optimistic UI.
  void setSpeed(double value) {
    final prop = channel.speedProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set speed level (enum) with optimistic UI.
  void setSpeedLevel(FanSpeedLevelValue value) {
    final prop = channel.speedProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set direction with optimistic UI.
  void setDirection(FanDirectionValue value) {
    final prop = channel.directionProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set mode with optimistic UI.
  void setMode(FanModeValue value) {
    final prop = channel.modeProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set child lock state with optimistic UI.
  void setLocked(bool value) {
    final prop = channel.lockedProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set natural breeze state with optimistic UI.
  void setNaturalBreeze(bool value) {
    final prop = channel.naturalBreezeProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set numeric timer value with optimistic UI.
  void setTimer(int value) {
    final prop = channel.timerProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set timer preset (enum) with optimistic UI.
  void setTimerPreset(FanTimerPresetValue value) {
    final prop = channel.timerProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }
}
