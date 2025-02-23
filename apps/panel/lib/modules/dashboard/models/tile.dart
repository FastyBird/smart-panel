import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class TileModel extends Model {
  final TileType _type;

  final String _parent;

  final List<String> _dataSource;

  final int _row;
  final int _col;
  final int _rowSpan;
  final int _colSpan;

  TileModel({
    required super.id,
    required TileType type,
    required String parent,
    List<String> dataSource = const [],
    required int row,
    required int col,
    int? rowSpan,
    int? colSpan,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _parent = UuidUtils.validateUuid(parent),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        _row = row,
        _col = col,
        _rowSpan = rowSpan ?? 1,
        _colSpan = colSpan ?? 1;

  TileType get type => _type;

  String get parent => _parent;

  List<String> get dataSource => _dataSource;

  int get row => _row;

  int get col => _col;

  int get rowSpan => _rowSpan;

  int get colSpan => _colSpan;
}
