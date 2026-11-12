import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/mappers/mappers.dart';
import 'package:flutter/foundation.dart';

class DevicesModbusPlugin {
  static void register() {
    // Register the device model mapper
    registerDeviceModelMapper(
      modbusDeviceType,
      buildModbusDeviceModel,
    );

    // Register the channel model mapper
    registerChannelModelMapper(
      modbusDeviceType,
      buildModbusChannelModel,
    );

    // Register the channel property model mapper
    registerChannelPropertyModelMapper(
      modbusDeviceType,
      buildModbusChannelPropertyModel,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES MODBUS PLUGIN] Plugin registered successfully',
      );
    }
  }
}
