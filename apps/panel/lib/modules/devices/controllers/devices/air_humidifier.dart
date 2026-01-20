import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';

/// Controller for air humidifier device with optimistic UI support.
///
/// Composes [HumidifierChannelController] and optionally [FanChannelController]
/// and provides device-level operations.
class AirHumidifierDeviceController {
  final AirHumidifierDeviceView device;
  final DeviceControlStateService _controlState;
  final DevicesService _devicesService;
  final ControllerErrorCallback? _onError;

  late final HumidifierChannelController _humidifierController;
  FanChannelController? _fanController;

  AirHumidifierDeviceController({
    required this.device,
    required DeviceControlStateService controlState,
    required DevicesService devicesService,
    ControllerErrorCallback? onError,
  })  : _controlState = controlState,
        _devicesService = devicesService,
        _onError = onError {
    _humidifierController = HumidifierChannelController(
      deviceId: device.id,
      channel: device.humidifierChannel,
      controlState: _controlState,
      devicesService: _devicesService,
      onError: _onError,
    );

    final fanChannel = device.fanChannel;
    if (fanChannel != null) {
      _fanController = FanChannelController(
        deviceId: device.id,
        channel: fanChannel,
        controlState: _controlState,
        devicesService: _devicesService,
        onError: _onError,
      );
    }
  }

  // ===========================================================================
  // CHANNEL CONTROLLER ACCESS
  // ===========================================================================

  /// Access to the humidifier channel controller.
  HumidifierChannelController get humidifier => _humidifierController;

  /// Access to the fan channel controller (if available).
  FanChannelController? get fan => _fanController;

  // ===========================================================================
  // DEVICE-LEVEL GETTERS (optimistic-aware)
  // ===========================================================================

  /// Whether the device is on (optimistic-aware).
  bool get isOn => _humidifierController.isOn;

  /// Target humidity (optimistic-aware).
  int get humidity => _humidifierController.humidity;

  // ===========================================================================
  // PASSTHROUGH GETTERS
  // ===========================================================================

  bool get hasFan => _fanController != null;
  int get minHumidity => _humidifierController.minHumidity;
  int get maxHumidity => _humidifierController.maxHumidity;

  // ===========================================================================
  // DEVICE-LEVEL COMMANDS
  // ===========================================================================

  /// Set device power state with optimistic UI.
  void setPower(bool value) => _humidifierController.setPower(value);

  /// Toggle device power state with optimistic UI.
  void togglePower() => _humidifierController.togglePower();

  /// Set target humidity with optimistic UI.
  void setHumidity(int value) => _humidifierController.setHumidity(value);

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /// Set multiple properties atomically with optimistic UI.
  ///
  /// Used for coordinated updates like power toggle with mode changes.
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
