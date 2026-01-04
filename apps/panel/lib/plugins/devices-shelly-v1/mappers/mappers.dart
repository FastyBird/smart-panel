import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/models/property.dart';

DeviceModel buildShellyV1DeviceModel(Map<String, dynamic> data) {
  return ShellyV1DeviceModel.fromJson(data);
}

ChannelModel buildShellyV1ChannelModel(Map<String, dynamic> data) {
  return ShellyV1ChannelModel.fromJson(data);
}

ChannelPropertyModel buildShellyV1ChannelPropertyModel(
    Map<String, dynamic> data) {
  return ShellyV1ChannelPropertyModel.fromJson(data);
}
