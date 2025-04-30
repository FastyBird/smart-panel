import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/third_party_properties.dart';

Map<String, ChannelPropertyModel Function(Map<String, dynamic>)>
    deviceModelMappers = {
  'third-party': (data) {
    return ThirdPartyChannelPropertyModel.fromJson(data);
  },
};

ChannelPropertyModel buildChannelPropertyModel(
    String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Channel property model can not be created. Unsupported device type: $type',
    );
  }
}
