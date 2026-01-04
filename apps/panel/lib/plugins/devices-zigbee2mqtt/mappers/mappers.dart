import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/models/property.dart';

DeviceModel buildZigbee2mqttDeviceModel(Map<String, dynamic> data) {
  return Zigbee2mqttDeviceModel.fromJson(data);
}

ChannelModel buildZigbee2mqttChannelModel(Map<String, dynamic> data) {
  return Zigbee2mqttChannelModel.fromJson(data);
}

ChannelPropertyModel buildZigbee2mqttChannelPropertyModel(
    Map<String, dynamic> data) {
  return Zigbee2mqttChannelPropertyModel.fromJson(data);
}
