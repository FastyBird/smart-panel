import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

class DayWeatherTileView extends TileView {
  final String? _locationId;

  DayWeatherTileView({
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
    String? locationId,
  }) : _locationId = locationId;

  String? get locationId => _locationId;
}
