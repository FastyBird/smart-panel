import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';

/// Controller for heater channel with optimistic UI support.
///
/// Wraps [HeaterChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
/// - Error handling with automatic state rollback
class HeaterChannelController {
  final String deviceId;
  final HeaterChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  HeaterChannelController({
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

  /// Whether the heater is on (optimistic-aware).
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

  bool get isHeating => channel.isHeating;
  double get minTemperature => channel.minTemperature;
  double get maxTemperature => channel.maxTemperature;

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

  /// Set target temperature with optimistic UI.
  void setTemperature(double value) {
    final prop = channel.temperatureProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set temperature'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }
}
