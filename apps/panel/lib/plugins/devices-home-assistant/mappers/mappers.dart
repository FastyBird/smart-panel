import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/models/property.dart';

DeviceModel buildHomeAssistantDeviceModel(Map<String, dynamic> data) {
  return HomeAssistantDeviceModel.fromJson(data);
}

ChannelModel buildHomeAssistantChannelModel(Map<String, dynamic> data) {
  return HomeAssistantChannelModel.fromJson(data);
}

ChannelPropertyModel buildHomeAssistantChannelPropertyModel(
    Map<String, dynamic> data) {
  return HomeAssistantChannelPropertyModel.fromJson(data);
}
