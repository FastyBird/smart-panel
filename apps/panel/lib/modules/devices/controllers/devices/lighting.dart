import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';

/// Controller for lighting device with optimistic UI support.
///
/// Composes [LightChannelController]s for all light channels and provides
/// device-level operations.
class LightingDeviceController {
  final LightingDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final List<LightChannelController> _lightControllers;

  LightingDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _lightControllers = device.lightChannels.map((channel) {
      return LightChannelController(
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

  /// Access to all light channel controllers.
  List<LightChannelController> get lights => _lightControllers;

  /// Access to the first (or only) light channel controller.
  LightChannelController get light => _lightControllers.first;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether all lights are on (optimistic-aware).
  bool get isOn => _lightControllers.every((c) => c.isOn);

  /// Whether any light is on (optimistic-aware).
  bool get isAnyOn => _lightControllers.any((c) => c.isOn);

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasColor => device.hasColor;
  bool get hasWhite => device.hasWhite;
  bool get hasTemperature => device.hasTemperature;
  bool get hasBrightness => device.hasBrightness;
  bool get isSimpleLight => device.isSimpleLight;
  bool get isSingleBrightness => device.isSingleBrightness;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set all lights power state with optimistic UI.
  void setPower(bool value) {
    for (final controller in _lightControllers) {
      controller.setPower(value);
    }
  }

  /// Toggle all lights power state with optimistic UI.
  void togglePower() {
    final newValue = !isOn;
    for (final controller in _lightControllers) {
      controller.setPower(newValue);
    }
  }

  /// Set brightness for all lights with optimistic UI.
  void setBrightness(int value) {
    for (final controller in _lightControllers) {
      if (controller.hasBrightness) {
        controller.setBrightness(value);
      }
    }
  }
}
