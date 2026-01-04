import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesHomeAssistantPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      homeAssistantDeviceType,
      buildHomeAssistantDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      homeAssistantDeviceType,
      buildHomeAssistantChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      homeAssistantDeviceType,
      buildHomeAssistantChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES HOME ASSISTANT PLUGIN] Plugin registered successfully',
      );
    }
  }
}
