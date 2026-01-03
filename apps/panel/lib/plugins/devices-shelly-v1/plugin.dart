import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesShellyV1Plugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      shellyV1DeviceType,
      buildShellyV1DeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      shellyV1DeviceType,
      buildShellyV1ChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      shellyV1DeviceType,
      buildShellyV1ChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES SHELLY V1 PLUGIN] Plugin registered successfully',
      );
    }
  }
}
