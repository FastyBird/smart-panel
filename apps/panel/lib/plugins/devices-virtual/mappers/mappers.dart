import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';

DeviceModel buildVirtualDeviceModel(Map<String, dynamic> data) {
  return VirtualDeviceModel.fromJson(data);
}

ChannelModel buildVirtualChannelModel(Map<String, dynamic> data) {
  return VirtualChannelModel.fromJson(data);
}

ChannelPropertyModel buildVirtualChannelPropertyModel(
    Map<String, dynamic> data) {
  return VirtualChannelPropertyModel.fromJson(data);
}
