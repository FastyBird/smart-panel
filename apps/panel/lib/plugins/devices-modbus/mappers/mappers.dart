import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/property.dart';

DeviceModel buildModbusDeviceModel(Map<String, dynamic> data) {
  return ModbusDeviceModel.fromJson(data);
}

ChannelModel buildModbusChannelModel(Map<String, dynamic> data) {
  return ModbusChannelModel.fromJson(data);
}

ChannelPropertyModel buildModbusChannelPropertyModel(
    Map<String, dynamic> data) {
  return ModbusChannelPropertyModel.fromJson(data);
}
