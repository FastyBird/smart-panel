import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/device_channel_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

class DeviceChannelDataSourceView
    extends DataSourceView<DeviceChannelDataSourceModel> {
  DeviceChannelDataSourceView({
    required super.dataSourceModel,
  });

  String get device => dataSourceModel.device;

  String get channel => dataSourceModel.channel;

  String get property => dataSourceModel.property;

  IconData? get icon => dataSourceModel.icon;
}
