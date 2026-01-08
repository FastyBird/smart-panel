import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';

abstract class DataSourceView {
  final DataSourceModel _model;

  DataSourceView({required DataSourceModel model}) : _model = model;

  DataSourceModel get model => _model;

  String get id => _model.id;

  String get type => _model.type;

  String get parentType => _model.parentType;

  String get parentId => _model.parentId;
}
