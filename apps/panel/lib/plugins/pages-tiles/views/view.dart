import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class TilesPageView extends DashboardPageView {
  final double? _tileSize;
  final int? _rows;
  final int? _cols;

  TilesPageView({
    required super.id,
    required super.type,
    required super.title,
    super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.tiles,
    super.cards,
    super.dataSources,
    double? tileSize,
    int? rows,
    int? cols,
  })  : _tileSize = tileSize,
        _rows = rows,
        _cols = cols;

  double? get tileSize => _tileSize;

  int? get rows => _rows;

  int? get cols => _cols;
}
