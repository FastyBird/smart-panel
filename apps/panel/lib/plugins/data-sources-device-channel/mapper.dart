import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

Map<DataSourceType, Widget Function(DataSourceView)>
    deviceChannelDataSourceWidgetMappers = {
  DataSourceType.deviceChannel: (dataSource) {
    return DeviceChannelDataSourceWidget(
      dataSource as DeviceChannelDataSourceView,
    );
  },
};
