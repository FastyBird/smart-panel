import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_channel_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

Map<String, DataSourceModel Function(Map<String, dynamic>)> dataModelMappers = {
  DataSourceType.deviceChannel.value: (data) {
    return DeviceChannelDataSourceModel.fromJson(data);
  },
};

DataSourceModel buildDataSourceModel(
  DataSourceType type,
  Map<String, dynamic> data,
) {
  final builder = dataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page data source model can not be created. Unsupported page data source type: ${data['type']}',
    );
  }
}
