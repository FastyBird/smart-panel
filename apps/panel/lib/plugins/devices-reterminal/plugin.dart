import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-reterminal/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-reterminal/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesReTerminalPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      reTerminalDeviceType,
      buildReTerminalDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      reTerminalDeviceType,
      buildReTerminalChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      reTerminalDeviceType,
      buildReTerminalChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES RETERMINAL PLUGIN] Plugin registered successfully',
      );
    }
  }
}
