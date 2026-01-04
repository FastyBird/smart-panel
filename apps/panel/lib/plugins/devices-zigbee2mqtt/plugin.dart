import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesZigbee2mqttPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      zigbee2mqttDeviceType,
      buildZigbee2mqttDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      zigbee2mqttDeviceType,
      buildZigbee2mqttChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      zigbee2mqttDeviceType,
      buildZigbee2mqttChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES ZIGBEE2MQTT PLUGIN] Plugin registered successfully',
      );
    }
  }
}
