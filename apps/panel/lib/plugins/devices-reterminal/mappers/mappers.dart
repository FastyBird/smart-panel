import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-reterminal/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-reterminal/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-reterminal/models/property.dart';

DeviceModel buildReTerminalDeviceModel(Map<String, dynamic> data) {
  return ReTerminalDeviceModel.fromJson(data);
}

ChannelModel buildReTerminalChannelModel(Map<String, dynamic> data) {
  return ReTerminalChannelModel.fromJson(data);
}

ChannelPropertyModel buildReTerminalChannelPropertyModel(
    Map<String, dynamic> data) {
  return ReTerminalChannelPropertyModel.fromJson(data);
}
