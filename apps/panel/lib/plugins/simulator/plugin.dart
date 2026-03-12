import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/simulator/constants.dart';
import 'package:fastybird_smart_panel/plugins/simulator/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class SimulatorPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      simulatorDeviceType,
      buildSimulatorDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      simulatorDeviceType,
      buildSimulatorChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      simulatorDeviceType,
      buildSimulatorChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES SIMULATOR PLUGIN] Plugin registered successfully',
      );
    }
  }
}
