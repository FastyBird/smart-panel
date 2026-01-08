import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/models/model.dart';
import 'package:flutter/material.dart';

class SceneTileView extends TileView {
  SceneTileView({
    required SceneTileModel model,
    super.dataSources,
  }) : super(model: model);

  SceneTileModel get _typedModel => model as SceneTileModel;

  String get scene => _typedModel.scene;

  IconData? get icon => _typedModel.icon;

  String get label => _typedModel.label;

  String get status => _typedModel.status;

  bool get isOn => _typedModel.isOn;
}
