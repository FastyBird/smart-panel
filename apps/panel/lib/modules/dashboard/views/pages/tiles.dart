import 'package:fastybird_smart_panel/modules/dashboard/models/pages/tiles_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

class TilesPageView extends DashboardPageView<TilesPageModel> {
  final List<TileView> _tiles;

  final List<DataSourceView> _dataSources;

  TilesPageView({
    required List<TileView> tiles,
    required List<DataSourceView> dataSources,
    required super.pageModel,
  })  : _tiles = tiles,
        _dataSources = dataSources;

  List<TileView> get tiles => _tiles;

  List<DataSourceView> get dataSources => _dataSources;
}
