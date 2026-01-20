import 'package:fastybird_smart_panel/modules/devices/controllers/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';

/// Controller for thermostat device with optimistic UI support.
///
/// Composes [ThermostatChannelController], [HeaterChannelController], and
/// [CoolerChannelController] and provides device-level operations.
class ThermostatDeviceController {
  final ThermostatDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final ThermostatChannelController _thermostatController;
  HeaterChannelController? _heaterController;
  CoolerChannelController? _coolerController;

  ThermostatDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _thermostatController = ThermostatChannelController(
      deviceId: device.id,
      channel: device.thermostatChannel,
      controlState: _controlState,
      devicesService: _devicesService,
      onError: _onError,
    );

    final heaterChannel = device.heaterChannel;
    if (heaterChannel != null) {
      _heaterController = HeaterChannelController(
        deviceId: device.id,
        channel: heaterChannel,
        controlState: _controlState,
        devicesService: _devicesService,
        onError: _onError,
      );
    }

    final coolerChannel = device.coolerChannel;
    if (coolerChannel != null) {
      _coolerController = CoolerChannelController(
        deviceId: device.id,
        channel: coolerChannel,
        controlState: _controlState,
        devicesService: _devicesService,
        onError: _onError,
      );
    }
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the thermostat channel controller.
  ThermostatChannelController get thermostat => _thermostatController;

  /// Access to the heater channel controller (if available).
  HeaterChannelController? get heater => _heaterController;

  /// Access to the cooler channel controller (if available).
  CoolerChannelController? get cooler => _coolerController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether the device is on (heater or cooler is commanded on).
  bool get isOn {
    final heaterOn = _heaterController?.isOn ?? false;
    final coolerOn = _coolerController?.isOn ?? false;
    return heaterOn || coolerOn;
  }

  /// Whether thermostat child lock is enabled (optimistic-aware).
  bool get isLocked => _thermostatController.isLocked;

  /// Target heating temperature (optimistic-aware).
  double? get heatingTemperature => _heaterController?.temperature;

  /// Target cooling temperature (optimistic-aware).
  double? get coolingTemperature => _coolerController?.temperature;

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasHeater => _heaterController != null;
  bool get hasCooler => _coolerController != null;
  bool get hasThermostatLock => _thermostatController.hasLocked;
  bool get isHeating => _heaterController?.isHeating ?? false;
  bool get isCooling => _coolerController?.isCooling ?? false;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set thermostat child lock state with optimistic UI.
  void setLocked(bool value) => _thermostatController.setLocked(value);

  /// Toggle thermostat child lock state with optimistic UI.
  void toggleLocked() => _thermostatController.toggleLocked();

  /// Set heater power state with optimistic UI.
  void setHeaterPower(bool value) => _heaterController?.setPower(value);

  /// Set cooler power state with optimistic UI.
  void setCoolerPower(bool value) => _coolerController?.setPower(value);

  /// Set heating target temperature with optimistic UI.
  void setHeatingTemperature(double value) =>
      _heaterController?.setTemperature(value);

  /// Set cooling target temperature with optimistic UI.
  void setCoolingTemperature(double value) =>
      _coolerController?.setTemperature(value);

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /// Set multiple properties atomically with optimistic UI.
  ///
  /// Used for coordinated updates like mode changes.
  void setMultipleProperties(
    List<PropertyCommandItem> commands, {
    void Function()? onSuccess,
    void Function()? onError,
  }) {
    // 1. Set all pending states immediately
    for (final cmd in commands) {
      _controlState.setPending(device.id, cmd.channelId, cmd.propertyId, cmd.value);
    }

    // 2. Batch API call
    _devicesService.setMultiplePropertyValues(properties: commands).then((success) {
      if (success) {
        // 3a. All succeeded: transition to settling
        for (final cmd in commands) {
          _controlState.setSettling(device.id, cmd.channelId, cmd.propertyId);
        }
        onSuccess?.call();
      } else {
        // 3b. Failed: rollback all
        for (final cmd in commands) {
          _controlState.clear(device.id, cmd.channelId, cmd.propertyId);
        }
        _onError?.call(commands.first.propertyId, Exception('Failed to set multiple properties'));
        onError?.call();
      }
    }).catchError((error) {
      // 3c. Exception: rollback all
      for (final cmd in commands) {
        _controlState.clear(device.id, cmd.channelId, cmd.propertyId);
      }
      _onError?.call(commands.first.propertyId, error);
      onError?.call();
    });
  }
}
