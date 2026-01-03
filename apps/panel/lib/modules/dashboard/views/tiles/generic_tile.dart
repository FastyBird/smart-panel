import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

/// Generic tile view for unknown/unregistered tile types.
class GenericTileView extends TileView {
  final Map<String, dynamic> _configuration;

  GenericTileView({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.dataSources,
    Map<String, dynamic> configuration = const {},
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;
}
