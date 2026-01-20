import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for dehumidifier channel with optimistic UI support.
///
/// Wraps [DehumidifierChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
/// - Error handling with automatic state rollback
class DehumidifierChannelController {
  final String deviceId;
  final DehumidifierChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  DehumidifierChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether the dehumidifier is on (optimistic-aware).
  bool get isOn {
    if (_controlState.isLocked(deviceId, channel.id, channel.onProp.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, channel.onProp.id)
              as bool?;
      if (value != null) return value;
    }
    return channel.on;
  }

  /// Target humidity (optimistic-aware).
  int get humidity {
    if (_controlState.isLocked(
        deviceId, channel.id, channel.humidityProp.id)) {
      final value = _controlState.getDesiredValue(
          deviceId, channel.id, channel.humidityProp.id);
      if (value is num) return value.toInt();
    }
    return channel.humidity;
  }

  /// Current mode (optimistic-aware).
  DehumidifierModeValue? get mode {
    final prop = channel.modeProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && DehumidifierModeValue.contains(value)) {
        return DehumidifierModeValue.fromValue(value);
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

  /// Current timer value (optimistic-aware, for numeric timer).
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
  DehumidifierTimerPresetValue? get timerPreset {
    final prop = channel.timerProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && DehumidifierTimerPresetValue.contains(value)) {
        return DehumidifierTimerPresetValue.fromValue(value);
      }
    }
    return channel.timerPreset;
  }

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  int get minHumidity => channel.minHumidity;
  int get maxHumidity => channel.maxHumidity;
  bool get hasMode => channel.hasMode;
  List<DehumidifierModeValue> get availableModes => channel.availableModes;
  bool get hasStatus => channel.hasStatus;
  DehumidifierStatusValue? get status => channel.status;
  bool get isDehumidifying => channel.isDehumidifying;
  bool get isDefrosting => channel.isDefrosting;
  bool get hasTimer => channel.hasTimer;
  bool get isTimerNumeric => channel.isTimerNumeric;
  bool get isTimerEnum => channel.isTimerEnum;
  int get minTimer => channel.minTimer;
  int get maxTimer => channel.maxTimer;
  int get timerStep => channel.timerStep;
  List<DehumidifierTimerPresetValue> get availableTimerPresets =>
      channel.availableTimerPresets;
  bool get hasLocked => channel.hasLocked;
  bool get hasWaterTankLevel => channel.hasWaterTankLevel;
  int get waterTankLevel => channel.waterTankLevel;
  bool get hasWaterTankFull => channel.hasWaterTankFull;
  bool get waterTankFull => channel.waterTankFull;
  bool get waterTankWarning => channel.waterTankWarning;
  bool get hasFault => channel.hasFault;
  num? get faultCode => channel.faultCode;

  bool computeIsDehumidifying({int? currentHumidity}) =>
      channel.computeIsDehumidifying(currentHumidity: currentHumidity);

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /// Set power state with optimistic UI.
  void setPower(bool value) {
    final prop = channel.onProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set power'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Toggle power state with optimistic UI.
  void togglePower() {
    setPower(!isOn);
  }

  /// Set target humidity with optimistic UI.
  void setHumidity(int value) {
    final prop = channel.humidityProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set humidity'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Set mode with optimistic UI.
  void setMode(DehumidifierModeValue value) {
    final prop = channel.modeProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set mode'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Set child lock state with optimistic UI.
  void setLocked(bool value) {
    final prop = channel.lockedProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set locked'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Set numeric timer value with optimistic UI.
  void setTimer(int value) {
    final prop = channel.timerProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set timer'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Set timer preset (enum) with optimistic UI.
  void setTimerPreset(DehumidifierTimerPresetValue value) {
    final prop = channel.timerProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set timer preset'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }
}
