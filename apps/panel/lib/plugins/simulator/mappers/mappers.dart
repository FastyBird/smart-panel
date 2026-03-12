import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/plugins/simulator/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/simulator/models/device.dart';
import 'package:fastybird_smart_panel/plugins/simulator/models/property.dart';

DeviceModel buildSimulatorDeviceModel(Map<String, dynamic> data) {
  return SimulatorDeviceModel.fromJson(data);
}

ChannelModel buildSimulatorChannelModel(Map<String, dynamic> data) {
  return SimulatorChannelModel.fromJson(data);
}

ChannelPropertyModel buildSimulatorChannelPropertyModel(
    Map<String, dynamic> data) {
  return SimulatorChannelPropertyModel.fromJson(data);
}
