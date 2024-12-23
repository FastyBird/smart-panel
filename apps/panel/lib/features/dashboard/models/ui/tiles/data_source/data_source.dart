import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

abstract class TileDataSourceModel {
  final String _id;
  final TileDataSourceType _type;

  final String _tile;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  TileDataSourceModel({
    required String id,
    required TileDataSourceType type,
    required String tile,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _type = type,
        _tile = UuidUtils.validateUuid(tile),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  TileDataSourceType get type => _type;

  String get tile => _tile;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
