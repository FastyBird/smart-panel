import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesVirtualPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      virtualDeviceType,
      buildVirtualDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      virtualDeviceType,
      buildVirtualChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      virtualDeviceType,
      buildVirtualChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES VIRTUAL PLUGIN] Plugin registered successfully',
      );
    }
  }
}
