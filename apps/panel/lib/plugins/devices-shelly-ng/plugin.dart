import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesShellyNgPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      shellyNgDeviceType,
      buildShellyNgDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      shellyNgDeviceType,
      buildShellyNgChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      shellyNgDeviceType,
      buildShellyNgChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES SHELLY NG PLUGIN] Plugin registered successfully',
      );
    }
  }
}
