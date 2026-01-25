import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';

/// Controller for thermostat channel with optimistic UI support.
///
/// Wraps [ThermostatChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
/// - Error handling with automatic state rollback
class ThermostatChannelController {
  final String deviceId;
  final ThermostatChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  ThermostatChannelController({
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

  /// Whether locked is enabled (optimistic-aware).
  bool get isLocked {
    final prop = channel.lockedProp;
    if (prop != null &&
        _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value =
          _controlState.getDesiredValue(deviceId, channel.id, prop.id) as bool?;
      if (value != null) return value;
    }
    return channel.isLocked;
  }

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasLocked => channel.lockedProp != null;

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /// Set locked state with optimistic UI.
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

  /// Toggle locked state with optimistic UI.
  void toggleLocked() {
    setLocked(!isLocked);
  }
}
