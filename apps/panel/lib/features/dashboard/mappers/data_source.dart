import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/data_sources/device_channel.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/device_channel.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

Map<DataSourceType, Widget Function(DataSourceView)> dataSourceWidgetMappers = {
  DataSourceType.deviceChannel: (dataSource) {
    return DeviceChannelDataSourceWidget(
      dataSource as DeviceChannelDataSourceView,
    );
  },
};

Widget buildDataSourceWidget(DataSourceView dataSource) {
  final builder = dataSourceWidgetMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    throw Exception(
      'Data source widget can not be created. Unsupported data source type: ${dataSource.type.value}',
    );
  }
}
