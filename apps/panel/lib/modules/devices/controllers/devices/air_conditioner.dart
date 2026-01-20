import 'package:fastybird_smart_panel/modules/devices/controllers/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';

/// Controller for air conditioner device with optimistic UI support.
///
/// Composes [CoolerChannelController], [FanChannelController], and optionally
/// [HeaterChannelController] and provides device-level operations.
class AirConditionerDeviceController {
  final AirConditionerDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;

  late final CoolerChannelController _coolerController;
  late final FanChannelController _fanController;
  HeaterChannelController? _heaterController;

  AirConditionerDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
  })  : _controlState = controlState,
        _devicesService = devicesService {
    _coolerController = CoolerChannelController(
      deviceId: device.id,
      channel: device.coolerChannel,
      controlState: _controlState,
      devicesService: _devicesService,
    );

    _fanController = FanChannelController(
      deviceId: device.id,
      channel: device.fanChannel,
      controlState: _controlState,
      devicesService: _devicesService,
    );

    final heaterChannel = device.heaterChannel;
    if (heaterChannel != null) {
      _heaterController = HeaterChannelController(
        deviceId: device.id,
        channel: heaterChannel,
        controlState: _controlState,
        devicesService: _devicesService,
      );
    }
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the cooler channel controller.
  CoolerChannelController get cooler => _coolerController;

  /// Access to the fan channel controller.
  FanChannelController get fan => _fanController;

  /// Access to the heater channel controller (if available).
  HeaterChannelController? get heater => _heaterController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether the cooler is on (optimistic-aware).
  bool get isCoolerOn => _coolerController.isOn;

  /// Whether the device is actively cooling.
  bool get isCooling => _coolerController.isCooling;

  /// Cooling target temperature (optimistic-aware).
  double get coolingTemperature => _coolerController.temperature;

  /// Whether the heater is on (optimistic-aware).
  bool? get isHeaterOn => _heaterController?.isOn;

  /// Whether the device is actively heating.
  bool get isHeating => _heaterController?.isHeating ?? false;

  /// Heating target temperature (optimistic-aware).
  double? get heatingTemperature => _heaterController?.temperature;

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasHeater => _heaterController != null;
  double get minCoolingTemperature => _coolerController.minTemperature;
  double get maxCoolingTemperature => _coolerController.maxTemperature;
  double? get minHeatingTemperature => _heaterController?.minTemperature;
  double? get maxHeatingTemperature => _heaterController?.maxTemperature;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set cooler power state with optimistic UI.
  void setCoolerPower(bool value) => _coolerController.setPower(value);

  /// Toggle cooler power state with optimistic UI.
  void toggleCoolerPower() => _coolerController.togglePower();

  /// Set cooling target temperature with optimistic UI.
  void setCoolingTemperature(double value) =>
      _coolerController.setTemperature(value);

  /// Set heater power state with optimistic UI.
  void setHeaterPower(bool value) => _heaterController?.setPower(value);

  /// Toggle heater power state with optimistic UI.
  void toggleHeaterPower() => _heaterController?.togglePower();

  /// Set heating target temperature with optimistic UI.
  void setHeatingTemperature(double value) =>
      _heaterController?.setTemperature(value);
}
