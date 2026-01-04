import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/models/model.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/views/view.dart';

const String dataSourcesDeviceChannelType = 'data-sources-device-channel';

void registerDataSourcesDeviceChannelPlugin() {
  // Register model mapper
  registerDataSourceModelMapper(dataSourcesDeviceChannelType, (data) {
    return DeviceChannelDataSourceModel.fromJson(data);
  });

  // Register view mapper
  registerDataSourceViewMapper(dataSourcesDeviceChannelType, (DataSourceModel dataSource) {
    if (dataSource is! DeviceChannelDataSourceModel) {
      throw ArgumentError('Data source model is not valid for Device channel data source view.');
    }

    return DeviceChannelDataSourceView(
      id: dataSource.id,
      type: dataSource.type,
      parentType: dataSource.parentType,
      parentId: dataSource.parentId,
      device: dataSource.device,
      channel: dataSource.channel,
      property: dataSource.property,
      icon: dataSource.icon,
    );
  });

  // Register widget mapper
  registerDataSourceWidgetMapper(dataSourcesDeviceChannelType, (dataSource) {
    return DeviceChannelDataSourceWidget(dataSource as DeviceChannelDataSourceView);
  });
}
