import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/models/model.dart';
import 'package:flutter/material.dart';

class DeviceChannelDataSourceView extends DataSourceView {
  DeviceChannelDataSourceView({required DeviceChannelDataSourceModel model})
      : super(model: model);

  DeviceChannelDataSourceModel get _typedModel =>
      model as DeviceChannelDataSourceModel;

  String get device => _typedModel.device;

  String get channel => _typedModel.channel;

  String get property => _typedModel.property;

  IconData? get icon => _typedModel.icon;
}
