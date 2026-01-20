import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';

/// Controller for cooler channel with optimistic UI support.
///
/// Wraps [CoolerChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
class CoolerChannelController {
  final String deviceId;
  final CoolerChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  CoolerChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether the cooler is on (optimistic-aware).
  bool get isOn {
    if (_controlState.isLocked(deviceId, channel.id, channel.onProp.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, channel.onProp.id)
              as bool?;
      if (value != null) return value;
    }
    return channel.isOn;
  }

  /// Target temperature (optimistic-aware).
  double get temperature {
    if (_controlState.isLocked(
        deviceId, channel.id, channel.temperatureProp.id)) {
      final value = _controlState.getDesiredValue(
          deviceId, channel.id, channel.temperatureProp.id);
      if (value is num) return value.toDouble();
    }
    return channel.temperature;
  }

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get isCooling => channel.isCooling;
  double get minTemperature => channel.minTemperature;
  double get maxTemperature => channel.maxTemperature;

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

  /// Set target temperature with optimistic UI.
  void setTemperature(double value) {
    final prop = channel.temperatureProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }
}
