import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';

class ActionView {
  final ActionModel _model;

  ActionView({required ActionModel model}) : _model = model;

  ActionModel get model => _model;

  String get id => _model.id;

  /// Action type identifier (e.g., "scenes-local")
  String get type => _model.type;

  String get scene => _model.scene;

  int get order => _model.order;

  bool get enabled => _model.enabled;

  /// Raw configuration for actions
  Map<String, dynamic> get configuration => _model.configuration;
}
