import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/generic_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';

/// Generic data source view for unknown/unregistered data source types.
class GenericDataSourceView extends DataSourceView {
  GenericDataSourceView({required GenericDataSourceModel model})
      : super(model: model);

  GenericDataSourceModel get _typedModel => model as GenericDataSourceModel;

  Map<String, dynamic> get configuration => _typedModel.configuration;
}
