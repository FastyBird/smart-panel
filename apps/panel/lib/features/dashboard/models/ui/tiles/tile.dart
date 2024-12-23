import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

abstract class TileModel {
  final String _id;
  final TileType _type;

  final List<String> _dataSource;

  final int _row;
  final int _col;
  final int _rowSpan;
  final int _colSpan;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  TileModel({
    required String id,
    required TileType type,
    List<String> dataSource = const [],
    required int row,
    required int col,
    int? rowSpan,
    int? colSpan,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _type = type,
        _dataSource = dataSource,
        _row = row,
        _col = col,
        _rowSpan = rowSpan ?? 1,
        _colSpan = colSpan ?? 1,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  TileType get type => _type;

  List<String> get dataSource => _dataSource;

  int get row => _row;

  int get col => _col;

  int get rowSpan => _rowSpan;

  int get colSpan => _colSpan;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
