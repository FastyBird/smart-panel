import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesThirdPartyPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      thirdPartyDeviceType,
      buildThirdPartyDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      thirdPartyDeviceType,
      buildThirdPartyChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      thirdPartyDeviceType,
      buildThirdPartyChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES THIRD PARTY PLUGIN] Plugin registered successfully',
      );
    }
  }
}
