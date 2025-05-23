import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class DataSourceView<M extends DataSourceModel> {
  final M _dataSourceModel;

  DataSourceView({
    required M dataSourceModel,
  }) : _dataSourceModel = dataSourceModel;

  String get id => _dataSourceModel.id;

  M get dataSourceModel => _dataSourceModel;

  DataSourceType get type => _dataSourceModel.type;
}
