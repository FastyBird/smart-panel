import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class DataSourceModel extends Model {
  final DataSourceType _type;

  final String _parent;

  DataSourceModel({
    required super.id,
    required DataSourceType type,
    required String parent,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _parent = UuidUtils.validateUuid(parent);

  DataSourceType get type => _type;

  String get parent => _parent;
}
