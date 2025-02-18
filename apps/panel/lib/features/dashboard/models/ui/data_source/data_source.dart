import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

abstract class DataSourceModel {
  final String _id;
  final DataSourceType _type;

  final String _parent;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  DataSourceModel({
    required String id,
    required DataSourceType type,
    required String parent,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _type = type,
        _parent = UuidUtils.validateUuid(parent),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  DataSourceType get type => _type;

  String get parent => _parent;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
