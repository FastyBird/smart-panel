import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';

/// Controller for heating unit device with optimistic UI support.
///
/// Composes [HeaterChannelController] and provides device-level operations.
class HeatingUnitDeviceController {
  final HeatingUnitDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final HeaterChannelController _heaterController;

  HeatingUnitDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _heaterController = HeaterChannelController(
      deviceId: device.id,
      channel: device.heaterChannel,
      controlState: _controlState,
      devicesService: _devicesService,
      onError: _onError,
    );
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the heater channel controller.
  HeaterChannelController get heater => _heaterController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether the device is on (optimistic-aware).
  bool get isOn => _heaterController.isOn;

  /// Target temperature (optimistic-aware).
  double get temperature => _heaterController.temperature;

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get isHeating => _heaterController.isHeating;
  double get minTemperature => _heaterController.minTemperature;
  double get maxTemperature => _heaterController.maxTemperature;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set device power state with optimistic UI.
  void setPower(bool value) => _heaterController.setPower(value);

  /// Toggle device power state with optimistic UI.
  void togglePower() => _heaterController.togglePower();

  /// Set target temperature with optimistic UI.
  void setTemperature(double value) => _heaterController.setTemperature(value);
}
