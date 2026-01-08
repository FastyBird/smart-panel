import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';

abstract class TileView {
  final TileModel _model;
  final List<DataSourceView> _dataSources;

  TileView({
    required TileModel model,
    List<DataSourceView> dataSources = const [],
  })  : _model = model,
        _dataSources = dataSources;

  TileModel get model => _model;

  String get id => _model.id;

  String get type => _model.type;

  String get parentType => _model.parentType;

  String get parentId => _model.parentId;

  List<String> get dataSource => _model.dataSource;

  int get row => _model.row;

  int get col => _model.col;

  int get rowSpan => _model.rowSpan;

  int get colSpan => _model.colSpan;

  List<DataSourceView> get dataSources => _dataSources;
}
