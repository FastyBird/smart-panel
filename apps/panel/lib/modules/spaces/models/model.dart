import 'package:fastybird_smart_panel/core/utils/uuid.dart';

abstract class Model {
  final String _id;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  Model({
    required String id,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
