import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/mapper.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/mapper.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

/// Combines all data source widget mappers from plugins
final Map<DataSourceType, Widget Function(DataSourceView)>
    dataSourceWidgetMappers = {
  ...deviceChannelDataSourceWidgetMappers,
  ...weatherDataSourceWidgetMappers,
};

Widget buildDataSourceWidget(DataSourceView dataSource) {
  final builder = dataSourceWidgetMappers[dataSource.type];

  if (builder != null) {
    return builder(dataSource);
  } else {
    throw ArgumentError(
      'Data source widget can not be created. Unsupported data source type: ${dataSource.type.value}',
    );
  }
}
