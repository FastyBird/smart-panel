import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';

/// Controller for air purifier device with optimistic UI support.
///
/// Composes [FanChannelController] and provides device-level operations.
class AirPurifierDeviceController {
  final AirPurifierDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  late final FanChannelController _fanController;

  AirPurifierDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService {
    _fanController = FanChannelController(
      deviceId: device.id,
      channel: device.fanChannel,
      controlState: _controlState,
      devicesService: _devicesService,
    );
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the fan channel controller.
  FanChannelController get fan => _fanController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether the device is on (optimistic-aware).
  bool get isOn => _fanController.isOn;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set device power state with optimistic UI.
  void setPower(bool value) => _fanController.setPower(value);

  /// Toggle device power state with optimistic UI.
  void togglePower() => _fanController.togglePower();
}
