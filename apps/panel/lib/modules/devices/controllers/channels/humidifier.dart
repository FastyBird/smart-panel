import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for humidifier channel with optimistic UI support.
///
/// Wraps [HumidifierChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
class HumidifierChannelController {
  final String deviceId;
  final HumidifierChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  HumidifierChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether the humidifier is on (optimistic-aware).
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
  HumidifierModeValue? get mode {
    final prop = channel.modeProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && HumidifierModeValue.contains(value)) {
        return HumidifierModeValue.fromValue(value);
      }
    }
    return channel.mode;
  }

  /// Mist level numeric value (optimistic-aware).
  int get mistLevel {
    final prop = channel.mistLevelProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.mistLevel;
  }

  /// Mist level preset (optimistic-aware, for enum-based mist level).
  HumidifierMistLevelLevelValue? get mistLevelPreset {
    final prop = channel.mistLevelProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && HumidifierMistLevelLevelValue.contains(value)) {
        return HumidifierMistLevelLevelValue.fromValue(value);
      }
    }
    return channel.mistLevelPreset;
  }

  /// Whether warm mist is enabled (optimistic-aware).
  bool get warmMist {
    final prop = channel.warmMistProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id) as bool?;
      if (value != null) return value;
    }
    return channel.warmMist;
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
  HumidifierTimerPresetValue? get timerPreset {
    final prop = channel.timerProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is String && HumidifierTimerPresetValue.contains(value)) {
        return HumidifierTimerPresetValue.fromValue(value);
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
  List<HumidifierModeValue> get availableModes => channel.availableModes;
  bool get hasStatus => channel.hasStatus;
  HumidifierStatusValue? get status => channel.status;
  bool get isHumidifying => channel.isHumidifying;
  bool get hasMistLevel => channel.hasMistLevel;
  bool get isMistLevelNumeric => channel.isMistLevelNumeric;
  bool get isMistLevelEnum => channel.isMistLevelEnum;
  int get minMistLevel => channel.minMistLevel;
  int get maxMistLevel => channel.maxMistLevel;
  List<HumidifierMistLevelLevelValue> get availableMistLevelPresets =>
      channel.availableMistLevelPresets;
  bool get hasWarmMist => channel.hasWarmMist;
  bool get hasTimer => channel.hasTimer;
  bool get isTimerNumeric => channel.isTimerNumeric;
  bool get isTimerEnum => channel.isTimerEnum;
  int get minTimer => channel.minTimer;
  int get maxTimer => channel.maxTimer;
  int get timerStep => channel.timerStep;
  List<HumidifierTimerPresetValue> get availableTimerPresets =>
      channel.availableTimerPresets;
  bool get hasLocked => channel.hasLocked;
  bool get hasWaterTankLevel => channel.hasWaterTankLevel;
  int get waterTankLevel => channel.waterTankLevel;
  bool get hasWaterTankEmpty => channel.hasWaterTankEmpty;
  bool get waterTankEmpty => channel.waterTankEmpty;
  bool get waterTankWarning => channel.waterTankWarning;
  bool get hasFault => channel.hasFault;
  num? get faultCode => channel.faultCode;

  bool computeIsHumidifying({int? currentHumidity}) =>
      channel.computeIsHumidifying(currentHumidity: currentHumidity);

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

  /// Set target humidity with optimistic UI.
  void setHumidity(int value) {
    final prop = channel.humidityProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set mode with optimistic UI.
  void setMode(HumidifierModeValue value) {
    final prop = channel.modeProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set numeric mist level with optimistic UI.
  void setMistLevel(int value) {
    final prop = channel.mistLevelProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set mist level preset (enum) with optimistic UI.
  void setMistLevelPreset(HumidifierMistLevelLevelValue value) {
    final prop = channel.mistLevelProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Set warm mist state with optimistic UI.
  void setWarmMist(bool value) {
    final prop = channel.warmMistProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
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
  void setTimerPreset(HumidifierTimerPresetValue value) {
    final prop = channel.timerProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value.value);

    _devicesService.setPropertyValue(prop.id, value.value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }
}
