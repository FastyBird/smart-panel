import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

abstract class DataSourceView {
  final String _id;
  final DataSourceType _type;
  final String _parentType;
  final String _parentId;

  DataSourceView({
    required String id,
    required DataSourceType type,
    required String parentType,
    required String parentId,
  })  : _id = id,
        _type = type,
        _parentType = parentType,
        _parentId = parentId;

  String get id => _id;

  DataSourceType get type => _type;

  String get parentType => _parentType;

  String get parentId => _parentId;
}
