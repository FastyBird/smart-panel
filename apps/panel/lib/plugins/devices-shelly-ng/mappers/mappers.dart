import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/models/property.dart';

DeviceModel buildShellyNgDeviceModel(Map<String, dynamic> data) {
  return ShellyNgDeviceModel.fromJson(data);
}

ChannelModel buildShellyNgChannelModel(Map<String, dynamic> data) {
  return ShellyNgChannelModel.fromJson(data);
}

ChannelPropertyModel buildShellyNgChannelPropertyModel(
    Map<String, dynamic> data) {
  return ShellyNgChannelPropertyModel.fromJson(data);
}
