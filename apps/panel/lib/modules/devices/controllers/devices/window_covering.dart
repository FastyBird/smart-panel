import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for window covering device with optimistic UI support.
///
/// Composes [WindowCoveringChannelController] and provides device-level operations.
class WindowCoveringDeviceController {
  final WindowCoveringDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final WindowCoveringChannelController _windowCoveringController;

  WindowCoveringDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _windowCoveringController = WindowCoveringChannelController(
      deviceId: device.id,
      channel: device.windowCoveringChannel,
      controlState: _controlState,
      devicesService: _devicesService,
      onError: _onError,
    );
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the window covering channel controller.
  WindowCoveringChannelController get windowCovering => _windowCoveringController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Current position (optimistic-aware).
  int get position => _windowCoveringController.position;

  /// Current tilt angle (optimistic-aware).
  int get tilt => _windowCoveringController.tilt;

  /// Current status.
  WindowCoveringStatusValue get status => _windowCoveringController.status;

  /// Window covering type.
  WindowCoveringTypeValue get windowCoveringType =>
      _windowCoveringController.windowCoveringType;

  /// Whether position control is available.
  bool get hasPosition => _windowCoveringController.hasPosition;

  /// Minimum position value.
  int get minPosition => _windowCoveringController.minPosition;

  /// Maximum position value.
  int get maxPosition => _windowCoveringController.maxPosition;

  /// Whether tilt control is available.
  bool get hasTilt => _windowCoveringController.hasTilt;

  /// Minimum tilt value.
  int get minTilt => _windowCoveringController.minTilt;

  /// Maximum tilt value.
  int get maxTilt => _windowCoveringController.maxTilt;

  /// Whether obstruction detection is available.
  bool get hasObstruction => _windowCoveringController.hasObstruction;

  /// Whether obstruction is detected.
  bool get obstruction => _windowCoveringController.obstruction;

  /// Whether fault detection is available.
  bool get hasFault => _windowCoveringController.hasFault;

  /// Current fault code (if any).
  num? get faultCode => _windowCoveringController.faultCode;

  /// Whether covering is fully open.
  bool get isOpen => _windowCoveringController.isOpen;

  /// Whether covering is fully closed.
  bool get isClosed => _windowCoveringController.isClosed;

  /// Whether covering is opening.
  bool get isOpening => _windowCoveringController.isOpening;

  /// Whether covering is closing.
  bool get isClosing => _windowCoveringController.isClosing;

  /// Whether covering is stopped.
  bool get isStopped => _windowCoveringController.isStopped;

  /// Available commands for this window covering.
  List<WindowCoveringCommandValue> get availableCommands =>
      _windowCoveringController.availableCommands;

  /// Whether open command is available.
  bool get hasOpenCommand => _windowCoveringController.hasOpenCommand;

  /// Whether close command is available.
  bool get hasCloseCommand => _windowCoveringController.hasCloseCommand;

  /// Whether stop command is available.
  bool get hasStopCommand => _windowCoveringController.hasStopCommand;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set position with optimistic UI.
  void setPosition(int value) => _windowCoveringController.setPosition(value);

  /// Set tilt angle with optimistic UI.
  void setTilt(int value) => _windowCoveringController.setTilt(value);

  /// Open the window covering.
  void open() => _windowCoveringController.open();

  /// Close the window covering.
  void close() => _windowCoveringController.close();

  /// Stop the window covering.
  void stop() => _windowCoveringController.stop();
}
