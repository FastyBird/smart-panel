import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';

/// Controller for thermostat channel with optimistic UI support.
///
/// Wraps [ThermostatChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
class ThermostatChannelController {
  final String deviceId;
  final ThermostatChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  ThermostatChannelController({
    required this.deviceId,
    required this.channel,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService;

  // ===========================================================================
  // OPTIMISTIC-AWARE GETTERS
  // ===========================================================================

  /// Whether child lock is enabled (optimistic-aware).
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

  /// Set child lock state with optimistic UI.
  void setLocked(bool value) {
    final prop = channel.lockedProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((_) {
      _controlState.setSettling(deviceId, channel.id, prop.id);
    });
  }

  /// Toggle child lock state with optimistic UI.
  void toggleLocked() {
    setLocked(!isLocked);
  }
}
