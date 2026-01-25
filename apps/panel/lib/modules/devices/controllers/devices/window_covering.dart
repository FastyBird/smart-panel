import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Controller for window covering device with optimistic UI support.
///
/// Composes [WindowCoveringChannelController]s for all window covering channels
/// and provides device-level operations.
class WindowCoveringDeviceController {
  final WindowCoveringDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final List<WindowCoveringChannelController> _windowCoveringControllers;

  WindowCoveringDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _windowCoveringControllers = device.windowCoveringChannels.map((channel) {
      return WindowCoveringChannelController(
        deviceId: device.id,
        channel: channel,
        controlState: _controlState,
        devicesService: _devicesService,
        onError: _onError,
      );
    }).toList();
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to all window covering channel controllers.
  List<WindowCoveringChannelController> get windowCoverings => _windowCoveringControllers;

  /// Access to the first (or only) window covering channel controller.
  WindowCoveringChannelController get windowCovering => _windowCoveringControllers.first;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Current position (optimistic-aware).
  int get position => _windowCoveringControllers.first.position;

  /// Current tilt angle (optimistic-aware).
  int get tilt => _windowCoveringControllers.first.tilt;

  /// Current status.
  WindowCoveringStatusValue get status => _windowCoveringControllers.first.status;

  /// Window covering type.
  WindowCoveringTypeValue get windowCoveringType =>
      _windowCoveringControllers.first.windowCoveringType;

  /// Whether position control is available.
  bool get hasPosition => _windowCoveringControllers.first.hasPosition;

  /// Minimum position value.
  int get minPosition => _windowCoveringControllers.first.minPosition;

  /// Maximum position value.
  int get maxPosition => _windowCoveringControllers.first.maxPosition;

  /// Whether tilt control is available.
  bool get hasTilt => _windowCoveringControllers.first.hasTilt;

  /// Minimum tilt value.
  int get minTilt => _windowCoveringControllers.first.minTilt;

  /// Maximum tilt value.
  int get maxTilt => _windowCoveringControllers.first.maxTilt;

  /// Whether obstruction detection is available.
  bool get hasObstruction => _windowCoveringControllers.first.hasObstruction;

  /// Whether obstruction is detected.
  bool get obstruction => _windowCoveringControllers.first.obstruction;

  /// Whether fault detection is available.
  bool get hasFault => _windowCoveringControllers.first.hasFault;

  /// Current fault code (if any).
  num? get faultCode => _windowCoveringControllers.first.faultCode;

  /// Whether covering is fully open.
  bool get isOpen => _windowCoveringControllers.first.isOpen;

  /// Whether covering is fully closed.
  bool get isClosed => _windowCoveringControllers.first.isClosed;

  /// Whether covering is opening.
  bool get isOpening => _windowCoveringControllers.first.isOpening;

  /// Whether covering is closing.
  bool get isClosing => _windowCoveringControllers.first.isClosing;

  /// Whether covering is stopped.
  bool get isStopped => _windowCoveringControllers.first.isStopped;

  /// Available commands for this window covering.
  List<WindowCoveringCommandValue> get availableCommands =>
      _windowCoveringControllers.first.availableCommands;

  /// Whether open command is available.
  bool get hasOpenCommand => _windowCoveringControllers.first.hasOpenCommand;

  /// Whether close command is available.
  bool get hasCloseCommand => _windowCoveringControllers.first.hasCloseCommand;

  /// Whether stop command is available.
  bool get hasStopCommand => _windowCoveringControllers.first.hasStopCommand;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set position with optimistic UI.
  void setPosition(int value) => _windowCoveringControllers.first.setPosition(value);

  /// Set tilt angle with optimistic UI.
  void setTilt(int value) => _windowCoveringControllers.first.setTilt(value);

  /// Open the window covering.
  void open() => _windowCoveringControllers.first.open();

  /// Close the window covering.
  void close() => _windowCoveringControllers.first.close();

  /// Stop the window covering.
  void stop() => _windowCoveringControllers.first.stop();
}
