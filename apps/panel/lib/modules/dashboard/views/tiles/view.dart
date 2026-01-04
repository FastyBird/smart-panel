import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';

abstract class TileView {
  final String _id;
  final String _type;
  final String _parentType;
  final String _parentId;
  final List<String> _dataSource;
  final int _row;
  final int _col;
  final int _rowSpan;
  final int _colSpan;
  final List<DataSourceView> _dataSources;

  TileView({
    required String id,
    required String type,
    required String parentType,
    required String parentId,
    List<String> dataSource = const [],
    required int row,
    required int col,
    int rowSpan = 1,
    int colSpan = 1,
    List<DataSourceView> dataSources = const [],
  })  : _id = id,
        _type = type,
        _parentType = parentType,
        _parentId = parentId,
        _dataSource = dataSource,
        _row = row,
        _col = col,
        _rowSpan = rowSpan,
        _colSpan = colSpan,
        _dataSources = dataSources;

  String get id => _id;

  String get type => _type;

  String get parentType => _parentType;

  String get parentId => _parentId;

  List<String> get dataSource => _dataSource;

  int get row => _row;

  int get col => _col;

  int get rowSpan => _rowSpan;

  int get colSpan => _colSpan;

  List<DataSourceView> get dataSources => _dataSources;
}
