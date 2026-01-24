import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for window covering channel with optimistic UI support.
///
/// Wraps [WindowCoveringChannelView] and provides:
/// - Optimistic-aware getters that return desired values when commands are pending
/// - Command methods that manage the optimistic UI state machine
/// - Error handling with automatic state rollback
///
/// ## Optimistic UI Pattern
///
/// Controllers implement the following state flow for each command:
///
/// 1. **Pending**: Immediately show the desired value in UI
/// 2. **API Call**: Send the command to the backend
/// 3. **Success**: Transition to "settling" state, wait for actual value update
/// 4. **Failure**: Rollback to original value and notify via [onError]
class WindowCoveringChannelController {
  final String deviceId;
  final WindowCoveringChannelView channel;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  WindowCoveringChannelController({
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

  /// Current position (optimistic-aware).
  int get position {
    final prop = channel.positionProp;
    if (_controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value = _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.position;
  }

  /// Current tilt angle (optimistic-aware).
  int get tilt {
    final prop = channel.tiltProp;
    if (prop != null && _controlState.isLocked(deviceId, channel.id, prop.id)) {
      final value = _controlState.getDesiredValue(deviceId, channel.id, prop.id);
      if (value is num) return value.toInt();
    }
    return channel.tilt;
  }

  /// Current status (read-only, from actual state).
  WindowCoveringStatusValue get status => channel.status;

  /// Current window covering type (read-only).
  WindowCoveringTypeValue get windowCoveringType => channel.windowCoveringType;

  // ===========================================================================
  // PASSTHROUGH GETTERS (no optimistic state needed)
  // ===========================================================================

  bool get hasPosition => channel.hasPosition;
  int get minPosition => channel.minPosition;
  int get maxPosition => channel.maxPosition;

  bool get hasTilt => channel.hasTilt;
  int get minTilt => channel.minTilt;
  int get maxTilt => channel.maxTilt;

  bool get hasObstruction => channel.hasObstruction;
  bool get obstruction => channel.obstruction;

  bool get hasFault => channel.hasFault;
  num? get faultCode => channel.faultCode;

  bool get isOpen => channel.isOpen;
  bool get isClosed => channel.isClosed;
  bool get isOpening => channel.isOpening;
  bool get isClosing => channel.isClosing;
  bool get isStopped => channel.isStopped;

  List<WindowCoveringStatusValue> get availableStatuses =>
      channel.availableStatuses;

  // ===========================================================================
  // COMMANDS
  // ===========================================================================

  /// Set position with optimistic UI.
  void setPosition(int value) {
    final prop = channel.positionProp;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set position'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Set tilt angle with optimistic UI.
  void setTilt(int value) {
    final prop = channel.tiltProp;
    if (prop == null) return;

    _controlState.setPending(deviceId, channel.id, prop.id, value);

    _devicesService.setPropertyValue(prop.id, value).then((success) {
      if (success) {
        _controlState.setSettling(deviceId, channel.id, prop.id);
      } else {
        _controlState.clear(deviceId, channel.id, prop.id);
        _onError?.call(prop.id, Exception('Failed to set tilt'));
      }
    }).catchError((error) {
      _controlState.clear(deviceId, channel.id, prop.id);
      _onError?.call(prop.id, error);
    });
  }

  /// Send open command.
  void open() {
    _sendCommand(WindowCoveringCommandValue.open);
  }

  /// Send close command.
  void close() {
    _sendCommand(WindowCoveringCommandValue.close);
  }

  /// Send stop command.
  void stop() {
    _sendCommand(WindowCoveringCommandValue.stop);
  }

  /// Send a command to the window covering.
  void _sendCommand(WindowCoveringCommandValue command) {
    final prop = channel.commandProp;

    _devicesService.setPropertyValue(prop.id, command.value).then((success) {
      if (!success) {
        _onError?.call(prop.id, Exception('Failed to send command: ${command.value}'));
      }
    }).catchError((error) {
      _onError?.call(prop.id, error);
    });
  }
}
