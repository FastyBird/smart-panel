import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/models/property.dart';

DeviceModel buildThirdPartyDeviceModel(Map<String, dynamic> data) {
  return ThirdPartyDeviceModel.fromJson(data);
}

ChannelModel buildThirdPartyChannelModel(Map<String, dynamic> data) {
  return ThirdPartyChannelModel.fromJson(data);
}

ChannelPropertyModel buildThirdPartyChannelPropertyModel(
    Map<String, dynamic> data) {
  return ThirdPartyChannelPropertyModel.fromJson(data);
}
