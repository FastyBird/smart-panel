import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';

abstract class DataSourceModel extends Model {
  final String _type;

  final String _parentType;
  final String _parentId;

  DataSourceModel({
    required super.id,
    required String type,
    required String parentType,
    required String parentId,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _parentType = parentType,
        _parentId = UuidUtils.validateUuid(parentId);

  String get type => _type;

  String get parentType => _parentType;

  String get parentId => _parentId;
}
