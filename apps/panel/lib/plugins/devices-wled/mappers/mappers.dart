import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/models/property.dart';

DeviceModel buildWledDeviceModel(Map<String, dynamic> data) {
  return WledDeviceModel.fromJson(data);
}

ChannelModel buildWledChannelModel(Map<String, dynamic> data) {
  return WledChannelModel.fromJson(data);
}

ChannelPropertyModel buildWledChannelPropertyModel(Map<String, dynamic> data) {
  return WledChannelPropertyModel.fromJson(data);
}
