import 'package:fastybird_smart_panel/modules/devices/models/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/home_assistant_device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/third_party_device.dart';

Map<String, DeviceModel Function(Map<String, dynamic>)> deviceModelMappers = {
  'third-party': (data) {
    return ThirdPartyDeviceModel.fromJson(data);
  },
  'home-assistant': (data) {
    return HomeAssistantDeviceModel.fromJson(data);
  },
};

DeviceModel buildDeviceModel(String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Device model can not be created. Unsupported device type: $type',
    );
  }
}
