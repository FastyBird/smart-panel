import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';

abstract class TileModel extends Model {
  final String _type;

  final String _parentType;
  final String _parentId;

  final List<String> _dataSource;

  final int _row;
  final int _col;
  final int _rowSpan;
  final int _colSpan;

  TileModel({
    required super.id,
    required String type,
    required String parentType,
    required String parentId,
    List<String> dataSource = const [],
    required int row,
    required int col,
    int? rowSpan,
    int? colSpan,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _parentType = parentType,
        _parentId = UuidUtils.validateUuid(parentId),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        _row = row,
        _col = col,
        _rowSpan = rowSpan ?? 1,
        _colSpan = colSpan ?? 1;

  String get type => _type;

  String get parentType => _parentType;

  String get parentId => _parentId;

  List<String> get dataSource => _dataSource;

  int get row => _row;

  int get col => _col;

  int get rowSpan => _rowSpan;

  int get colSpan => _colSpan;
}
