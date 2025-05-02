import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/home_assistant_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/third_party_channel.dart';

Map<String, ChannelModel Function(Map<String, dynamic>)> deviceModelMappers = {
  'third-party': (data) {
    return ThirdPartyChannelModel.fromJson(data);
  },
  'home-assistant': (data) {
    return HomeAssistantChannelModel.fromJson(data);
  },
};

ChannelModel buildChannelModel(String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Channel model can not be created. Unsupported device type: $type',
    );
  }
}
