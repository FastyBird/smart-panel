import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesWledPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      wledDeviceType,
      buildWledDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      wledDeviceType,
      buildWledChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      wledDeviceType,
      buildWledChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES WLED PLUGIN] Plugin registered successfully',
      );
    }
  }
}
