import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/models/model.dart';
import 'package:flutter/material.dart';

class DevicePreviewTileView extends TileView {
  DevicePreviewTileView({
    required DevicePreviewTileModel model,
    super.dataSources,
  }) : super(model: model);

  DevicePreviewTileModel get _typedModel => model as DevicePreviewTileModel;

  String get device => _typedModel.device;

  IconData? get icon => _typedModel.icon;
}
