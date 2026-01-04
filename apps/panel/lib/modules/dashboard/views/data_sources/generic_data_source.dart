import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';

/// Generic data source view for unknown/unregistered data source types.
class GenericDataSourceView extends DataSourceView {
  final Map<String, dynamic> _configuration;

  GenericDataSourceView({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    Map<String, dynamic> configuration = const {},
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;
}
